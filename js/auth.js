// auth.js — Sistema de usuarios Monitoreo C.E
// Almacenamiento: JSONBin.io

// ═══════════════════════════════════════════
//  CONFIGURACIÓN JSONBIN  ← edita esto
// ═══════════════════════════════════════════
var JSONBIN_BIN_ID  = '6a163616f47d5c455c3b2caa';   // Ej: '6650a1f2ad19ca34f8a1b2c3'
var JSONBIN_API_KEY = '$2a$10$qGBnsriYX1NxX7wkS3Swx.t9Mz3edZUj9oFKVkDtfin4IrZF7ss2O';   // Ej: '$2a$10$...'
// ═══════════════════════════════════════════

var AUTH_SESSION_KEY = 'mce_session';
var AUTH_CACHE_KEY   = 'mce_users_cache';

var AUTH_PERMS = {
  'Admin':           { crear:true,  cerrar:true,  editar:true,  verTodos:true,  usuarios:true,  config:true  },
  'Monitor/Técnico': { crear:true,  cerrar:true,  editar:false, verTodos:false, usuarios:false, config:false },
  'Técnico':         { crear:false, cerrar:true,  editar:false, verTodos:true,  usuarios:false, config:false }
};

// Migración: usuarios con el rol antiguo "Monitor" pasan a "Monitor/Técnico".
function normalizeUsers(users) {
  if (!Array.isArray(users)) return users;
  return users.map(function(u){
    if (u && u.rol === 'Monitor') u.rol = 'Monitor/Técnico';
    return u;
  });
}

var AUTH_DEFAULT_USERS = [
  { id:1, nombre:'Administrador', username:'admin', password:'admin123', rol:'Admin' }
];

var currentUser  = null;
var _usersCache  = null;
var authEditingId = null;

// ── JSONBIN: LEER ──
async function jsonbinGet() {
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) {
    // Sin configurar → usar cache local o defaults
    var c = localStorage.getItem(AUTH_CACHE_KEY);
    return normalizeUsers(c ? JSON.parse(c) : JSON.parse(JSON.stringify(AUTH_DEFAULT_USERS)));
  }
  try {
    var r = await fetch('https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID + '/latest', {
      headers: { 'X-Master-Key': JSONBIN_API_KEY }
    });
    var d = await r.json();
    var users = normalizeUsers(d.record && d.record.users ? d.record.users : AUTH_DEFAULT_USERS);
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(users));
    _usersCache = users;
    return users;
  } catch(e) {
    console.warn('JSONBin offline, usando cache:', e);
    var c2 = localStorage.getItem(AUTH_CACHE_KEY);
    return normalizeUsers(c2 ? JSON.parse(c2) : JSON.parse(JSON.stringify(AUTH_DEFAULT_USERS)));
  }
}

// ── JSONBIN: ESCRIBIR ──
async function jsonbinSet(users) {
  localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(users));
  _usersCache = users;
  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) return true;
  try {
    var r = await fetch('https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json', 'X-Master-Key': JSONBIN_API_KEY },
      body: JSON.stringify({ users: users })
    });
    return r.ok;
  } catch(e) {
    console.warn('JSONBin write error:', e);
    return false;
  }
}

// ── HELPERS ──
function authCan(perm) { return currentUser && AUTH_PERMS[currentUser.rol] && AUTH_PERMS[currentUser.rol][perm]; }
function escHtml(s) { var d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }

// ── INIT ──
function authInit() {
  injectLoginScreen();
  injectUserPanel();
  injectTopbarUser();

  var s = sessionStorage.getItem(AUTH_SESSION_KEY);
  if (s) {
    try {
      var u = JSON.parse(s);
      jsonbinGet().then(function(users) {
        var found = users.find(function(x){ return x.id===u.id && x.username===u.username; });
        if (found) {
          currentUser = found;
          if (typeof aplicarZona === 'function') aplicarZona(found.zona || ZONA_DEFAULT);
          if (typeof _actualizarDatosZona === 'function') _actualizarDatosZona();
          showMainApp();
        }
        else showLoginScreen();
      });
      return;
    } catch(e) {}
  }
  showLoginScreen();
}

// ── LOGIN ──
async function doLogin() {
  var u    = document.getElementById('auth-username').value.trim();
  var p    = document.getElementById('auth-password').value;
  var err  = document.getElementById('auth-err');
  var btn  = document.getElementById('auth-login-btn');

  if (!u || !p) { err.textContent='Completa usuario y contraseña.'; return; }

  btn.textContent = 'Verificando...';
  btn.disabled = true;

  var users = await jsonbinGet();
  var found = users.find(function(x){ return x.username===u && x.password===p; });

  btn.textContent = 'Ingresar';
  btn.disabled = false;

  if (!found) { err.textContent='Usuario o contraseña incorrectos.'; shakeCard(); return; }

  err.textContent = '';
  currentUser = found;
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(found));
  if (typeof aplicarZona === 'function') aplicarZona(found.zona || ZONA_DEFAULT);
  if (typeof _actualizarDatosZona === 'function') _actualizarDatosZona();
  showMainApp();
}

function doLogout() {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  currentUser = null;
  // Limpia el monitoreo cacheado para que el próximo usuario no vea hoja ajena
  monitoreoData = null;
  localStorage.removeItem('inc_monitoreo');
  if (typeof monSelected !== 'undefined' && monSelected.clear) monSelected.clear();
  showLoginScreen();
}

function shakeCard() {
  var c = document.getElementById('auth-card');
  c.style.animation='none';
  setTimeout(function(){ c.style.animation='authShake .4s ease'; },10);
}

// ── MOSTRAR ──
function showLoginScreen() {
  document.getElementById('auth-screen').style.display='flex';
  var app=document.querySelector('.app'), sb=document.querySelector('.sidebar');
  if(app) app.style.display='none';
  if(sb)  sb.style.display='none';
  document.getElementById('auth-username').value='';
  document.getElementById('auth-password').value='';
  document.getElementById('auth-err').textContent='';
  setTimeout(function(){ document.getElementById('auth-username').focus(); },100);
}

function showMainApp() {
  document.getElementById('auth-screen').style.display='none';
  var app=document.querySelector('.app'), sb=document.querySelector('.sidebar');
  if(app) app.style.display='flex';
  if(sb)  sb.style.display='flex';
  applyRoleUI();
  updateTopbarUser();

  // Admin sin zona = Admin Global → mostrar dashboard global
  var esAdminGlobal = currentUser && currentUser.rol === 'Admin' && !currentUser.zona;
  if (esAdminGlobal) {
    var btnGlobal = document.getElementById('sidebar-global');
    if (btnGlobal) {
      btnGlobal.style.display = 'flex';
      setTimeout(function(){ switchTab('global', btnGlobal); }, 100);
    }
    if (typeof initDashboardGlobal === 'function') initDashboardGlobal();
  } else {
    setTimeout(function(){
      if (typeof preloadAtLogin === 'function') preloadAtLogin();
      else if (typeof loadFromSheet === 'function') loadFromSheet();
    }, 700);
  }

  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) {
    setTimeout(function(){
      if(typeof showToast==='function')
        showToast('⚠ JSONBin no configurado — usuarios solo en este dispositivo', 'warn');
    }, 1200);
  }
}

// ── PERMISOS EN UI ──
function applyRoleUI() {
  if (!currentUser) return;
  var perms = AUTH_PERMS[currentUser.rol];
  var esAdminGlobal = currentUser.rol === 'Admin' && !currentUser.zona;
  var btnNuevo   = document.querySelector('.sidebar-item[onclick*="nuevo"]');
  var btnTecnico = document.querySelector('.sidebar-item[onclick*="tecnico"]');
  var btnGlobal  = document.getElementById('sidebar-global');
  if (btnNuevo)   btnNuevo.style.display   = perms.crear ? 'flex' : 'none';
  if (btnTecnico) btnTecnico.style.display = (perms.cerrar||perms.verTodos) ? 'flex' : 'none';
  if (btnGlobal)  btnGlobal.style.display  = esAdminGlobal ? 'flex' : 'none';
  var btnCfg = document.querySelector('.btn-report');
  if (btnCfg) btnCfg.style.display = perms.config ? 'flex' : 'none';
  // Admin con zona o no-Admin → ir a su panel normal
  if (!perms.crear && !esAdminGlobal) {
    var btnMon = document.querySelector('.sidebar-item[onclick*="monitor"]');
    if (btnMon) btnMon.click();
  }
  if (typeof populateMonitorSelects === 'function') populateMonitorSelects();
  if (typeof renderMonitorDiaBanner === 'function') renderMonitorDiaBanner();
}

// ── TOPBAR USER ──
function injectTopbarUser() {
  var topRight = document.querySelector('.topbar-right');
  if (!topRight) return;
  var div = document.createElement('div');
  div.id = 'auth-topbar-user';
  div.style.cssText = 'display:flex;align-items:center;gap:8px;position:relative';
  div.innerHTML =
    '<div id="auth-user-pill" style="display:flex;align-items:center;gap:8px;padding:5px 12px 5px 7px;border-radius:20px;border:1.5px solid var(--border);background:var(--white);cursor:pointer" onclick="toggleUserMenu()">' +
      '<div id="auth-avatar" style="width:26px;height:26px;border-radius:50%;background:#2563eb;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff">A</div>' +
      '<span id="auth-user-name" style="font-size:13px;font-weight:600;color:var(--text)">Admin</span>' +
      '<span id="auth-role-badge" style="font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;background:#eff6ff;color:#2563eb">Admin</span>' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--text3)"><polyline points="6 9 12 15 18 9"/></svg>' +
    '</div>' +
    '<div id="auth-user-menu" style="display:none;position:absolute;top:44px;right:0;background:var(--white);border:1.5px solid var(--border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:500;min-width:220px;overflow:hidden">' +
      '<div style="padding:14px 16px;border-bottom:1px solid var(--border)">' +
        '<div style="font-size:13px;font-weight:700;color:var(--text)" id="auth-menu-nombre"></div>' +
        '<div style="font-size:11px;color:var(--text3)" id="auth-menu-username"></div>' +
        '<div id="auth-menu-role-pill" style="display:inline-block;margin-top:5px;font-size:11px;padding:2px 10px;border-radius:10px;font-weight:600"></div>' +
      '</div>' +
      '<button id="auth-btn-usuarios" onclick="openUsersPanel()" style="width:100%;text-align:left;padding:10px 16px;border:none;background:none;font-size:13px;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:8px;font-family:var(--sans)">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
        'Gestionar usuarios' +
      '</button>' +
      '<div id="auth-zona-selector" style="display:none;padding:8px 16px;border-top:1px solid var(--border)">' +
        '<div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:600">CAMBIAR ZONA</div>' +
        '<div style="display:flex;gap:6px">' +
          '<button onclick="cambiarZona(\'central\')" id="zona-btn-central" style="flex:1;padding:5px 4px;border-radius:8px;border:1.5px solid var(--border);background:none;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--sans)">Central</button>' +
          '<button onclick="cambiarZona(\'oriental\')" id="zona-btn-oriental" style="flex:1;padding:5px 4px;border-radius:8px;border:1.5px solid var(--border);background:none;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--sans)">Oriental</button>' +
          '<button onclick="cambiarZona(\'occidental\')" id="zona-btn-occidental" style="flex:1;padding:5px 4px;border-radius:8px;border:1.5px solid var(--border);background:none;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--sans)">Occidental</button>' +
        '</div>' +
      '</div>' +
      '<button id="auth-btn-jsonbin" onclick="openJsonbinConfig()" style="width:100%;text-align:left;padding:10px 16px;border:none;background:none;font-size:13px;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:8px;font-family:var(--sans)">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>' +
        'Configurar JSONBin' +
      '</button>' +
      '<button onclick="doLogout()" style="width:100%;text-align:left;padding:10px 16px;border:none;background:none;font-size:13px;color:var(--danger);cursor:pointer;display:flex;align-items:center;gap:8px;font-family:var(--sans);border-top:1px solid var(--border)">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
        'Cerrar sesión' +
      '</button>' +
    '</div>';
  topRight.insertBefore(div, topRight.firstChild);

  document.addEventListener('click', function(e) {
    var menu=document.getElementById('auth-user-menu');
    var pill=document.getElementById('auth-user-pill');
    if(menu&&pill&&!pill.contains(e.target)&&!menu.contains(e.target))
      menu.style.display='none';
  });
}

function updateTopbarUser() {
  if (!currentUser) return;
  var rc = roleStyle(currentUser.rol);
  var initials = currentUser.nombre.split(' ').map(function(w){return w[0];}).slice(0,2).join('').toUpperCase();
  var av=document.getElementById('auth-avatar');
  if(av){av.textContent=initials;av.style.background=rc.av;}
  var nm=document.getElementById('auth-user-name');
  if(nm) nm.textContent=currentUser.nombre.split(' ')[0];
  var rb=document.getElementById('auth-role-badge');
  if(rb){rb.textContent=currentUser.rol;rb.style.background=rc.bg;rb.style.color=rc.color;}
  var mn=document.getElementById('auth-menu-nombre');
  if(mn) mn.textContent=currentUser.nombre;
  var mu=document.getElementById('auth-menu-username');
  if(mu) mu.textContent='@'+currentUser.username;
  var mp=document.getElementById('auth-menu-role-pill');
  if(mp){mp.textContent=currentUser.rol;mp.style.background=rc.bg;mp.style.color=rc.color;}
  var btu=document.getElementById('auth-btn-usuarios');
  if(btu) btu.style.display=authCan('usuarios')?'flex':'none';
  var btj=document.getElementById('auth-btn-jsonbin');
  if(btj) btj.style.display=authCan('config')?'flex':'none';
  // Selector de zona: para Admin con zona (para cambiar de zona rápido)
  var esAdminConZona = currentUser && currentUser.rol === 'Admin' && currentUser.zona;
  var zs = document.getElementById('auth-zona-selector');
  if (zs) zs.style.display = esAdminConZona ? 'block' : 'none';
  actualizarBotonesZona();
}

function toggleUserMenu() {
  var m=document.getElementById('auth-user-menu');
  if(m) m.style.display=m.style.display==='none'?'block':'none';
}

function roleStyle(rol) {
  var map={
    'Admin':           {bg:'#eff6ff',color:'#2563eb',av:'#2563eb'},
    'Monitor/Técnico': {bg:'#f5f3ff',color:'#7c3aed',av:'#7c3aed'},
    'Técnico':         {bg:'#fffbeb',color:'#d97706',av:'#d97706'}
  };
  return map[rol]||map['Monitor/Técnico'];
}

// ── PANEL USUARIOS ──
function openUsersPanel() {
  document.getElementById('auth-user-menu').style.display='none';
  document.getElementById('users-panel-overlay').style.display='block';
  document.getElementById('users-panel').style.right='0';
  loadAndRenderUsers();
}
function closeUsersPanel() {
  document.getElementById('users-panel-overlay').style.display='none';
  document.getElementById('users-panel').style.right='-540px';
}

async function loadAndRenderUsers() {
  document.getElementById('users-panel-list').innerHTML =
    '<div style="text-align:center;padding:30px;color:var(--text3);font-size:13px">Cargando usuarios...</div>';
  var users = await jsonbinGet();
  renderUsersList(users);
}

function renderUsersList(users) {
  var canEdit = authCan('usuarios');
  document.getElementById('users-panel-list').innerHTML = users.map(function(u) {
    var rc = roleStyle(u.rol);
    var initials = u.nombre.split(' ').map(function(w){return w[0];}).slice(0,2).join('').toUpperCase();
    var isSelf = currentUser && currentUser.id===u.id;
    return '<div style="background:var(--white);border:1.5px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:12px">' +
      '<div style="width:38px;height:38px;border-radius:50%;background:'+rc.av+';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0">'+initials+'</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:14px;font-weight:600;color:var(--text)">'+escHtml(u.nombre)+(isSelf?' <span style="font-size:10px;color:var(--text3)">(tú)</span>':'')+'</div>' +
        '<div style="font-size:12px;color:var(--text3)">@'+escHtml(u.username) + (u.zona ? ' · <span style="color:var(--primary)">'+u.zona+'</span>' : ' · <span style="color:#f59e0b">global</span>') + '</div>' +
      '</div>' +
      '<span style="font-size:11px;padding:3px 10px;border-radius:10px;font-weight:600;background:'+rc.bg+';color:'+rc.color+';margin-right:6px;white-space:nowrap">'+escHtml(u.rol)+'</span>' +
      (canEdit ?
        '<div style="display:flex;gap:5px">' +
          '<button onclick="openEditUser('+u.id+')" style="width:30px;height:30px;border-radius:7px;border:1.5px solid var(--border2);background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text2)" title="Editar">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
          '</button>' +
          (!isSelf ?
            '<button onclick="deleteUser('+u.id+')" style="width:30px;height:30px;border-radius:7px;border:1.5px solid var(--border2);background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text3)" title="Eliminar">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
            '</button>' : '') +
        '</div>' : '') +
    '</div>';
  }).join('');
}

async function deleteUser(id) {
  if (!confirm('¿Eliminar este usuario?')) return;
  var users = await jsonbinGet();
  users = users.filter(function(u){ return u.id!==id; });
  var ok = await jsonbinSet(users);
  renderUsersList(users);
  if(ok && typeof showToast==='function') showToast('Usuario eliminado ✓','ok');
}

// ── MODAL CREAR / EDITAR ──
function openNewUser() {
  authEditingId = null;
  document.getElementById('umodal-title').textContent='Nuevo usuario';
  document.getElementById('umodal-nombre').value='';
  document.getElementById('umodal-username').value='';
  document.getElementById('umodal-password').value='';
  document.getElementById('umodal-rol').value='Monitor/Técnico';
  document.getElementById('umodal-zona').value='central';
  document.getElementById('umodal-pass-req').textContent='Mínimo 6 caracteres.';
  document.getElementById('umodal-err').textContent='';
  document.getElementById('umodal-bg').style.display='flex';
}

async function openEditUser(id) {
  var users = await jsonbinGet();
  var u = users.find(function(x){return x.id===id;});
  if(!u) return;
  authEditingId = id;
  document.getElementById('umodal-title').textContent='Editar usuario';
  document.getElementById('umodal-nombre').value=u.nombre;
  document.getElementById('umodal-username').value=u.username;
  document.getElementById('umodal-password').value='';
  document.getElementById('umodal-rol').value=u.rol;
  document.getElementById('umodal-zona').value=u.zona||'';
  document.getElementById('umodal-pass-req').textContent='Deja en blanco para no cambiar.';
  document.getElementById('umodal-err').textContent='';
  document.getElementById('umodal-bg').style.display='flex';
}

function closeUserModal() {
  document.getElementById('umodal-bg').style.display='none';
  authEditingId=null;
}

async function saveUserModal() {
  var nombre   = document.getElementById('umodal-nombre').value.trim();
  var username = document.getElementById('umodal-username').value.trim().toLowerCase();
  var pass     = document.getElementById('umodal-password').value;
  var rol      = document.getElementById('umodal-rol').value;
  var zona     = document.getElementById('umodal-zona').value || undefined;
  var errEl    = document.getElementById('umodal-err');
  var btn      = document.getElementById('umodal-save-btn');

  if(!nombre||!username){errEl.textContent='Nombre y usuario son obligatorios.';return;}
  if(!authEditingId&&pass.length<6){errEl.textContent='La contraseña debe tener mínimo 6 caracteres.';return;}
  if(authEditingId&&pass.length>0&&pass.length<6){errEl.textContent='Si cambias la contraseña, mínimo 6 caracteres.';return;}

  btn.textContent='Guardando...'; btn.disabled=true;

  var users = await jsonbinGet();
  var dup = users.find(function(u){return u.username===username&&u.id!==authEditingId;});
  if(dup){errEl.textContent='Ese usuario ya existe.';btn.textContent='Guardar';btn.disabled=false;return;}

  if(authEditingId) {
    users = users.map(function(u){
      if(u.id!==authEditingId) return u;
      var updated = {id:u.id, nombre:nombre, username:username, password:pass.length>=6?pass:u.password, rol:rol};
      if(zona) updated.zona = zona; // solo guardar zona si tiene valor
      return updated;
    });
    if(currentUser&&currentUser.id===authEditingId){
      currentUser=users.find(function(u){return u.id===authEditingId;});
      sessionStorage.setItem(AUTH_SESSION_KEY,JSON.stringify(currentUser));
      updateTopbarUser();
    }
  } else {
    var nuevo = {id:Date.now(), nombre:nombre, username:username, password:pass, rol:rol};
    if(zona) nuevo.zona = zona;
    users.push(nuevo);
  }

  var ok = await jsonbinSet(users);
  btn.textContent='Guardar'; btn.disabled=false;
  closeUserModal();
  renderUsersList(users);
  if(typeof showToast==='function')
    showToast(ok ? (authEditingId?'Usuario actualizado ✓':'Usuario creado ✓') : 'Guardado localmente (sin JSONBin)', ok?'ok':'warn');
}

// ── CONFIG JSONBIN ──
function openJsonbinConfig() {
  document.getElementById('auth-user-menu').style.display='none';
  document.getElementById('jbin-bid').value=JSONBIN_BIN_ID||localStorage.getItem('mce_jbin_id')||'';
  document.getElementById('jbin-key').value=JSONBIN_API_KEY||localStorage.getItem('mce_jbin_key')||'';
  document.getElementById('jbin-err').textContent='';
  document.getElementById('jbin-modal-bg').style.display='flex';
}
function closeJsonbinConfig(){ document.getElementById('jbin-modal-bg').style.display='none'; }

async function saveJsonbinConfig() {
  var bid = document.getElementById('jbin-bid').value.trim();
  var key = document.getElementById('jbin-key').value.trim();
  var err = document.getElementById('jbin-err');
  var btn = document.getElementById('jbin-save-btn');
  if(!bid||!key){err.textContent='Ambos campos son obligatorios.';return;}
  btn.textContent='Probando...'; btn.disabled=true;
  try {
    var r = await fetch('https://api.jsonbin.io/v3/b/'+bid+'/latest',{headers:{'X-Master-Key':key}});
    if(!r.ok) throw new Error('status '+r.status);
    JSONBIN_BIN_ID=bid; JSONBIN_API_KEY=key;
    localStorage.setItem('mce_jbin_id',bid);
    localStorage.setItem('mce_jbin_key',key);
    btn.textContent='Guardar'; btn.disabled=false;
    closeJsonbinConfig();
    if(typeof showToast==='function') showToast('JSONBin conectado ✓','ok');
  } catch(e) {
    err.textContent='No se pudo conectar. Revisa el BIN ID y la API Key.';
    btn.textContent='Guardar'; btn.disabled=false;
  }
}

// ── INYECTAR SCREENS ──
function injectLoginScreen() {
  var style=document.createElement('style');
  style.textContent=[
    '#auth-screen{display:none;position:fixed;inset:0;z-index:1000;background:linear-gradient(135deg,#1e2d5a 0%,#162347 60%,#0f1a38 100%);align-items:center;justify-content:center}',
    '#auth-card{background:#fff;border-radius:20px;padding:2.5rem 2rem 2rem;width:100%;max-width:360px;display:flex;flex-direction:column;align-items:center;gap:1.25rem;box-shadow:0 24px 64px rgba(0,0,0,.35)}',
    '.auth-logo{width:72px;height:72px;border-radius:50%;background:#2563eb;display:flex;align-items:center;justify-content:center}',
    '.auth-logo svg{width:36px;height:36px;stroke:#fff}',
    '.auth-title{font-size:22px;font-weight:700;color:#111827;text-align:center;line-height:1.2}',
    '.auth-sub{font-size:12px;color:#6b7280;text-align:center;margin-top:-.75rem}',
    '.auth-fields{width:100%;display:flex;flex-direction:column;gap:10px}',
    '.auth-fields label{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:3px}',
    '.auth-fields input{width:100%;border:1.5px solid #e5e7eb;border-radius:8px;padding:10px 13px;font-size:14px;font-family:Inter,sans-serif;color:#111827;outline:none;transition:border .2s}',
    '.auth-fields input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1)}',
    '#auth-login-btn{width:100%;padding:11px;background:#2563eb;color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:700;font-family:Inter,sans-serif;cursor:pointer;transition:background .2s}',
    '#auth-login-btn:hover{background:#1d4ed8}',
    '#auth-login-btn:disabled{background:#93c5fd;cursor:not-allowed}',
    '#auth-err{font-size:12px;color:#dc2626;text-align:center;min-height:16px}',
    '.auth-hint{font-size:11px;color:#9ca3af}',
    '@keyframes authShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}',
    // Panel usuarios
    '#users-panel-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:200;backdrop-filter:blur(2px)}',
    '#users-panel{position:fixed;top:0;right:-540px;width:520px;height:100vh;background:var(--white);border-left:1px solid var(--border);z-index:201;overflow-y:auto;transition:right .28s cubic-bezier(.4,0,.2,1);box-shadow:-4px 0 24px rgba(0,0,0,.08);display:flex;flex-direction:column}',
    // Modal usuario
    '#umodal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:400;align-items:center;justify-content:center}',
    '#umodal{background:#fff;border-radius:16px;padding:1.5rem;width:100%;max-width:340px;box-shadow:0 20px 60px rgba(0,0,0,.2)}',
    '#umodal h3{font-size:15px;font-weight:700;color:#111827;margin-bottom:1rem}',
    '.um-row{margin-bottom:10px}',
    '.um-row label{display:block;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}',
    '.um-row input,.um-row select{width:100%;border:1.5px solid #e5e7eb;border-radius:8px;padding:9px 12px;font-size:13px;font-family:Inter,sans-serif;color:#111827;outline:none;transition:border .2s}',
    '.um-row input:focus,.um-row select:focus{border-color:#2563eb}',
    '#umodal-err{font-size:11px;color:#dc2626;min-height:14px;margin-top:4px}',
    '.um-actions{display:flex;gap:8px;margin-top:1.25rem;justify-content:flex-end}',
    '.um-cancel{padding:8px 16px;border:1.5px solid #e5e7eb;border-radius:8px;background:none;font-size:13px;cursor:pointer;color:#6b7280;font-family:Inter,sans-serif}',
    '.um-save{padding:8px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif}',
    '.um-save:disabled{background:#93c5fd;cursor:not-allowed}',
    // Modal JSONBin
    '#jbin-modal-bg{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:400;align-items:center;justify-content:center}',
    '#jbin-modal{background:#fff;border-radius:16px;padding:1.5rem;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.2)}',
  ].join('');
  document.head.appendChild(style);

  // Login screen
  var el=document.createElement('div');
  el.id='auth-screen';
  el.innerHTML=
    '<div id="auth-card">'+
      '<div class="auth-logo"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>'+
      '<div class="auth-title">Monitoreo C.E</div>'+
      '<div class="auth-sub">Sistema de gestión de incidencias</div>'+
      '<div class="auth-fields">'+
        '<div><label>Usuario</label><input type="text" id="auth-username" placeholder="usuario" autocomplete="off"/></div>'+
        '<div><label>Contraseña</label><input type="password" id="auth-password" placeholder="••••••••"/></div>'+
      '</div>'+
      '<div id="auth-err"></div>'+
      '<button id="auth-login-btn" onclick="doLogin()">Ingresar</button>'+
      
    '</div>';
  document.body.appendChild(el);

  document.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&document.getElementById('auth-screen').style.display!=='none') doLogin();
  });
}

function injectUserPanel() {
  // Overlay + panel lateral
  var ov=document.createElement('div');
  ov.id='users-panel-overlay'; ov.onclick=closeUsersPanel;
  document.body.appendChild(ov);

  var panel=document.createElement('div');
  panel.id='users-panel';
  panel.innerHTML=
    '<div style="padding:18px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:var(--white);position:sticky;top:0;z-index:1">'+
      '<h2 style="font-size:16px;font-weight:700">Gestión de usuarios</h2>'+
      '<button onclick="closeUsersPanel()" style="background:none;border:1.5px solid var(--border);border-radius:7px;padding:5px 12px;font-size:13px;color:var(--text2);cursor:pointer">✕ Cerrar</button>'+
    '</div>'+
    '<div style="padding:20px;display:flex;flex-direction:column;gap:10px;flex:1">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'+
        '<span style="font-size:13px;color:var(--text2)">Usuarios registrados</span>'+
        '<button onclick="openNewUser()" style="display:flex;align-items:center;gap:6px;padding:7px 14px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">+ Nuevo</button>'+
      '</div>'+
      '<div id="users-panel-list" style="display:flex;flex-direction:column;gap:8px"></div>'+
    '</div>';
  document.body.appendChild(panel);

  // Modal crear/editar usuario
  var umod=document.createElement('div');
  umod.id='umodal-bg';
  umod.innerHTML=
    '<div id="umodal">'+
      '<h3 id="umodal-title">Nuevo usuario</h3>'+
      '<div class="um-row"><label>Nombre completo</label><input type="text" id="umodal-nombre" placeholder="Ej. Carlos López"/></div>'+
      '<div class="um-row"><label>Usuario (login)</label><input type="text" id="umodal-username" placeholder="Ej. clopez" autocomplete="off"/></div>'+
      '<div class="um-row">'+
        '<label>Contraseña</label>'+
        '<input type="password" id="umodal-password" placeholder="Mínimo 6 caracteres"/>'+
        '<div id="umodal-pass-req" style="font-size:11px;color:#9ca3af;margin-top:3px">Mínimo 6 caracteres.</div>'+
      '</div>'+
      '<div class="um-row"><label>Rol</label>'+
        '<select id="umodal-rol">'+
          '<option value="Monitor/Técnico">Monitor/Técnico</option>'+
          '<option value="Técnico">Técnico</option>'+
          '<option value="Admin">Admin</option>'+
        '</select>'+
      '</div>'+
      '<div class="um-row"><label>Zona</label>'+
        '<select id="umodal-zona">'+
          '<option value="">— Sin zona (Admin Global) —</option>'+
          '<option value="central">Central</option>'+
          '<option value="oriental">Oriental</option>'+
          '<option value="occidental">Occidental</option>'+
        '</select>'+
        '<div style="font-size:11px;color:#9ca3af;margin-top:3px">Sin zona = Admin Global (ve dashboard de las 3 zonas)</div>'+
      '</div>'+
      '<div id="umodal-err"></div>'+
      '<div class="um-actions">'+
        '<button class="um-cancel" onclick="closeUserModal()">Cancelar</button>'+
        '<button class="um-save" id="umodal-save-btn" onclick="saveUserModal()">Guardar</button>'+
      '</div>'+
    '</div>';
  document.body.appendChild(umod);

  // Modal config JSONBin
  var jmod=document.createElement('div');
  jmod.id='jbin-modal-bg';
  jmod.innerHTML=
    '<div id="jbin-modal">'+
      '<h3 style="font-size:15px;font-weight:700;color:#111827;margin-bottom:.5rem">Configurar JSONBin</h3>'+
      '<p style="font-size:12px;color:#6b7280;margin-bottom:1rem;line-height:1.6">Crea una cuenta gratis en <a href="https://jsonbin.io" target="_blank" style="color:#2563eb">jsonbin.io</a>, crea un BIN con el contenido <code style="background:#f3f4f6;padding:1px 5px;border-radius:4px">{"users":[]}</code> y pega los datos aquí.</p>'+
      '<div class="um-row"><label style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">BIN ID</label><input type="text" id="jbin-bid" placeholder="6650a1f2ad19ca34f8..." style="width:100%;border:1.5px solid #e5e7eb;border-radius:8px;padding:9px 12px;font-size:13px;font-family:Inter,sans-serif;outline:none"/></div>'+
      '<div class="um-row" style="margin-top:10px"><label style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Master API Key</label><input type="password" id="jbin-key" placeholder="$2a$10$..." style="width:100%;border:1.5px solid #e5e7eb;border-radius:8px;padding:9px 12px;font-size:13px;font-family:Inter,sans-serif;outline:none"/></div>'+
      '<div id="jbin-err" style="font-size:11px;color:#dc2626;min-height:14px;margin-top:6px"></div>'+
      '<div style="display:flex;gap:8px;margin-top:1.25rem;justify-content:flex-end">'+
        '<button onclick="closeJsonbinConfig()" style="padding:8px 16px;border:1.5px solid #e5e7eb;border-radius:8px;background:none;font-size:13px;cursor:pointer;color:#6b7280;font-family:Inter,sans-serif">Cancelar</button>'+
        '<button id="jbin-save-btn" onclick="saveJsonbinConfig()" style="padding:8px 20px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif">Conectar</button>'+
      '</div>'+
    '</div>';
  document.body.appendChild(jmod);
}

// ── GUARDIA DE PERMISOS ──
window.addEventListener('load', function() {
  // Cargar JSONBin config guardada
  var bid=localStorage.getItem('mce_jbin_id'), bkey=localStorage.getItem('mce_jbin_key');
  if(bid) JSONBIN_BIN_ID=bid;
  if(bkey) JSONBIN_API_KEY=bkey;

  if(typeof crearTicket==='function'){
    var _oc=crearTicket;
    crearTicket=function(){if(!authCan('crear')){if(typeof showToast==='function')showToast('Sin permiso para crear tickets.','err');return;}_oc();};
  }
  if(typeof cerrarTicket==='function'){
    var _ocl=cerrarTicket;
    cerrarTicket=function(){if(!authCan('cerrar')){if(typeof showToast==='function')showToast('Sin permiso para cerrar tickets.','err');return;}_ocl();};
  }
  if(typeof guardarEdit==='function'){
    var _oe=guardarEdit;
    guardarEdit=function(){if(!authCan('editar')){if(typeof showToast==='function')showToast('Sin permiso para editar tickets.','err');return;}_oe();};
  }
  authInit();
});
// ── GESTIÓN DE ZONAS ──
function actualizarBotonesZona() {
  if (typeof ZONAS === 'undefined') return;
  Object.keys(ZONAS).forEach(function(z) {
    var btn = document.getElementById('zona-btn-' + z);
    if (!btn) return;
    var activo = (z === zonaActiva);
    btn.style.background  = activo ? '#2563eb' : '';
    btn.style.color       = activo ? '#fff'     : '';
    btn.style.borderColor = activo ? '#2563eb'  : 'var(--border)';
  });
}

function cambiarZona(zona) {
  if (!ZONAS[zona] || zona === zonaActiva) return;
  aplicarZona(zona);
  if (typeof _actualizarDatosZona === 'function') _actualizarDatosZona();
  actualizarBotonesZona();
  // Limpiar caché de la zona anterior
  localStorage.removeItem('inc_data');
  localStorage.removeItem('inc_monitoreo');
  localStorage.removeItem('inc_last_tickets');
  if (typeof tickets !== 'undefined') tickets = [];
  if (typeof monitoreoData !== 'undefined') monitoreoData = null;
  var m = document.getElementById('auth-user-menu');
  if (m) m.style.display = 'none';
  if (typeof showToast === 'function') showToast('Zona: ' + ZONAS[zona].nombre + ' ✓', 'ok');
  if (typeof loadFromSheet === 'function') loadFromSheet(true);
  if (typeof populateMonitorSelects === 'function') populateMonitorSelects();
}
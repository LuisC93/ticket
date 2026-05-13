// config.js

// config.js — Estado global y configuración

// ── STATE ──
var CFG=JSON.parse(localStorage.getItem('inc_cfg')||'{}');
var tickets=JSON.parse(localStorage.getItem('inc_data')||'[]');
var activeFilter='all', monFilter='all', dayFilter='today', tecDayFilter='today';
var activeIdx=null;

function saveLocal(){localStorage.setItem('inc_data',JSON.stringify(tickets));}

// ── DATE HELPERS ──
function todayISO(){
  // El Salvador = GMT-6
  var sv = new Date(new Date().getTime() - (6*60*60*1000));
  return sv.toISOString().slice(0,10);
}
function svNow(){
  var sv = new Date(new Date().getTime() - (6*60*60*1000));
  var h = sv.getUTCHours(), m = sv.getUTCMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if(h===0) h=12;
  return { h: String(h), m: String(m).padStart(2,'0'), ampm: ampm };
}

// tickets.js — Helpers de fecha/hora y lógica de tickets
// app.js

(function(){
  var days=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  var months=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  var now=new Date();
  document.getElementById('today-label').textContent=days[now.getDay()]+', '+now.getDate()+' '+months[now.getMonth()]+' '+now.getFullYear();
  document.getElementById('f-fecha').value=todayISO();
  // Set hora to current El Salvador time
  var now = svNow();
  var hEl = document.getElementById('f-hora-h');
  var mEl = document.getElementById('f-hora-m');
  var pEl = document.getElementById('f-hora-ampm');
  if(hEl) hEl.value = now.h;
  if(mEl) mEl.value = now.m;
  if(pEl) pEl.value = now.ampm;
  loadConfig();
  renderAll();
})();
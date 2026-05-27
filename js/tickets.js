// tickets.js

function fmtHora(v){
  if(!v||v==='--:--'||v==='') return '--:--';
  var s=String(v).trim();
  if(s.indexOf('AM')>-1||s.indexOf('PM')>-1) return s;
  if(s.indexOf('T')>-1){
    var tp=s.split('T')[1].split(':');
    var hh=parseInt(tp[0].slice(-2)), mm=tp[1];
    var ap=hh>=12?'PM':'AM'; hh=hh%12; if(hh===0)hh=12;
    return hh+':'+mm+' '+ap;
  }
  if(s.indexOf(':')>-1){
    var pts=s.slice(0,5).split(':');
    var h24=parseInt(pts[0]), mn=pts[1];
    var ap2=h24>=12?'PM':'AM'; h24=h24%12; if(h24===0)h24=12;
    return h24+':'+mn+' '+ap2;
  }
  return s;
}
function fmtFechaDisplay(v){
  if(!v) return '';
  var s=String(v).trim();
  if(s.indexOf('T')>-1) s=s.split('T')[0];
  if(s.match(/^\d{4}-\d{2}-\d{2}/)){
    var p=s.slice(0,10).split('-');
    return p[2]+'/'+p[1]+'/'+p[0];
  }
  return s.slice(0,10);
}
function fmtFecha(v){
  if(!v) return '';
  var s=String(v).trim();
  if(s.match(/\d{4}-\d{2}-\d{2}/)){var p=s.slice(0,10).split('-');return p[2]+'/'+p[1]+'/'+p[0];}
  return s.slice(0,10);
}
function isoFromTicket(v){
  var s=String(v).trim();
  if(s.match(/\d{4}-\d{2}-\d{2}/)) return s.slice(0,10);
  if(s.match(/\d{2}\/\d{2}\/\d{4}/)){var p=s.split('/');return p[2]+'-'+p[1]+'-'+p[0];}
  return s.slice(0,10);
}
function inRange(fechaStr,filter){
  var now=new Date(); now.setHours(0,0,0,0);
  try{
    var iso=isoFromTicket(fechaStr);
    var p=iso.split('-');
    var d=new Date(parseInt(p[0]),parseInt(p[1])-1,parseInt(p[2]));
    d.setHours(0,0,0,0);
    if(filter==='today') return d.getTime()===now.getTime();
    if(filter==='yesterday'){var y=new Date(now);y.setDate(y.getDate()-1);return d.getTime()===y.getTime();}
    if(filter==='3days'){var f3=new Date(now);f3.setDate(f3.getDate()-2);return d>=f3&&d<=now;}
    if(filter==='week'){var fw=new Date(now);fw.setDate(fw.getDate()-6);return d>=fw&&d<=now;}
    return true;
  }catch(e){return true;}
}
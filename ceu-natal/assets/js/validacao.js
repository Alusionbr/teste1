(function(root){
  'use strict';
  function dataValida(a,m,d){
    if (![a,m,d].every(Number.isInteger) || a<1900 || a>2100) return false;
    var t=new Date(Date.UTC(a,m-1,d));
    return t.getUTCFullYear()===a && t.getUTCMonth()===m-1 && t.getUTCDate()===d;
  }
  function validar(d, nascimento){
    if (!d || !dataValida(d.ano,d.mes,d.dia)) throw new Error('Confira a data informada.');
    if (nascimento && Date.UTC(d.ano,d.mes-1,d.dia)>Date.now()) throw new Error('O nascimento não pode estar no futuro.');
    if (!d.horaDesconhecida && (!Number.isInteger(d.hora)||d.hora<0||d.hora>23||!Number.isInteger(d.minuto)||d.minuto<0||d.minuto>59)) throw new Error('Confira a hora informada.');
    if (!Number.isFinite(d.latitude)||Math.abs(d.latitude)>90||!Number.isFinite(d.longitude)||Math.abs(d.longitude)>180) throw new Error('Confira a cidade informada.');
    if (typeof d.fuso!=='string'||!d.fuso) throw new Error('Selecione uma cidade com fuso horário.');
    try {new Intl.DateTimeFormat('pt-BR',{timeZone:d.fuso}).format(new Date());} catch(e){throw new Error('Fuso horário inválido.');}
    return d;
  }
  function pessoa(p){
    if (!p || typeof p.data!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.data)||!p.cidade) throw new Error('Dados de nascimento incompletos.');
    if (p.hora && !/^\d{2}:\d{2}$/.test(p.hora)) throw new Error('Hora inválida.');
    var d=p.data.split('-').map(Number),h=(p.hora||'12:00').split(':').map(Number);
    validar({ano:d[0],mes:d[1],dia:d[2],hora:h[0],minuto:h[1],horaDesconhecida:!p.hora,latitude:p.cidade.lat,longitude:p.cidade.lon,fuso:p.cidade.fuso},true);
    return p;
  }
  var api={validar:validar,pessoa:pessoa,dataValida:dataValida};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Validacao=api;
})(typeof window!=='undefined'?window:globalThis);

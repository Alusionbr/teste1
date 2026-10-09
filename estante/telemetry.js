"use strict";
(function(root){
  const CODES=new Set(["app_error","unhandled_rejection","local_save","cloud_sync","lyrics_unavailable","source_vagalume","source_lrclib"]);
  let started=false,lastPulse=0,busy=false;
  const reported=new Map();
  async function send(error=null){
    if(!navigator.onLine||!root.ESTANTE_CLOUD||busy)return;
    if(!error&&Date.now()-lastPulse<45000)return;
    busy=true;if(!error)lastPulse=Date.now();
    try{
      await fetch(ESTANTE_CLOUD.url+"/functions/v1/estante-usage",{method:"POST",headers:{"Content-Type":"application/json",apikey:ESTANTE_CLOUD.key},body:JSON.stringify({feature:state.tab,version:APP_VERSION,error}),keepalive:true,signal:AbortSignal.timeout(10000)});
    }catch{}finally{busy=false}
  }
  function report(code){
    if(!CODES.has(code)||(reported.get(code)||0)>Date.now()-300000)return;
    reported.set(code,Date.now());send(code);
  }
  function start(){
    if(started)return;started=true;send();
    setInterval(()=>{if(!document.hidden)send()},60000);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)send()});
    root.addEventListener("online",()=>send());
    root.addEventListener("error",()=>report("app_error"));
    root.addEventListener("unhandledrejection",()=>report("unhandled_rejection"));
    root.addEventListener("estante:diagnostic",e=>report(e.detail));
  }
  root.EstanteTelemetry={report,start};
})(window);

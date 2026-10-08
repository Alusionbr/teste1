"use strict";
(function(root){
  const CODES=new Set(["app_error","unhandled_rejection","local_save","cloud_sync","lyrics_unavailable","source_vagalume","source_lrclib"]);
  let id=crypto.randomUUID(),started=false,lastSent=0,busy=false;
  const reported=new Map();
  async function send(error=null,active=!document.hidden){
    if(!navigator.onLine||!root.ESTANTE_CLOUD||busy)return;
    busy=true;lastSent=Date.now();
    try{
      const headers={"Content-Type":"application/json",apikey:ESTANTE_CLOUD.key};
      await fetch(ESTANTE_CLOUD.url+"/functions/v1/estante-usage",{method:"POST",headers,body:JSON.stringify({id,feature:state.tab,version:APP_VERSION,active,error}),keepalive:true,signal:AbortSignal.timeout(10000)});
    }catch{}finally{busy=false}
  }
  function report(code){
    if(!CODES.has(code)||(reported.get(code)||0)>Date.now()-300000)return;
    reported.set(code,Date.now());send(code);
  }
  function identityChanged(){id=crypto.randomUUID();reported.clear();if(started)send()}
  function start(){
    if(started)return;started=true;send();
    setInterval(()=>{if(!document.hidden&&Date.now()-lastSent>=60000)send()},60000);
    document.addEventListener("visibilitychange",()=>send(null,!document.hidden));
    root.addEventListener("pagehide",()=>send(null,false));
    root.addEventListener("online",()=>send());
    root.addEventListener("error",()=>report("app_error"));
    root.addEventListener("unhandledrejection",()=>report("unhandled_rejection"));
    root.addEventListener("estante:diagnostic",e=>report(e.detail));
  }
  root.EstanteTelemetry={report,start,identityChanged};
})(window);

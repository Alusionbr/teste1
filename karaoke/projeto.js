"use strict";
(()=>{
  const link=document.getElementById("projetoLink"),status=document.getElementById("projetoStatus");
  async function copiar(){
    try{
      if(!navigator.clipboard?.writeText)throw Error("clipboard indisponível");
      await navigator.clipboard.writeText(link.value);status.textContent="Link copiado! Envie para quem vai gostar de cantar com você.";
    }catch{link.focus();link.select();status.textContent="Selecione e copie o link acima para compartilhar."}
  }
  document.getElementById("projetoCopiar").addEventListener("click",copiar);
  document.getElementById("projetoCompartilhar").addEventListener("click",async()=>{
    if(!navigator.share){await copiar();return}
    try{await navigator.share({title:"Karaokê em Casa",text:"Vamos testar este karaokê na próxima festa?",url:link.value});status.textContent="Obrigado por compartilhar o projeto!"}
    catch(e){if(e.name!=="AbortError")await copiar()}
  });
})();

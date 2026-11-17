"use strict";
/* Complementos de UI: sem mudanças em letras, repertórios ou armazenamento. */
(() => {
  const ns="http://www.w3.org/2000/svg";
  const iconOnly=new Set(["menuBtn","prevBtn","nextBtn","topBtn","karaokeSettingsBtn","setlistNew","setlistRename","setlistCopy","setlistDelete","printBtn"]);
  function addIcon(id,symbol){
    const button=document.getElementById(id);
    if(!button||button.querySelector(".ui-icon"))return;
    if(iconOnly.has(id))button.textContent="";
    const svg=document.createElementNS(ns,"svg");
    svg.setAttribute("class","ui-icon");svg.setAttribute("aria-hidden","true");
    const use=document.createElementNS(ns,"use");
    use.setAttribute("href","./assets/ui-icons.svg#"+symbol);
    svg.append(use);button.prepend(svg);
  }
  const icons={
    menuBtn:"menu",prevBtn:"chevron-left",nextBtn:"chevron-right",topBtn:"arrow-up",
    karaokeSettingsBtn:"sliders",transportMoreBtn:"sliders",themeBtn:"palette",
    pasteBtn:"file-plus",sourcesBtn:"database",shareBtn:"share",exportBtn:"download",
    importBtn:"upload",trashBtn:"trash",helpBtn:"help",reportBugBtn:"bug",
    printBtn:"printer",setlistNew:"plus",setlistRename:"pencil",setlistCopy:"copy",
    setlistDelete:"trash",fullscreenBtn:"maximize",editBtn:"pencil",notesBtn:"notebook"
  };
  Object.entries(icons).forEach(([id,name])=>addIcon(id,name));
  const searchButton=document.querySelector("#searchForm button");
  if(searchButton){searchButton.id="searchAction";addIcon("searchAction","search")}

  const themeDialog=document.getElementById("themeDialog");
  const syncTheme=()=>{
    const current=document.documentElement.dataset.theme;
    themeDialog.querySelectorAll("[data-theme]").forEach(b=>{
      const selected=b.dataset.theme===current;
      b.classList.toggle("active",selected);
      b.setAttribute("aria-pressed",String(selected));
    });
  };
  themeDialog.addEventListener("click",event=>{
    if(event.target.closest("button[data-theme]"))syncTheme();
  });
  window.addEventListener("estante:prefs-loaded",syncTheme);
  syncTheme();

  const transport=document.getElementById("transport");
  const transportMore=document.getElementById("transportMoreBtn");
  const actions=document.getElementById("headerActions");
  const headerMore=document.getElementById("headerMoreBtn");
  const closeHeader=()=>{
    actions.classList.remove("expanded");
    headerMore.setAttribute("aria-expanded","false");
  };
  const closeTransport=()=>{
    transport.classList.remove("expanded");
    transportMore.setAttribute("aria-expanded","false");
  };
  headerMore.addEventListener("click",()=>{
    const expanded=actions.classList.toggle("expanded");
    headerMore.setAttribute("aria-expanded",String(expanded));
  });
  transportMore.addEventListener("click",()=>{
    const expanded=transport.classList.toggle("expanded");
    transportMore.setAttribute("aria-expanded",String(expanded));
  });
  actions.querySelectorAll("button").forEach(b=>{
    if(b!==headerMore)b.addEventListener("click",()=>{
      if(window.matchMedia("(max-width:650px)").matches)closeHeader();
    });
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"){closeHeader();closeTransport()}
  });
  window.addEventListener("resize",()=>{
    if(!window.matchMedia("(max-width:650px)").matches){closeHeader();closeTransport()}
  });
})();
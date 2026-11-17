"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
test("três novas aparências e temas antigos continuam disponíveis",()=>{
  const html=read("index.html"),css=read("themes-v2.css"),ui=read("ui.js"),core=read("core.js");
  for(const name of ["palco-premium","biblioteca-clean","hibrido-inteligente"]){
    assert.ok(html.includes('data-theme="'+name+'"'),name);
    assert.ok(css.includes('data-theme="'+name+'"'),name);
  }
  assert.ok(html.includes("Ver temas clássicos"));
  assert.ok(ui.includes('state.theme=p.theme||"hibrido-inteligente"'));
  assert.ok(core.includes("theme:state.theme"));
});
test("menus compactos não removem controles essenciais",()=>{
  const html=read("index.html"),js=read("themes-v2.js"),css=read("themes-v2.css");
  for(const id of ["headerMoreBtn","transportMoreBtn","headerActions","transport","stageBtn","editBtn","notesBtn","scrollBtn","prevBtn","nextBtn"]){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.ok(js.includes("aria-expanded"));
  assert.ok(css.includes("@media(max-width:650px)"));
  assert.ok(css.includes(".transport.expanded"));
});
test("recursos visuais registrados para uso offline",()=>{
  const html=read("index.html"),sw=read("sw.js");
  for(const asset of ["themes-v2.css","themes-v2.js","assets/ui-icons.svg","icon.svg"]){
    assert.ok(sw.includes('"./'+asset+'"'),asset);
  }
  assert.ok(html.includes("themes-v2.css?v="));
  assert.ok(html.includes("themes-v2.js?v="));
});

test("nova aparência vira padrão na primeira atualização e conserva escolhas seguintes",()=>{
  const vm=require("node:vm");
  const html=read("index.html");
  const boot=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
  assert.ok(boot?.includes("estante:theme-default-4.2.1"));

  function bootWith(theme,done=false){
    const prefs={theme,source:"smart",speed:21};
    const data=new Map([["estante:v2:prefs",JSON.stringify(prefs)]]);
    if(done)data.set("estante:theme-default-4.2.1","1");
    const document={documentElement:{dataset:{}}};
    const localStorage={
      getItem:key=>data.get(key)??null,
      setItem:(key,value)=>data.set(key,value)
    };
    vm.runInNewContext(boot,{document,localStorage});
    return {data,document,prefs:JSON.parse(data.get("estante:v2:prefs"))};
  }

  const legacy=bootWith("neon-palco");
  assert.equal(legacy.document.documentElement.dataset.theme,"hibrido-inteligente");
  assert.equal(legacy.prefs.speed,21);
  assert.equal(legacy.data.get("estante:theme-default-4.2.1"),"1");

  const chosen=bootWith("palco-premium");
  assert.equal(chosen.document.documentElement.dataset.theme,"palco-premium");

  const clean=bootWith("biblioteca-clean");
  assert.equal(clean.document.documentElement.dataset.theme,"biblioteca-clean");

  const laterClassic=bootWith("classico-ambar",true);
  assert.equal(laterClassic.document.documentElement.dataset.theme,"classico-ambar");
});

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

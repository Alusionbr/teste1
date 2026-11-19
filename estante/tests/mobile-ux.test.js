"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const base=path.join(__dirname,"..");
const read=name=>fs.readFileSync(path.join(base,name),"utf8");

test("identidade e alto contraste no tema padrão",()=>{
  const html=read("index.html"),css=read("themes-v2.css");
  assert.match(html,/class="brandCopy"/);
  assert.match(html,/class="mobileIdentity"/);
  assert.match(html,/class="betaTag"/);
  assert.match(css,/html\[data-theme="hibrido-inteligente"\]\s*\{/);
  assert.match(css,/color-scheme:dark/);
  assert.match(css,/\.brand \.brandCopy\s*\{display:flex/);
  assert.match(css,/\.brand \.brandCopy \.brandSubtitle\s*\{display:block!important/);
});

test("seleção de letras preserva comandos de palco",()=>{
  const html=read("index.html"),css=read("themes-v2.css"),ui=read("ui.js"),player=read("player.js");
  assert.match(html,/id="selectLyricsBtn"/);
  assert.match(html,/id="copyLyricsSelectionBtn"/);
  assert.match(css,/-webkit-user-select:text/);
  assert.match(ui,/window\.setLyricsSelectionMode/);
  assert.match(ui,/if\(state\.scrolling\)toggleScroll\(\)/);
  assert.match(ui,/if\(state\.syncing\)toggleSync\(\)/);
  assert.match(player,/function tapSyncLine\(i\)\{\s*if\(document\.body\.classList\.contains\("selectingLyrics"\)\)return/);
});

test("formulário usa endpoint existente e categoria permitida",()=>{
  const html=read("index.html"),js=read("bug-report.js");
  assert.match(html,/id="feedbackTab"/);
  assert.match(html,/id="feedbackKind"/);
  assert.match(js,/category: isBug \? category\.value : "other"/);
  assert.match(js,/pxqhpntifbtjaoqtirao\.supabase\.co\/functions\/v1\/estante-bug-report/);
});

test("versões de arquivos seguem em sincronia",()=>{
  const html=read("index.html"),core=read("core.js"),worker=read("sw.js");
  const ver=/const APP_VERSION="([^"]+)"/.exec(core)?.[1];
  assert.ok(ver);
  assert.match(worker,new RegExp('const VERSION = "'+ver.replaceAll(".","\\.")+'"'));
  assert.match(html,new RegExp('data-version="'+ver.replaceAll(".","\\.")+'"'));
  for(const m of html.matchAll(/(?:\.js|\.css)\?v=([^"']+)/g))assert.equal(m[1],ver);
});

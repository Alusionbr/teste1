"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
global.EstanteDomain=require("../domain.js");
const model=require("../cloud-model.js");
test("cloud decision never silently replaces divergent offline edits",()=>{
  assert.equal(model.decision("local","remote","base",true),"conflict");
  assert.equal(model.decision("base","remote","base",true),"download");
  assert.equal(model.decision("local","base","base",true),"upload");
  assert.equal(model.decision("same","same",null,true),"equal");
  assert.equal(model.decision("empty","remote",null,false),"download");
  assert.equal(model.decision("local",null,null,true),"upload");
});
test("canonical cloud hash ignores local write counters and JSONB property ordering",async()=>{
  const a=EstanteDomain.migrate(null);
  a.setlists[0].songs.push(EstanteDomain.normalizeSong({title:"Teste",sectionNotes:{A:"x",B:"y"}}));
  const b=structuredClone(a);b.revision=55;b.updatedAt="2030-01-01";b.setlists[0].songs[0].sectionNotes={B:"y",A:"x"};
  assert.equal(await model.hash(a),await model.hash(b));
  b.setlists[0].songs[0].notes="Nova anotação";
  assert.notEqual(await model.hash(a),await model.hash(b));
});
test("cloud copies strip device settings, tokens and unknown top-level fields",()=>{
  const raw={...EstanteDomain.migrate(null),keyVag:"private",access_token:"private",prefs:{keyYT:"private"}};
  const payload=model.parse(raw);
  assert.equal(payload.keyVag,undefined);assert.equal(payload.access_token,undefined);assert.equal(payload.prefs,undefined);
});
test("rejects malformed or oversized cloud copies before local replacement",()=>{
  for(const value of [null,{},[],{version:9,setlists:[],library:[]},{version:4,setlists:[null],library:[]}])assert.throws(()=>model.parse(value));
  const huge=EstanteDomain.migrate(null);huge.setlists[0].songs=[{lyrics:"x".repeat(model.MAX_BYTES)}];
  assert.throws(()=>model.parse(huge),/2 MB/);
});

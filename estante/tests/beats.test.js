"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const beats = require("../beats.js");
const domain = require("../domain.js");

test("bases prontas incluem uma faixa inteira com viradas e final", () => {
  for (const entry of beats.presets()) {
    const { project } = entry;
    const events = beats.notes(project);
    assert.ok(entry.duration >= 175 && entry.duration <= 185);
    assert.equal(project.sections[0].type, "intro");
    assert.equal(project.sections.at(-1).type, "end");
    assert.ok(events.some(note => project.sections[note.sectionIndex].type === "fill"));
    assert.ok(events.at(-1).time < entry.duration);
    assert.equal(beats.hasHarmony(project), false);
  }
});

test("a escolha do arranjo prevalece e falta de dados não cria uma sugestão falsa", () => {
  const samba = beats.presets().find(entry => entry.genre === "samba");
  const rock = beats.presets().find(entry => entry.genre === "rock");
  const song = { rhythm: "Samba", tags: ["Rock"], genre: "Rock", bpm: 102, duration: 182 };
  assert.match(beats.match(samba, song).reason, /Mesmo estilo · BPM próximo · Duração próxima/);
  assert.equal(beats.match(rock, song), null);
  assert.equal(beats.match(rock, { duration: 180 }), null);
});

test("backup mantém projetos e referências privadas e link compartilhado omite dados locais", () => {
  const setlists = [{ songs: [
    { title: "Pública", backing: { kind: "preset", id: "xote" } },
    { title: "Minha base", backing: { kind: "project", id: "personal" } },
    { title: "Playback", backing: { kind: "import", id: "arquivo", follow: true, offset: 2.5 } }
  ] }];
  const projects = [{ ...beats.create("xote"), id: "personal" }];
  const data = domain.migrate({ setlists, projects });
  assert.equal(data.projects[0].id, "personal");
  assert.equal(data.setlists[0].songs[2].backing.offset, 2.5);
  const shared = domain.packageSetlist(data.setlists[0]).setlist.songs;
  assert.equal(shared[0].backing.id, "xote");
  assert.equal(shared[1].backing, undefined);
  assert.equal(shared[2].backing, undefined);
});

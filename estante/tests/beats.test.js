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

test("cada ritmo tem instrumentos próprios e frases distintas para os trechos", () => {
  const expected = {
    xote: "triangleMute", samba: "surdo", pop: "shaker", rock: "crash", hiphop: "kick808"
  };
  for (const entry of beats.presets()) {
    const { project } = entry;
    const phrase = type => project.tracks[expected[entry.genre]].patterns[type];
    assert.ok(["intro", "base", "full", "fill", "end"].some(type => phrase(type).length));
    assert.notDeepEqual(phrase("base"), phrase("full"));
    const events = beats.notes(project);
    assert.ok(events.some(event => event.id === expected[entry.genre]));
    assert.ok(project.sections.some(part => part.type === "break"));
    assert.ok(events.every(event => event.time >= 0 && event.time < entry.duration));
  }
});

test("variações editadas sobrevivem ao salvamento e ritmos antigos mantêm seus passos", () => {
  const project = beats.create("samba", 3, true);
  project.id = "personal";
  project.tracks.tamborim.patterns.full = [[27, 95]];
  const saved = beats.normalize(project);
  assert.deepEqual(saved.tracks.tamborim.patterns.full, [[27, 95]]);
  const full = beats.notes(saved).filter(event => project.sections[event.sectionIndex].type === "full" && event.id === "tamborim");
  assert.ok(full.length > 0);
  assert.equal(beats.hasHarmony(saved), false);

  const legacy = {
    id: "old", genre: "samba", minutes: 3, bpm: 104,
    tracks: { kick: { enabled: true, volume: 80, steps: [0, 7] } },
    sections: [{ type: "base", bars: 2 }]
  };
  const restored = beats.normalize(legacy);
  assert.deepEqual(restored.tracks.kick.steps, [0, 7]);
  assert.equal(restored.tracks.surdo.enabled, false);
  assert.equal(restored.tracks.kick.patterns, undefined);
});

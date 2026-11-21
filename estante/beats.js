"use strict";

const EstanteBeats = (() => {
  const grooves = typeof EstanteGrooves === "undefined" ? require("./beat-grooves.js") : EstanteGrooves;
  const grooveVersion = 2;
  const instruments = {
    kick: ["Bumbo", "bumbo.mp3", .75],
    snare: ["Caixa", "caixa.mp3", .50],
    hat: ["Chimbal", "chimbal.mp3", .26],
    tambourine: ["Pandeiro", "pandeiro.mp3", .28],
    triangle: ["Triângulo aberto", "triangulo.mp3", .24],
    triangleMute: ["Triângulo abafado", "triangulo.mp3", .23, .085],
    xoteDrum: ["Grave do xote", "xote-grave.mp3", .68],
    xoteRim: ["Baqueta seca", "baqueta.mp3", .46],
    surdo: ["Surdo", "surdo.mp3", .61],
    tamborim: ["Tamborim", "tamborim.mp3", .35],
    shaker: ["Ganzá", "ganza.mp3", .27],
    rim: ["Aro da caixa", "aro.mp3", .43],
    hatOpen: ["Chimbal aberto", "chimbal-aberto.mp3", .24],
    crash: ["Prato de ataque", "prato.mp3", .34],
    tom: ["Tom", "tom.mp3", .57],
    kick808: ["Bumbo 808", "bumbo-808.mp3", .72],
    snare808: ["Caixa 808", "caixa-808.mp3", .51],
    hat808: ["Chimbal 808", "chimbal-808.mp3", .23],
    bass: ["Baixo", null, .48],
    keys: ["Harmonia", null, .24]
  };
  const genres = {
    xote: { name: "Xote", title: "Xote suave", bpm: 90, tracks: { kick: [0, 6, 8, 14], snare: [4, 12], triangle: [0, 2, 4, 6, 8, 10, 12, 14] } },
    samba: { name: "Samba", title: "Samba de ensaio", bpm: 104, tracks: { kick: [0, 4, 7, 8, 12, 15], snare: [3, 6, 10, 13], tambourine: [0, 2, 3, 5, 6, 8, 10, 11, 13, 14] } },
    pop: { name: "Pop", title: "Pop tranquilo", bpm: 82, tracks: { kick: [0, 6, 8, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] } },
    rock: { name: "Rock", title: "Rock de garagem", bpm: 112, tracks: { kick: [0, 2, 8, 10, 11], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] } },
    hiphop: { name: "Hip-hop", title: "Hip-hop relaxado", bpm: 88, tracks: { kick: [0, 3, 7, 10], snare: [4, 12], hat: [0, 2, 6, 8, 10, 12, 14, 15] } },
    bossa: { name: "Bossa nova" },
    jazz: { name: "Jazz" }
  };
  const styles = Object.keys(genres).filter(id => genres[id].tracks);
  const sectionNames = { intro: "Introdução", base: "Base", full: "Variação", fill: "Virada", break: "Respiro", end: "Final" };
  const sectionTypes = Object.keys(sectionNames);
  const keys = ["Dó", "Dó♯", "Ré", "Mi♭", "Mi", "Fá", "Fá♯", "Sol", "Lá♭", "Lá", "Si♭", "Si"];
  const assetRoot = "./assets/acompanhamento/";
  const source = "https://incompetech.com/music/royalty-free/index.html?isrc=";
  const recordings = [
    ["bossa-bossa", "BossaBossa", "bossa", 77, 167, "USUAN1600055"],
    ["local-forecast", "Local Forecast – Slower", "jazz", 77, 200, "USUAN1300011"],
    ["big-rock", "Big Rock", "rock", null, 231, "USUAN1100305"],
    ["griphop", "Griphop", "hiphop", null, 207, "USUAN1100413"]
  ].map(([id, title, genre, bpm, duration, isrc]) => ({
    id, title, genre, bpm, duration, kind: "recording", author: "Kevin MacLeod",
    source: source + isrc, license: "https://creativecommons.org/licenses/by/4.0/",
    changes: "MP3 recomprimido para 96 kbps", url: assetRoot + id + ".mp3"
  }));
  const fold = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const genreAliases = {
    xote: ["xote", "forro", "baiao"], samba: ["samba", "pagode"],
    pop: ["pop", "balada"], rock: ["rock", "rock alternativo", "alternative rock", "hard rock"],
    hiphop: ["hiphop", "hip hop", "hip hop rap", "rap", "trap"],
    bossa: ["bossa", "bossa nova"], jazz: ["jazz"]
  };
  function genreId(value) {
    const label = fold(value);
    return Object.keys(genreAliases).find(id => genreAliases[id].includes(label)) || "";
  }
  function limit(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
  }
  function songBpm(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 40 && n <= 240 ? n : null;
  }
  function arrangement(bpm, minutes, groove = grooveVersion) {
    const bars = Math.round(minutes * bpm / 4);
    const sections = [{ type: "intro", bars: 2 }];
    const phrase = groove === grooveVersion
      ? [["base", 8], ["full", 7], ["fill", 1], ["base", 8], ["break", 2], ["full", 5], ["fill", 1]]
      : [["base", 8], ["full", 7], ["fill", 1]];
    let remaining = bars - 4;
    while (remaining > 0) {
      for (const [type, count] of phrase) {
        if (remaining > 0) sections.push({ type, bars: Math.min(remaining, count) });
        remaining -= Math.min(remaining, count);
      }
    }
    sections.push({ type: "end", bars: 2 });
    return sections;
  }
  function harmonySteps(id, type) {
    if (type === "intro" || type === "break") return [];
    if (type === "end") return id === "bass" ? [0, 8, 16] : [0, 16];
    if (id === "bass") return type === "full" ? [0, 6, 8, 14, 16, 22, 24, 27] : [0, 8, 16, 24];
    return [0, 8, 16, 24];
  }
  function initialTrack(style, groove, id, beatOnly) {
    const harmonic = !instruments[id][1];
    if (groove !== grooveVersion) {
      const steps = style.tracks[id] || (id === "bass" ? [0, 6, 8] : id === "keys" ? [0, 8] : []);
      return { steps: steps.slice(), volume: 80, enabled: Boolean(style.tracks[id] || (!beatOnly && harmonic)) };
    }
    const profile = grooves[style.id];
    const patterns = Object.fromEntries(sectionTypes.map(type => {
      const hits = harmonic ? harmonySteps(id, type).map(step => [step, step % 16 ? 60 : 78]) : profile.parts[type]?.[id] || [];
      return [type, hits.map(hit => hit.slice())];
    }));
    const enabled = harmonic ? !beatOnly : Object.values(patterns).some(hits => hits.length);
    return { patterns, volume: 80, enabled };
  }
  function create(genre = "pop", minutes = 3, beatOnly = false, groove = grooveVersion) {
    if (!styles.includes(genre)) genre = "pop";
    const style = { ...genres[genre], id: genre };
    const tracks = Object.fromEntries(Object.keys(instruments).map(id => [id, initialTrack(style, groove, id, beatOnly)]));
    return { id: "", title: beatOnly ? style.title : "Minha trilha de " + style.name, genre, groove,
      bpm: style.bpm, key: 0, minutes, percussion: true, tracks, sections: arrangement(style.bpm, minutes, groove) };
  }
  function normalizedPhrase(hits) {
    const byStep = new Map();
    if (Array.isArray(hits)) {
      for (const hit of hits.slice(0, 32)) {
        if (!Array.isArray(hit)) continue;
        const [step, velocity] = hit;
        if (Number.isInteger(step) && step >= 0 && step < 32) byStep.set(step, limit(velocity, 1, 100, 78));
      }
    }
    return [...byStep].sort((a, b) => a[0] - b[0]);
  }
  function editedPatterns(track) {
    return Object.fromEntries(sectionTypes.map(type => [type, normalizedPhrase(track.patterns?.[type])]));
  }
  function normalize(raw) {
    if (!raw || typeof raw !== "object" || !raw.id || !styles.includes(raw.genre)) return null;
    const mins = limit(raw.minutes, 2, 4, 3);
    const groove = raw.groove === grooveVersion ? grooveVersion : 0;
    const project = create(raw.genre, mins, false, groove);
    project.id = String(raw.id).slice(0, 80);
    project.title = String(raw.title || project.title).trim().slice(0, 80) || project.title;
    project.bpm = limit(raw.bpm, 50, 180, project.bpm);
    project.key = limit(raw.key, 0, 11, 0);
    project.percussion = raw.percussion !== false;
    for (const id of Object.keys(instruments)) {
      const track = raw.tracks?.[id];
      if (!track || (groove ? !track.patterns : !Array.isArray(track.steps))) continue;
      const notes = groove ? { patterns: editedPatterns(track) } : {
        steps: [...new Set(track.steps.filter(n => Number.isInteger(n) && n >= 0 && n < 16))].sort((a, b) => a - b)
      };
      project.tracks[id] = { ...notes, enabled: track.enabled === true, volume: limit(track.volume, 0, 100, 80) };
    }
    if (Array.isArray(raw.sections)) {
      const sections = raw.sections.slice(0, 48).filter(part => part && Object.hasOwn(sectionNames, part.type))
        .map(part => ({ type: part.type, bars: limit(part.bars, 1, 16, 1) }));
      if (sections.length) project.sections = sections;
    }
    if (duration(project) > 300) project.sections = arrangement(project.bpm, project.minutes, project.groove);
    return project;
  }
  function duration(project) {
    return project.sections.reduce((count, section) => count + section.bars, 0) * 240 / project.bpm;
  }
  function hasHarmony(project) {
    return hasTrack(project, "bass") || hasTrack(project, "keys");
  }
  function hasTrack(project, id) {
    const track = project.tracks[id];
    if (!track?.enabled || !track.volume || (instruments[id][1] && !project.percussion)) return false;
    return track.patterns ? Object.values(track.patterns).some(hits => hits.length > 0) : track.steps.length > 0;
  }
  function presets() {
    return styles.map(genre => {
      const project = create(genre, 3, true);
      return { id: genre, title: project.title, genre, bpm: project.bpm, duration: duration(project), kind: "preset", description: grooves[genre].description, project };
    });
  }
  function match(entry, song) {
    const explicit = genreId(song?.rhythm);
    const tagged = (song?.tags || []).map(genreId).filter(Boolean);
    const known = explicit ? [explicit] : tagged.length ? tagged : [genreId(song?.genre)].filter(Boolean);
    if (!known.includes(entry.genre)) return null;
    const reasons = ["Mesmo estilo"];
    let score = 1;
    const bpm = songBpm(song?.bpm);
    if (bpm && entry.bpm && Math.abs(bpm - entry.bpm) <= 10) { score += 2; reasons.push("BPM próximo"); }
    if (song?.duration && Math.abs(song.duration - entry.duration) <= 25) { score++; reasons.push("Duração próxima"); }
    return { score, reason: reasons.join(" · ") };
  }
  function legacyNotes(project) {
    const result = [];
    const seconds = 15 / project.bpm;
    const roots = project.genre === "samba" || project.genre === "hiphop" ? [0, 3, 7, 5] : [0, 7, 9, 5];
    let bar = 0;
    project.sections.forEach((section, sectionIndex) => {
      for (let sub = 0; sub < section.bars; sub++, bar++) {
        const root = roots[bar % roots.length] + project.key;
        for (const [id, details] of Object.entries(instruments)) {
          if (!hasTrack(project, id)) continue;
          if (section.type === "intro" && (id === "snare" || id === "bass")) continue;
          const steps = new Set(project.tracks[id].steps);
          if (section.type === "full" && id === "hat") { steps.add(7); steps.add(15); }
          if (section.type === "fill" && id === "snare") [9, 10, 13, 15].forEach(n => steps.add(n));
          for (const step of steps) {
            if (section.type === "end" && sub === section.bars - 1 && step !== 0) continue;
            if (section.type === "intro" && sub === 0 && step % 4 !== 0) continue;
            const amount = details[2] * project.tracks[id].volume / 100;
            const accent = step % 4 === 0 ? 1 : .63 + ((step + bar * 7) % 5) * .052;
            const swing = ["hiphop", "samba"].includes(project.genre) && step % 2 ? seconds * .12 : 0;
            const major = project.genre !== "samba" && project.genre !== "hiphop" ? [0, 7, 5].includes(roots[bar % roots.length]) : roots[bar % roots.length] !== 0;
            result.push({ id, time: (bar * 16 + step) * seconds + swing, level: amount * accent, root, major, sectionIndex,
              length: (id === "keys" ? 6 : 3) * seconds });
          }
        }
      }
    });
    return result.sort((a, b) => a.time - b.time);
  }
  function notes(project) {
    if (project.groove !== grooveVersion) return legacyNotes(project);
    const events = [];
    const { feel } = grooves[project.genre];
    const seconds = 15 / project.bpm;
    const minor = project.genre === "samba" || project.genre === "hiphop";
    const roots = minor ? [0, 3, 7, 5] : [0, 7, 9, 5];
    const audible = Object.entries(instruments).filter(([id]) => hasTrack(project, id));
    let bar = 0;
    project.sections.forEach((section, sectionIndex) => {
      for (let sub = 0; sub < section.bars; sub++, bar++) {
        const measure = sub % 2;
        const root = roots[bar % 4] + project.key;
        const major = minor ? roots[bar % 4] !== 0 : roots[bar % 4] !== 9;
        audible.forEach(([id, details], index) => {
          const track = project.tracks[id];
          for (const [position, velocity] of track.patterns[section.type]) {
            if (Math.floor(position / 16) !== measure) continue;
            const step = position % 16;
            // Stable offsets keep playback and repeated WAV exports in time.
            const variation = ((step * 17 + bar * 13 + index * 7) % 11 - 5) / 5;
            const swing = step % 2 ? seconds * feel.swing : 0;
            const backbeat = /^(snare|rim)/.test(id) ? feel.laidBack || 0 : 0;
            const time = (bar * 16 + step) * seconds
              + Math.max(-step * seconds, swing + feel.human * variation + backbeat);
            const level = details[2] * track.volume / 100 * velocity / 100 * (1 + variation * .035);
            const rate = id === "tom" ? 1.18 - (step % 4) * .095 : 1 + variation * .014;
            events.push({ id, time, level, rate, root, major, sectionIndex, length: (id === "keys" ? 6 : 3) * seconds });
          }
        });
      }
    });
    return events.sort((a, b) => a.time - b.time);
  }
  async function loadKit(ctx, events) {
    const used = new Set(events.map(event => instruments[event.id][1]).filter(Boolean));
    return Object.fromEntries(await Promise.all([...used].map(async file => {
      const response = await fetch(assetRoot + file);
      if (!response.ok) throw Error("Não foi possível carregar os instrumentos.");
      return [file, await ctx.decodeAudioData(await response.arrayBuffer())];
    })));
  }
  function schedule(ctx, output, kit, event, time) {
    const gain = ctx.createGain();
    gain.connect(output);
    const [, file, , cutoff] = instruments[event.id];
    if (file) {
      const sample = ctx.createBufferSource();
      sample.buffer = kit[file];
      sample.playbackRate.value = event.rate || 1;
      gain.gain.setValueAtTime(event.level, time);
      if (cutoff) {
        gain.gain.setValueAtTime(event.level, time + cutoff * .70);
        gain.gain.linearRampToValueAtTime(0, time + cutoff);
      }
      sample.connect(gain);
      sample.onended = () => { sample.disconnect(); gain.disconnect(); };
      sample.start(time);
      if (cutoff) sample.stop(time + cutoff);
      return [sample];
    }
    const oscillators = (event.id === "bass" ? [0] : [0, event.major ? 4 : 3, 7]).map(interval => {
      const voice = ctx.createOscillator();
      voice.type = event.id === "bass" ? "sine" : "triangle";
      voice.frequency.value = 440 * 2 ** (((event.id === "bass" ? 36 : 60) + event.root + interval - 69) / 12);
      voice.connect(gain);
      voice.start(time);
      voice.stop(time + event.length + .015);
      return voice;
    });
    const peak = event.level / oscillators.length;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + .012);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, peak * .3), time + event.length * .65);
    gain.gain.linearRampToValueAtTime(0, time + event.length);
    oscillators[0].onended = () => { oscillators.forEach(voice => voice.disconnect()); gain.disconnect(); };
    return oscillators;
  }
  function wav(buffer) {
    const pcm = buffer.getChannelData(0);
    const file = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(file);
    const tag = (start, value) => [...value].forEach((char, index) => view.setUint8(start + index, char.charCodeAt(0)));
    tag(0, "RIFF"); view.setUint32(4, file.byteLength - 8, true); tag(8, "WAVE");
    tag(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * 2, true); view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); tag(36, "data"); view.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 32767, true);
    return new Blob([file], { type: "audio/wav" });
  }
  function level(project) {
    if (project?.groove !== grooveVersion) return .55;
    const profile = grooves[project.genre].feel.gain;
    return hasHarmony(project) ? Math.min(profile, .80) : profile;
  }
  function connectOutput(ctx, gain) {
    const guard = ctx.createDynamicsCompressor();
    guard.threshold.value = -4;
    guard.knee.value = 0;
    guard.ratio.value = 12;
    guard.attack.value = .002;
    guard.release.value = .10;
    gain.connect(guard);
    guard.connect(ctx.destination);
  }
  async function render(project) {
    const Audio = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!Audio) throw Error("Este navegador não permite exportar áudio.");
    const events = notes(project);
    if (!events.length) throw Error("Ligue pelo menos um instrumento com notas para exportar.");
    const length = duration(project);
    const ctx = new Audio(1, Math.ceil(length * 44100), 44100);
    const kit = await loadKit(ctx, events);
    const gain = ctx.createGain();
    const outputLevel = level(project);
    gain.gain.setValueAtTime(outputLevel, 0);
    gain.gain.setValueAtTime(outputLevel, Math.max(0, length - .18));
    gain.gain.linearRampToValueAtTime(0, length);
    connectOutput(ctx, gain);
    events.forEach(event => schedule(ctx, gain, kit, event, event.time));
    return wav(await ctx.startRendering());
  }
  return { instruments, genres, styles, sectionNames, keys, recordings, fold, genreId, songBpm,
    create, arrangement, normalize, duration, hasHarmony, presets, match, notes, loadKit, schedule, level, connectOutput, render };
})();
if (typeof module !== "undefined" && module.exports) module.exports = EstanteBeats;

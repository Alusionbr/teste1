"use strict";

const EstanteBeats = (() => {
  const instruments = {
    kick: ["Bumbo", "bumbo.mp3", .75],
    snare: ["Caixa", "caixa.mp3", .50],
    hat: ["Chimbal", "chimbal.mp3", .26],
    tambourine: ["Pandeiro", "pandeiro.mp3", .28],
    triangle: ["Triângulo", "triangulo.mp3", .24],
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
  const sectionNames = { intro: "Introdução", base: "Base", full: "Variação", fill: "Virada", end: "Final" };
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
  function arrangement(bpm, minutes) {
    const bars = Math.round(minutes * bpm / 4);
    const sections = [{ type: "intro", bars: 2 }];
    let remaining = bars - 4;
    while (remaining > 0) {
      for (const [type, count] of [["base", 8], ["full", 7], ["fill", 1]]) {
        if (remaining > 0) sections.push({ type, bars: Math.min(remaining, count) });
        remaining -= Math.min(remaining, count);
      }
    }
    sections.push({ type: "end", bars: 2 });
    return sections;
  }
  function create(genre = "pop", minutes = 3, beatOnly = false) {
    if (!styles.includes(genre)) genre = "pop";
    const style = genres[genre];
    const tracks = Object.fromEntries(Object.entries(instruments).map(([id]) => [id, {
      steps: (style.tracks[id] || (id === "bass" ? [0, 6, 8] : id === "keys" ? [0, 8] : [])).slice(),
      volume: 80,
      enabled: Boolean(style.tracks[id] || (!beatOnly && !instruments[id][1]))
    }]));
    return { id: "", title: beatOnly ? style.title : "Minha trilha de " + style.name, genre,
      bpm: style.bpm, key: 0, minutes, percussion: true, tracks, sections: arrangement(style.bpm, minutes) };
  }
  function normalize(raw) {
    if (!raw || typeof raw !== "object" || !raw.id || !styles.includes(raw.genre)) return null;
    const mins = limit(raw.minutes, 2, 4, 3);
    const project = create(raw.genre, mins);
    project.id = String(raw.id).slice(0, 80);
    project.title = String(raw.title || project.title).trim().slice(0, 80) || project.title;
    project.bpm = limit(raw.bpm, 50, 180, project.bpm);
    project.key = limit(raw.key, 0, 11, 0);
    project.percussion = raw.percussion !== false;
    for (const id of Object.keys(instruments)) {
      const track = raw.tracks?.[id];
      if (!track || !Array.isArray(track.steps)) continue;
      project.tracks[id] = {
        enabled: track.enabled === true,
        volume: limit(track.volume, 0, 100, 80),
        steps: [...new Set(track.steps.filter(n => Number.isInteger(n) && n >= 0 && n < 16))].sort((a, b) => a - b)
      };
    }
    if (Array.isArray(raw.sections)) {
      const sections = raw.sections.slice(0, 48).filter(part => part && Object.hasOwn(sectionNames, part.type))
        .map(part => ({ type: part.type, bars: limit(part.bars, 1, 16, 1) }));
      if (sections.length) project.sections = sections;
    }
    if (duration(project) > 300) project.sections = arrangement(project.bpm, project.minutes);
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
    return track.enabled && track.volume > 0 && track.steps.length > 0 && (!instruments[id][1] || project.percussion);
  }
  function presets() {
    return styles.map(genre => {
      const project = create(genre, 3, true);
      return { id: genre, title: project.title, genre, bpm: project.bpm, duration: duration(project), kind: "preset", project };
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
  function notes(project) {
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
    const file = instruments[event.id][1];
    if (file) {
      const sample = ctx.createBufferSource();
      sample.buffer = kit[file];
      gain.gain.value = event.level;
      sample.connect(gain);
      sample.onended = () => { sample.disconnect(); gain.disconnect(); };
      sample.start(time);
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
  async function render(project) {
    const Audio = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!Audio) throw Error("Este navegador não permite exportar áudio.");
    const events = notes(project);
    if (!events.length) throw Error("Ligue pelo menos um instrumento com notas para exportar.");
    const length = duration(project);
    const ctx = new Audio(1, Math.ceil(length * 44100), 44100);
    const kit = await loadKit(ctx, events);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(.55, 0);
    gain.gain.setValueAtTime(.55, Math.max(0, length - .18));
    gain.gain.linearRampToValueAtTime(0, length);
    gain.connect(ctx.destination);
    events.forEach(event => schedule(ctx, gain, kit, event, event.time));
    return wav(await ctx.startRendering());
  }
  return { instruments, genres, styles, sectionNames, keys, recordings, fold, genreId, songBpm,
    create, arrangement, normalize, duration, hasHarmony, presets, match, notes, loadKit, schedule, render };
})();
if (typeof module !== "undefined" && module.exports) module.exports = EstanteBeats;

"use strict";

const EstanteBackingAudio = (() => {
  let database;
  const available = new Set();

  function openDb() {
    if (!database) {
      database = new Promise((resolve, reject) => {
        const request = indexedDB.open("estante-audio", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("files");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(Error("Não foi possível abrir os arquivos de áudio."));
      }).catch(error => { database = undefined; throw error; });
    }
    return database;
  }

  async function access(mode, operation) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("files", mode);
      const request = operation(transaction.objectStore("files"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error || Error("Não foi possível guardar o áudio."));
    });
  }

  async function refreshAvailable() {
    const keys = await access("readonly", store => store.getAllKeys());
    available.clear();
    keys.forEach(key => available.add(key));
  }

  async function storeFile(kind, id, file) {
    const key = kind + ":" + id;
    await access("readwrite", store => store.put(file, key));
    available.add(key);
  }

  function getFile(kind, id) {
    return access("readonly", store => store.get(kind + ":" + id));
  }

  async function download(entry) {
    const response = await fetch(entry.url);
    if (!response.ok) throw Error("Não foi possível baixar esta faixa.");
    await storeFile(entry.kind, entry.id, await response.blob());
  }

  function offline(entry) {
    return Boolean(entry?.project || (entry && available.has(entry.kind + ":" + entry.id)));
  }

  function attachAudio(audio, url) {
    return new Promise((resolve, reject) => {
      function done() {
        audio.removeEventListener("loadedmetadata", loaded);
        audio.removeEventListener("error", failed);
        clearTimeout(timeout);
      }
      function loaded() {
        done();
        if (Number.isFinite(audio.duration) && audio.duration > 0) resolve(audio.duration);
        else reject(Error("O arquivo não tem uma duração válida."));
      }
      function failed() {
        done();
        reject(Error("Este navegador não conseguiu abrir o áudio. Tente um MP3, WAV ou M4A."));
      }
      const timeout = setTimeout(failed, 12000);
      audio.addEventListener("loadedmetadata", loaded);
      audio.addEventListener("error", failed);
      audio.preload = "metadata";
      audio.src = url;
    });
  }

  async function inspectFile(file) {
    const validType = /^audio\/(mpeg|mp3|wav|wave|x-wav|vnd\.wave|mp4|x-m4a|m4a)$/i.test(file.type);
    if (!validType && !/\.(mp3|wav|m4a)$/i.test(file.name)) throw Error("Escolha um arquivo MP3, WAV ou M4A.");
    if (!file.size || file.size > 100 * 1024 * 1024) throw Error("Escolha um arquivo de áudio de até 100 MB.");
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    try { return await attachAudio(audio, url); }
    finally { audio.removeAttribute("src"); audio.load(); URL.revokeObjectURL(url); }
  }

  function createPlayer(onChange, onError) {
    let entry, native, mediaNode, mediaGain, objectUrl, ctx, timer, bus, playing, pending, epoch = 0, volume = .72;
    let position = 0, anchor = 0, sources = new Set(), kitPromise, refreshSequence;
    const clock = () => native?.currentTime ?? (playing && ctx ? Math.max(0, ctx.currentTime - anchor) : position);
    const total = () => Number.isFinite(native?.duration) ? native.duration : entry?.duration || 0;
    const snapshot = () => ({ entry, playing: Boolean(playing), pending: Boolean(pending), position: clock(), duration: total() });
    const change = () => onChange(snapshot());

    function clearScheduled() {
      clearInterval(timer);
      refreshSequence = null;
      sources.forEach(source => { try { source.stop(); } catch {} });
      sources.clear();
    }

    function pause() {
      epoch++;
      position = clock();
      pending = playing = false;
      clearScheduled();
      native?.pause();
      change();
    }

    function stop() {
      pause();
      if (native) {
        mediaNode?.disconnect();
        mediaGain?.disconnect();
        mediaNode = mediaGain = null;
        native.removeAttribute("src");
        native.load();
        native = null;
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
      position = 0;
      entry = null;
      change();
    }

    function setVolume(value) {
      volume = Math.max(0, Math.min(1, value));
      if (mediaGain) mediaGain.gain.value = volume;
      else if (native) native.volume = volume;
      if (bus) bus.gain.value = volume * EstanteBeats.level(entry?.project);
    }

    function ends() {
      pause();
      position = 0;
      if (native) native.currentTime = 0;
      change();
    }

    function audioContext() {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return null;
      if (!ctx) {
        ctx = new Audio();
        bus = ctx.createGain();
        EstanteBeats.connectOutput(ctx, bus);
        setVolume(volume);
      }
      return ctx;
    }

    function playProject(startAt, token) {
      if (!audioContext()) throw Error("Este navegador não consegue tocar trilhas editáveis.");
      setVolume(volume);
      const resume = ctx.resume();
      let events = EstanteBeats.notes(entry.project);
      if (!events.length) {
        resume.catch(() => {});
        throw Error("Ligue pelo menos um instrumento com notas.");
      }
      if (!kitPromise) {
        const fullKit = Object.entries(EstanteBeats.instruments).filter(([, details]) => details[1]).map(([id]) => ({ id }));
        kitPromise = EstanteBeats.loadKit(ctx, fullKit).catch(error => { kitPromise = null; throw error; });
      }
      return Promise.all([resume, kitPromise]).then(([, kit]) => {
        if (token !== epoch) return;
        pending = false;
        playing = true;
        anchor = ctx.currentTime + .04 - startAt;
        const lookAhead = .16;
        const nextAt = time => {
          const index = events.findIndex(event => event.time >= time);
          return index < 0 ? events.length : index;
        };
        let index = nextAt(startAt);
        refreshSequence = () => {
          events = EstanteBeats.notes(entry.project);
          index = nextAt(ctx.currentTime - anchor + lookAhead);
        };
        function queue() {
          const now = ctx.currentTime;
          if (now - anchor >= total()) { ends(); return; }
          while (index < events.length && events[index].time + anchor < now + lookAhead) {
            const event = events[index++];
            if (event.time + anchor < now - .03) continue;
            for (const source of EstanteBeats.schedule(ctx, bus, kit, event, Math.max(now, event.time + anchor))) {
              sources.add(source);
              source.addEventListener("ended", () => sources.delete(source), { once: true });
            }
          }
          change();
        }
        timer = setInterval(queue, 35);
        queue();
      });
    }

    async function playNative(token) {
      const graph = audioContext();
      const resumed = graph?.resume().catch(() => {});
      if (!native) {
        const current = entry;
        let url = current.url;
        if (offline(current) || current.kind === "import") {
          const blob = current.file || await getFile(current.kind, current.id);
          if (token !== epoch) return;
          if (blob) url = objectUrl = URL.createObjectURL(blob);
          else available.delete(current.kind + ":" + current.id);
        }
        if (!url) throw Error("Localize o arquivo de playback neste aparelho.");
        const audio = new Audio(url);
        native = audio;
        if (graph) {
          mediaNode = graph.createMediaElementSource(audio);
          mediaGain = graph.createGain();
          mediaNode.connect(mediaGain).connect(graph.destination);
        }
        setVolume(volume);
        audio.addEventListener("error", () => {
          if (native !== audio || !playing) return;
          pause();
          onError("O áudio foi interrompido. Tente reproduzir novamente.");
        });
        audio.addEventListener("timeupdate", () => { if (native === audio) change(); });
        audio.addEventListener("ended", () => { if (native === audio) ends(); });
        await audio.play();
        if (token !== epoch) return;
        if (position) audio.currentTime = position;
      } else {
        await native.play();
        if (token !== epoch) return;
      }
      await resumed;
      if (token !== epoch) return;
      pending = false;
      playing = true;
      change();
    }

    async function play(next = entry, startAt = 0) {
      if (!next) return;
      if (entry !== next) { stop(); entry = next; position = startAt; }
      if (playing || pending) return;
      const token = ++epoch;
      pending = true;
      change();
      try {
        if (entry.project) await playProject(position, token);
        else await playNative(token);
      } catch (error) {
        if (token !== epoch) return;
        pause();
        onError(error.name === "NotAllowedError" ? "Toque em Reproduzir para liberar o áudio." : (error.message || "Não foi possível tocar esta base."));
      }
    }

    function seek(to) {
      if (!entry) return;
      const next = Math.min(Math.max(0, to), total() || 0);
      if (native) { native.currentTime = next; change(); return; }
      const restart = playing || pending;
      pause();
      position = next;
      if (restart) play();
      else change();
    }

    function projectChanged(project) {
      if (entry?.project !== project) return;
      entry.duration = EstanteBeats.duration(project);
      refreshSequence?.();
      setVolume(volume);
      change();
    }

    return { snapshot, play, pause, stop, seek, setVolume, projectChanged };
  }
  return { refreshAvailable, storeFile, getFile, download, offline, inspectFile, createPlayer };
})();

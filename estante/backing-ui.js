"use strict";

const EstanteBacking = (() => {
  const beats = EstanteBeats;
  const files = EstanteBackingAudio;
  const dialog = $("backingDialog");
  const views = { catalog: "backingCatalog", import: "backingImport", editor: "backingEditor" };
  const publicEntries = [...beats.presets(), ...beats.recordings];
  const filterIds = ["backingGenre", "backingKind", "backingTempo", "backingLength"];
  let view = "catalog", selected, editing, loadedImport, activeSync, preview = false;
  const downloadPending = new Set();
  let exporting = false, syncing = false, scrubbing = false;

  function button(label, onClick) {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.onclick = onClick;
    return element;
  }

  function options(select, entries) {
    select.replaceChildren(...entries.map(([value, title]) => new Option(title, value)));
  }

  function status(message = "") {
    $("backingStatus").hidden = !message;
    $("backingStatus").textContent = message;
  }

  function report(message) {
    if (dialog.open) status(message);
    else notify(message);
  }

  let lastPlayingKey = "";

  function syncLine(position) {
    if (!activeSync || activeSync.song !== state.current || !state.lrc.length) return;
    const at = position - activeSync.offset;
    highlight(state.lrc.findLastIndex(line => line.t <= at));
  }

  const player = files.createPlayer(({ entry, playing, pending, position, duration }) => {
    $("backingBar").hidden = !entry;
    $("backingBtn").classList.toggle("on", playing);
    $("backingToggle").textContent = playing ? "Pausar" : pending ? "Carregando…" : "Reproduzir";
    $("backingNow").textContent = entry?.title || "";
    $("backingSeek").max = Number.isFinite(duration) ? duration : 0;
    if (!scrubbing) $("backingSeek").value = position;
    $("backingClock").textContent = (fmt(position) || "0:00") + " / " + (fmt(Math.round(duration)) || "0:00");
    const playingKey = entry && (playing || pending) ? entry.kind + ":" + entry.id : "";
    if (playingKey !== lastPlayingKey) {
      lastPlayingKey = playingKey;
      dialog.querySelectorAll("[data-backing-preview]").forEach(control => {
        control.textContent = control.dataset.backingPreview === playingKey ? "Pausar prévia" : "Ouvir prévia";
      });
    }
    const inEditor = entry?.project && entry.project === editing;
    $("beatPreview").textContent = inEditor && (playing || pending) ? "Pausar prévia" : "Ouvir trilha";
    $("backingPlay").textContent = playing && selected && entry?.id === selected.id && entry.kind === selected.kind ? "Pausar" : "Tocar com a letra";
    if (entry) syncLine(position);
  }, report);

  function stop(keepSelection = true) {
    activeSync = null;
    preview = false;
    if (syncing) {
      syncing = false;
      $("scrollBtn").disabled = state.karaoke;
      $("syncBtn").disabled = state.karaoke || !state.lrc.length;
    }
    if (player.snapshot().entry) {
      player.stop();
      if (!state.stage && !state.scrolling && !state.syncing && !state.karaoke) releaseAwake();
    }
    if (!keepSelection) selected = null;
  }

  function setupFollow(entry) {
    activeSync = null;
    if (entry.kind !== "import" || !$("backingFollow").checked || !state.lrc.length || !state.current) {
      if (syncing) stopFollowing();
      return;
    }
    if (state.syncing) toggleSync();
    if (state.scrolling) toggleScroll();
    activeSync = { song: state.current, offset: offset() };
    syncing = true;
    $("syncBtn").disabled = true;
    $("scrollBtn").disabled = true;
  }

  function stopFollowing() {
    activeSync = null;
    syncing = false;
    $("scrollBtn").disabled = state.karaoke;
    $("syncBtn").disabled = state.karaoke || !state.lrc.length;
  }

  function play(entry, asPreview = false) {
    if (!entry) return;
    if (state.karaoke) exitKaraoke();
    const current = player.snapshot();
    if (current.entry === entry && (current.playing || current.pending)) { player.pause(); return; }
    if (current.entry !== entry) stop();
    preview = asPreview;
    if (!asPreview) setupFollow(entry);
    if (!asPreview) keepAwake();
    player.setVolume(Number($("backingVolume").value) / 100);
    player.play(entry);
  }

  function projectEntry(project) {
    return { id: project.id, kind: "project", title: project.title, genre: project.genre,
      duration: beats.duration(project), bpm: project.bpm, project };
  }

  function fromRef(reference) {
    if (!reference) return null;
    if (reference.kind === "import") return { ...reference };
    if (reference.kind === "project") {
      const project = state.projects.find(item => item.id === reference.id);
      return project ? projectEntry(project) : null;
    }
    return publicEntries.find(entry => entry.kind === reference.kind && entry.id === reference.id) || null;
  }

  function refStatus(reference) {
    const entry = fromRef(reference);
    if (!entry || (reference.kind === "import" && !files.offline(entry))) return "Localizar playback";
    if (files.offline(entry)) return "Base offline";
    return "Baixar para offline";
  }

  function meta(entry) {
    const type = entry.kind === "import" ? "Playback do aparelho" : beats.genres[entry.genre]?.name;
    const timing = entry.bpm ? entry.bpm + " BPM" : "";
    return [type, fmt(Math.round(entry.duration)), timing, files.offline(entry) ? "Offline" : ""].filter(Boolean).join(" · ");
  }

  function card(entry, reason) {
    const box = document.createElement("article");
    box.className = "backingCard";
    const title = document.createElement("strong");
    title.textContent = entry.title;
    const description = document.createElement("p");
    description.className = "backingMeta";
    description.textContent = meta(entry);
    box.append(title, description);
    if (reason) {
      const suggested = document.createElement("p");
      suggested.className = "backingMeta";
      suggested.textContent = reason;
      box.append(suggested);
    }
    const actions = document.createElement("div");
    actions.className = "backingActions";
    const choose = button("Escolher", () => {
      select(entry);
      $("backingSelection").scrollIntoView({ block: "nearest" });
      $("backingPlay").focus({ preventScroll: true });
    });
    choose.setAttribute("aria-label", "Escolher " + entry.title);
    actions.append(choose);
    const listen = button("Ouvir prévia", () => { status(); play(entry, true); });
    listen.dataset.backingPreview = entry.kind + ":" + entry.id;
    if (listen.dataset.backingPreview === lastPlayingKey) listen.textContent = "Pausar prévia";
    listen.title = entry.title;
    actions.append(listen);
    if (entry.project) {
      actions.append(button(entry.kind === "preset" ? "Editar uma cópia" : "Editar", () => edit(entry)));
      if (entry.kind === "project") actions.append(button("Duplicar", () => edit(entry, true)));
    }
    if (entry.kind === "recording" && !files.offline(entry)) {
      const download = button("Baixar offline", async () => {
        downloadPending.add(entry.id);
        renderCatalog();
        try {
          await files.download(entry);
          status("Faixa disponível offline neste aparelho.");
          if (state.tab === "rehearsal") renderList();
        } catch (error) { report(error.message || "Não foi possível baixar a faixa."); }
        finally { downloadPending.delete(entry.id); renderCatalog(); }
      });
      download.disabled = downloadPending.has(entry.id);
      if (download.disabled) download.textContent = "Baixando…";
      actions.append(download);
    }
    box.append(actions);
    return box;
  }

  function allowed(entry) {
    const genre = $("backingGenre").value, kind = $("backingKind").value;
    if (genre && entry.genre !== genre) return false;
    if ($("backingOffline").checked && !files.offline(entry)) return false;
    if (kind === "project" && entry.kind !== "project") return false;
    if (kind === "beat" && (!entry.project || beats.hasHarmony(entry.project))) return false;
    if (kind === "harmony" && entry.project && !beats.hasHarmony(entry.project)) return false;
    const duration = Math.round(entry.duration);
    const length = $("backingLength").value;
    if (length && length !== (duration <= 180 ? "short" : duration <= 240 ? "medium" : "long")) return false;
    const speed = $("backingTempo").value;
    if (!speed) return true;
    if (!entry.bpm) return false;
    if (speed === "custom") {
      const a = Number($("backingMin").value) || 40, b = Number($("backingMax").value) || 240;
      return entry.bpm >= Math.min(a, b) && entry.bpm <= Math.max(a, b);
    }
    return speed === (entry.bpm < 90 ? "slow" : entry.bpm < 120 ? "medium" : "fast");
  }

  function renderCatalog() {
    const custom = $("backingTempo").value === "custom";
    $("backingMinLabel").hidden = $("backingMaxLabel").hidden = !custom;
    const entries = [...publicEntries, ...state.projects.map(projectEntry)].filter(allowed);
    const filtering = filterIds.some(id => $(id).value) || $("backingOffline").checked;
    $("backingResultsTitle").textContent = filtering ? "Bases encontradas" : "Todas as bases";
    $("backingReset").hidden = !filtering;
    const results = $("backingResults");
    results.replaceChildren(...entries.map(entry => card(entry)));
    if (!entries.length) results.textContent = "Nenhuma base corresponde a esses filtros.";
    const suggestions = entries.map(entry => ({ entry, ranking: beats.match(entry, state.current) }))
      .filter(item => item.ranking).sort((a, b) => b.ranking.score - a.ranking.score).slice(0, 3);
    $("backingSuggested").hidden = !suggestions.length;
    $("backingSuggestions").replaceChildren(...suggestions.map(({ entry, ranking }) => card(entry, ranking.reason)));
  }

  function resetFilters() {
    filterIds.forEach(id => { $(id).value = ""; });
    $("backingOffline").checked = false;
    renderCatalog();
  }

  function sameReference(ref, entry) {
    return ref && entry && ref.kind === entry.kind && ref.id === entry.id;
  }

  function offset() {
    return Math.max(-120, Math.min(120, Number($("backingOffset").value) || 0));
  }

  function select(entry) {
    selected = entry;
    if (entry && !entry.project && files.offline(entry) && !entry.file) {
      files.getFile(entry.kind, entry.id).then(blob => { if (blob) entry.file = blob; }).catch(() => {});
    }
    const ref = state.current?.backing;
    const saved = sameReference(ref, entry);
    const isImport = entry?.kind === "import";
    $("backingSelection").hidden = !entry;
    $("backingSelectionTitle").textContent = entry?.title || "";
    $("backingSave").disabled = !state.current;
    $("backingRemove").hidden = !saved;
    $("backingSyncOptions").hidden = !isImport || !state.lrc.length;
    $("backingPlay").disabled = isImport && !files.offline(entry);
    $("backingFollow").checked = Boolean(saved && ref.follow);
    $("backingOffset").value = saved ? ref.offset || 0 : 0;
    $("backingAttribution").hidden = true;
    $("backingCredits").hidden = isImport;
    $("backingPlay").textContent = state.current ? "Tocar com a letra" : "Tocar";
  }

  function saveSongFields(fields) {
    const song = state.current;
    if (!song) return false;
    if (state.setlist.some(item => item.kind !== "note" && sameSong(item, song))) {
      persistCurrent(fields);
    } else {
      const record = libraryRecordFor(song);
      if (record?.arrangements.some(item => item.id === song.arrangementId)) {
        state.setlists.forEach(setlist => setlist.songs.forEach(item => {
          if (item.arrangementId === song.arrangementId) fields.forEach(field => { item[field] = song[field]; });
        }));
        syncArrangement(song, fields);
      } else {
        const saved = storedSong(song);
        Object.assign(song, { id: saved.id, songId: saved.songId, arrangementId: saved.arrangementId, kind: saved.kind });
        if (record) syncArrangement(song);
        else state.library.push(EstanteDomain.libraryRecord(song));
      }
    }
    const ok = saveSetlists();
    updateSaveButton();
    if (state.tab !== "results") renderList();
    return ok;
  }

  function saveSelection() {
    if (!selected || !state.current) return;
    const isImport = selected.kind === "import";
    state.current.backing = { kind: selected.kind, id: selected.id, title: selected.title, duration: selected.duration,
      volume: Number($("backingVolume").value), follow: isImport && $("backingFollow").checked, offset: isImport ? offset() : 0 };
    if (saveSongFields(["backing"])) {
      $("backingRemove").hidden = false;
      status("Base salva no arranjo.");
    }
  }

  function selectSaved() {
    const ref = state.current?.backing;
    $("backingVolume").value = ref?.volume ?? 72;
    const entry = fromRef(ref);
    select(entry);

  }

  function renderImport() {
    const entry = loadedImport || (selected?.kind === "import" ? selected : fromRef(state.current?.backing));
    const playback = entry?.kind === "import" ? entry : null;
    $("backingImportLabel").firstChild.textContent = playback && !files.offline(playback) ? "Localizar playback" : "Escolher arquivo de áudio";
    $("backingImported").replaceChildren(...(playback && files.offline(playback) ? [card(playback)] : []));
  }

  async function importFile(file) {
    const song = state.current;
    status("Abrindo áudio…");
    try {
      const duration = await files.inspectFile(file);
      if (state.current !== song) return;
      const ref = song?.backing;
      const relink = ref?.kind === "import" && !files.offline(fromRef(ref));
      const entry = { kind: "import", id: relink ? ref.id : EstanteDomain.uid("audio"),
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "Meu playback", duration, file };
      await files.storeFile(entry.kind, entry.id, file);
      if (state.current !== song) return;
      loadedImport = entry;
      if (relink) {
        Object.assign(song.backing, { title: entry.title, duration });
        saveSongFields(["backing"]);
      }
      select(entry);
      renderImport();
      status(relink ? "Playback localizado e disponível offline." : "Playback pronto para ouvir.");
    } catch (error) { report(error.message || "Não foi possível importar o playback."); }
  }

  function sectionLimits() {
    const maxBars = Math.floor(editing.bpm * 300 / 240);
    return { maxBars, currentBars: editing.sections.reduce((total, part) => total + part.bars, 0) };
  }

  function editorChanged() {
    player.projectChanged(editing);
    $("beatLength").textContent = (fmt(Math.round(beats.duration(editing))) || "0:00") + " de trilha";
  }

  function renderSections() {
    const list = $("beatSections");
    list.replaceChildren();
    editing.sections.forEach((part, i) => {
      const item = document.createElement("li"), row = document.createElement("div");
      row.className = "beatSectionRow";
      const type = document.createElement("select"), count = document.createElement("input");
      options(type, Object.entries(beats.sectionNames));
      type.value = part.type;
      type.setAttribute("aria-label", "Tipo do trecho " + (i + 1));
      type.onchange = () => { part.type = type.value; editorChanged(); };
      count.type = "number"; count.min = "1"; count.max = "16"; count.value = part.bars;
      count.setAttribute("aria-label", "Compassos do trecho " + (i + 1));
      count.onchange = () => {
        const { maxBars, currentBars } = sectionLimits();
        part.bars = Math.max(1, Math.min(16, maxBars - currentBars + part.bars, Math.round(Number(count.value) || 1)));
        count.value = part.bars;
        editorChanged();
      };
      const move = (delta) => {
        [editing.sections[i], editing.sections[i + delta]] = [editing.sections[i + delta], editing.sections[i]];
        editorChanged(); renderSections();
      };
      const up = button("↑", () => move(-1)), down = button("↓", () => move(1));
      up.setAttribute("aria-label", "Subir trecho " + (i + 1)); up.disabled = i === 0;
      down.setAttribute("aria-label", "Descer trecho " + (i + 1)); down.disabled = i === editing.sections.length - 1;
      const remove = button("Remover", () => { editing.sections.splice(i, 1); editorChanged(); renderSections(); });
      remove.disabled = editing.sections.length < 2;
      row.append(type, count, up, down, remove); item.append(row); list.append(item);
    });
  }

  function renderTrack() {
    const track = editing.tracks[$("beatTrack").value];
    $("beatEnabled").checked = track.enabled;
    $("beatVolume").value = track.volume;
    const grid = $("beatGrid");
    grid.replaceChildren(...Array.from({ length: 16 }, (_, i) => {
      const step = button(String(i + 1), () => {
        if (track.steps.includes(i)) track.steps = track.steps.filter(n => n !== i);
        else track.steps.push(i);
        step.setAttribute("aria-pressed", String(track.steps.includes(i)));
        editorChanged();
      });
      step.setAttribute("aria-pressed", String(track.steps.includes(i)));
      step.setAttribute("aria-label", "Batida " + (i + 1));
      return step;
    }));
  }

  function renderEditor() {
    $("beatTitle").value = editing.title;
    $("beatGenre").value = editing.genre;
    $("beatMinutes").value = editing.minutes;
    $("beatPercussion").checked = editing.percussion;
    $("beatBass").checked = editing.tracks.bass.enabled;
    $("beatKeys").checked = editing.tracks.keys.enabled;
    $("beatBpm").value = editing.bpm;
    $("beatKey").value = editing.key;
    $("beatPreview").textContent = "Ouvir trilha";
    $("beatLength").textContent = fmt(Math.round(beats.duration(editing))) + " de trilha";
    $("beatSave").textContent = editing.id ? "Salvar alterações" : "Salvar em Minhas trilhas";
    renderTrack(); renderSections();
  }

  function fresh() {
    const genre = beats.genreId(state.current?.rhythm) || state.current?.tags?.map(beats.genreId).find(Boolean) || beats.genreId(state.current?.genre);
    const project = beats.create(genre, 3);
    const bpm = beats.songBpm(state.current?.bpm);
    if (bpm && bpm >= 50 && bpm <= 180) {
      project.bpm = bpm;
      project.sections = beats.arrangement(bpm, 3);
    }
    return project;
  }

  function setView(next) {
    if (next !== view && preview) stop();
    view = next;
    Object.entries(views).forEach(([name, id]) => { $(id).hidden = name !== view; });
    document.querySelectorAll("[data-backing-view]").forEach(tab => tab.setAttribute("aria-pressed", String(tab.dataset.backingView === view)));
    status();
    if (view === "catalog") renderCatalog();
    if (view === "import") renderImport();
    if (view === "editor") {
      editing ||= fresh();
      renderEditor();
    }
  }

  function edit(entry, copy = entry.kind === "preset") {
    if (preview) stop();
    editing = EstanteDomain.clone(entry.project);
    if (copy) { editing.id = ""; editing.title = "Cópia de " + editing.title; }
    setView("editor");
  }

  function open(next = "catalog") {
    if (!dialog.open) {
      dialog.showModal();
      selectSaved();
      $("backingSongDetails").hidden = !state.current;
      $("backingSongGenre").value = beats.genreId(state.current?.rhythm);
      $("backingSongBpm").value = beats.songBpm(state.current?.bpm) || "";
    }
    setView(next);
    const missing = state.current?.backing;
    if (missing?.kind === "import" && !files.offline(fromRef(missing))) status("Localize o arquivo original para tocar este playback.");
    else if (missing && !fromRef(missing)) status("A base salva não foi encontrada neste aparelho. Escolha outra base.");
  }

  function onSongChange() {
    selected = loadedImport = null;
    if (dialog.open) { selectSaved(); resetFilters(); }
    else {
      filterIds.forEach(id => { $(id).value = ""; });
      $("backingOffline").checked = false;
    }
  }

  function rehearsalButton(song) {
    const label = refStatus(song.backing);
    const control = button(label === "Base offline" ? "▶ Base offline" : label, () => {
      state.currentIndex = state.setlist.indexOf(song);
      const entry = fromRef(song.backing);
      const needsFile = song.backing.kind === "import" && !files.offline(entry);
      const loadingLyrics = openSong(song);
      if (matchMedia("(max-width:900px)").matches) closeSidebar();
      if (needsFile || !entry || !files.offline(entry)) {
        open(needsFile ? "import" : "catalog");
        if (entry) select(entry);
        if (entry?.kind === "recording") status("Toque com a letra ou use Baixar offline no catálogo.");
        return;
      }
      select(entry);
      $("backingVolume").value = song.backing.volume ?? 72;
      play(entry);
      loadingLyrics.then(() => {
        if (state.current !== song || player.snapshot().entry !== entry) return;
        setupFollow(entry);
        syncLine(player.snapshot().position);
      });
    });
    control.className = "backingRehearsal";
    control.setAttribute("aria-label", label + " de " + song.title);
    return control;
  }

  const genreOptions = Object.entries(beats.genres).map(([id, genre]) => [id, genre.name]);
  options($("backingGenre"), [["", "Todos os estilos"], ...genreOptions]);
  options($("backingSongGenre"), [["", "Usar os dados disponíveis"], ...genreOptions]);
  options($("beatGenre"), genreOptions.filter(([id]) => beats.styles.includes(id)));
  options($("beatKey"), beats.keys.map((name, i) => [i, name]));
  options($("beatTrack"), Object.entries(beats.instruments).map(([id, data]) => [id, data[0]]));
  $("backingBtn").onclick = () => open();
  $("backingNow").onclick = () => {
    const entry = player.snapshot().entry;
    open(entry?.kind === "import" ? "import" : "catalog");
    if (entry) select(entry);
  };
  $("backingClose").onclick = () => dialog.close();
  dialog.addEventListener("close", () => { if (preview) stop(); });
  document.querySelectorAll("[data-backing-view]").forEach(tab => { tab.onclick = () => setView(tab.dataset.backingView); });
  [...filterIds, "backingOffline", "backingMin", "backingMax"].forEach(id => { $(id).onchange = renderCatalog; });
  $("backingReset").onclick = resetFilters;
  $("backingFile").onchange = event => {
    const file = event.target.files[0];
    event.target.value = "";
    if (file) importFile(file);
  };
  $("backingSave").onclick = saveSelection;
  $("backingRemove").onclick = () => {
    state.current.backing = null;
    if (saveSongFields(["backing"])) { $("backingRemove").hidden = true; status("Base removida do arranjo."); }
  };
  $("backingPlay").onclick = () => {
    if (!selected) return;
    if (preview) stop();
    play(selected);
    dialog.close();
  };
  $("backingCredits").onclick = () => {
    const credits = $("backingAttribution");
    credits.hidden = !credits.hidden;
    if (credits.hidden || !selected) return;
    const link = (url, label) => Object.assign(document.createElement("a"), { href: url, textContent: label, target: "_blank", rel: "noopener" });
    if (selected.kind === "recording") {
      credits.replaceChildren(selected.title + " · ", link(selected.source, selected.author), " · ",
        link(selected.license, "CC BY 4.0"), " · " + selected.changes);
    } else {
      credits.replaceChildren("Batida editável com sons ", link("https://creativecommons.org/publicdomain/zero/1.0/", "CC0"),
        " de ", link("https://github.com/sfzinstruments/karoryfer.big-rusty-drums", "Karoryfer"), ", ",
        link("https://github.com/sgossner/VCSL", "Versilian Studios"), " e ",
        link("https://freesound.org/people/Ilson_Junior/", "Ilson_Junior"), ".");
    }
  };
  $("backingSongGenre").onchange = event => {
    state.current.rhythm = event.target.value;
    saveSongFields(["rhythm"]);
    renderCatalog();
  };
  $("backingSongBpm").onchange = event => {
    state.current.bpm = beats.songBpm(event.target.value);
    event.target.value = state.current.bpm || "";
    saveSongFields(["bpm"]);
    renderCatalog();
  };
  $("backingFollow").onchange = $("backingOffset").onchange = () => {
    if (!sameReference(player.snapshot().entry, selected)) return;
    setupFollow(selected);
    syncLine(player.snapshot().position);
  };
  $("backingToggle").onclick = () => {
    const current = player.snapshot();
    if (current.playing || current.pending) player.pause();
    else { keepAwake(); player.play(); }
  };
  $("backingStop").onclick = () => stop();
  $("backingSeek").oninput = event => {
    scrubbing = true;
    $("backingClock").textContent = fmt(Number(event.target.value)) || "0:00";
  };
  $("backingSeek").onchange = event => { scrubbing = false; player.seek(Number(event.target.value)); };
  $("backingVolume").oninput = event => player.setVolume(Number(event.target.value) / 100);

  $("beatTitle").oninput = event => { editing.title = event.target.value; };
  $("beatGenre").onchange = event => {
    if (preview) stop();
    const model = beats.create(event.target.value, editing.minutes);
    editing = { ...model, id: editing.id, title: editing.title, key: editing.key, percussion: editing.percussion };
    renderEditor();
  };
  $("beatMinutes").onchange = event => {
    editing.minutes = Number(event.target.value);
    editing.sections = beats.arrangement(editing.bpm, editing.minutes);
    editorChanged(); renderSections();
  };
  $("beatBpm").onchange = event => {
    editing.bpm = Math.max(50, Math.min(180, beats.songBpm(event.target.value) || editing.bpm));
    if (beats.duration(editing) > 300) editing.sections = beats.arrangement(editing.bpm, editing.minutes);
    event.target.value = editing.bpm;
    editorChanged(); renderSections();
  };
  $("beatKey").onchange = event => { editing.key = Number(event.target.value); editorChanged(); };
  $("beatPercussion").onchange = event => { editing.percussion = event.target.checked; editorChanged(); };
  $("beatBass").onchange = event => { editing.tracks.bass.enabled = event.target.checked; editorChanged(); renderTrack(); };
  $("beatKeys").onchange = event => { editing.tracks.keys.enabled = event.target.checked; editorChanged(); renderTrack(); };
  $("beatTrack").onchange = renderTrack;
  $("beatVolume").oninput = event => {
    editing.tracks[$("beatTrack").value].volume = Number(event.target.value);
    editorChanged();
  };
  $("beatEnabled").onchange = event => {
    const id = $("beatTrack").value;
    editing.tracks[id].enabled = event.target.checked;
    if (id === "bass") $("beatBass").checked = event.target.checked;
    if (id === "keys") $("beatKeys").checked = event.target.checked;
    if (event.target.checked && beats.instruments[id][1]) {
      editing.percussion = true;
      $("beatPercussion").checked = true;
    }
    editorChanged();
  };
  $("beatAddSection").onclick = () => {
    const { maxBars, currentBars } = sectionLimits();
    if (currentBars >= maxBars || editing.sections.length >= 48) return status("A trilha pode ter até 5 minutos e 48 trechos.");
    editing.sections.splice(Math.max(1, editing.sections.length - 1), 0, { type: "fill", bars: 1 });
    editorChanged(); renderSections();
  };
  $("beatNew").onclick = () => { if (preview) stop(); editing = fresh(); status(); renderEditor(); };
  $("beatPreview").onclick = () => {
    status();
    const current = player.snapshot();
    if (current.entry?.project === editing) play(current.entry, true);
    else play(projectEntry(editing), true);
  };
  $("beatSave").onclick = () => {
    if (!editing.id && state.projects.length >= 250) return status("A biblioteca pode guardar até 250 trilhas.");
    const project = beats.normalize({ ...editing, id: editing.id || EstanteDomain.uid("beat") });
    const before = state.projects;
    state.projects = [...before.filter(item => item.id !== project.id), project];
    if (!saveSetlists()) { state.projects = before; return; }
    if (preview) stop();
    editing = EstanteDomain.clone(project);
    renderEditor();
    select(projectEntry(project));
    status("Trilha salva. Use em qualquer arranjo ou baixe o WAV.");
    if (state.tab === "rehearsal") renderList();
  };
  $("beatExport").onclick = async () => {
    if (exporting) return;
    const project = EstanteDomain.clone(editing);
    exporting = $("beatExport").disabled = true;
    status("Preparando WAV…");
    try {
      const url = URL.createObjectURL(await beats.render(project));
      const link = Object.assign(document.createElement("a"), { href: url, download: (project.title.trim() || "trilha") + ".wav" });
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      status("WAV gerado.");
    } catch (error) { report(error.message || "Não foi possível exportar o WAV."); }
    finally { exporting = $("beatExport").disabled = false; }
  };

  function init() {
    files.refreshAvailable().then(() => {
      if (state.tab === "rehearsal") renderList();
      if (dialog.open && view === "catalog") renderCatalog();
    }).catch(() => {});
  }

  return { init, stop, onSongChange, rehearsalButton, isFollowing: () => syncing,
    seekLyric(time) { if (activeSync) player.seek(time + activeSync.offset); } };
})();

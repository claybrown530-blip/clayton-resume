(() => {
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => Array.from(el.querySelectorAll(q));

  const state = {
    manifest: null,
    room: null,
    playlist: [],
    index: -1
  };

  const el = {
    statusText: $("#statusText"),

    overlay: $("#overlay"),
    roomTitle: $("#roomTitle"),
    roomBody: $("#roomBody"),

    palette: $("#palette"),
    paletteInput: $("#paletteInput"),
    paletteList: $("#paletteList"),

    audio: $("#audio"),
    nowPlaying: $("#nowPlaying"),
    tCur: $("#tCur"),
    tDur: $("#tDur"),
    seek: $("#seek")
  };

  const rooms = [
    { id: "work", label: "WORK", hint: "featured tracks + sessions" },
    { id: "archive", label: "ARCHIVE", hint: "demos + board tapes" },
    { id: "live", label: "LIVE", hint: "photos now, videos later" },
    { id: "photos", label: "PHOTOS", hint: "years of the project" },
    { id: "about", label: "ABOUT", hint: "the story + quick facts" },
    { id: "contact", label: "CONTACT", hint: "booking + links" }
  ];

  // ---------- helpers ----------
  function fmtTime(sec) {
    if (!isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function safeName(path) {
    // path: assets/audio/finished/Doormat.wav
    const file = (path || "").split("/").pop() || "";
    return decodeURIComponent(file).replace(/\.[^/.]+$/, "");
  }

  function pickThumbForAudio(filePath) {
    // if you later add cover art mapping, do it here.
    // for now, pull a generic stamp.
    return null;
  }

  async function loadManifest() {
    // cache-bust so Netlify updates immediately after deploy
    const url = `manifest.json?v=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
    return await res.json();
  }

  function manifestStats(m) {
    const img = m?.images ? Object.values(m.images).reduce((a, arr) => a + arr.length, 0) : 0;
    const aud = m?.audio ? Object.values(m.audio).reduce((a, arr) => a + arr.length, 0) : 0;
    return { img, aud };
  }

  // ---------- palette ----------
  function openPalette() {
    el.palette.classList.add("isOpen");
    el.palette.setAttribute("aria-hidden", "false");
    el.paletteInput.value = "";
    renderPalette("");
    setTimeout(() => el.paletteInput.focus(), 20);
  }

  function closePalette() {
    el.palette.classList.remove("isOpen");
    el.palette.setAttribute("aria-hidden", "true");
  }

  function renderPalette(query) {
    const q = (query || "").trim().toLowerCase();

    const items = rooms
      .filter(r => !q || r.label.toLowerCase().includes(q) || r.id.includes(q))
      .map(r => ({
        id: r.id,
        left: r.label,
        right: r.hint
      }));

    el.paletteList.innerHTML = items
      .map(i => `
        <button class="pItem" data-room="${i.id}">
          <div class="pItem__left">${i.left}</div>
          <div class="pItem__right">${i.right}</div>
        </button>
      `)
      .join("");

    if (!items.length) {
      el.paletteList.innerHTML = `<div class="smallNote" style="padding:10px;">No matches.</div>`;
    }
  }

  // ---------- rooms ----------
  function openRoom(roomId) {
    state.room = roomId;
    el.overlay.classList.add("isOpen");
    el.overlay.setAttribute("aria-hidden", "false");

    const room = rooms.find(r => r.id === roomId);
    el.roomTitle.textContent = room ? room.label : roomId.toUpperCase();

    renderRoom(roomId);
    window.location.hash = roomId;
  }

  function closeRoom() {
    state.room = null;
    el.overlay.classList.remove("isOpen");
    el.overlay.setAttribute("aria-hidden", "true");
    el.roomTitle.textContent = "—";
    el.roomBody.innerHTML = "";
    if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  function renderRoom(roomId) {
    const m = state.manifest || {};
    const data = window.CLAYTON_DATA || {};

    if (roomId === "work") {
      const finished = (m.audio?.finished || []).slice();
      const featured = (data.featured || []).map(f => {
        const match = finished.find(p => safeName(p).toLowerCase().includes((f.fileHint || f.title).toLowerCase()));
        return match ? { ...f, path: match } : null;
      }).filter(Boolean);

      el.roomBody.innerHTML = `
        <div class="sectionTitle">Featured</div>
        <p class="smallNote">The surface pitch. Hit play and you’ll get it.</p>
        <div class="list">
          ${featured.length ? featured.map(rowAudioCard).join("") : `<div class="smallNote">Add matches in <b>js/data.js</b> (featured[]). Or drop more finished files.</div>`}
        </div>

        <div class="sectionTitle" style="margin-top:18px;">All Finished</div>
        <p class="smallNote">Everything in <b>assets/audio/finished/</b></p>
        <div class="list">
          ${finished.map(p => rowAudioCard({ title: safeName(p), path: p })).join("") || `<div class="smallNote">No finished audio found yet.</div>`}
        </div>
      `;
      return;
    }

    if (roomId === "archive") {
      const demos = (m.audio?.demos || m.audio?.["day1-demos"] || []).slice();
      const boardtapes = (m.audio?.boardtapes || m.audio?.["board-tapes"] || []).slice();

      el.roomBody.innerHTML = `
        <div class="sectionTitle">Demos</div>
        <p class="smallNote">Raw truth. <b>assets/audio/demos/</b> (or day1-demos).</p>
        <div class="list">
          ${demos.map(p => rowAudioCard({ title: safeName(p), path: p, sub: "DEMO" })).join("") || `<div class="smallNote">No demos found yet.</div>`}
        </div>

        <div class="sectionTitle" style="margin-top:18px;">Board Tapes</div>
        <p class="smallNote">Sketches + momentum. <b>assets/audio/boardtapes/</b></p>
        <div class="list">
          ${boardtapes.map(p => rowAudioCard({ title: safeName(p), path: p, sub: "BOARD TAPE" })).join("") || `<div class="smallNote">No board tapes found yet.</div>`}
        </div>
      `;
      return;
    }

    if (roomId === "live") {
      const livePhotos = (m.images?.live || []).slice();
      el.roomBody.innerHTML = `
        <div class="sectionTitle">Live Proof</div>
        <p class="smallNote">Photos now. When you’re ready, we’ll add the videos folder and a proper player.</p>
        ${livePhotos.length ? renderGallery(livePhotos) : `<div class="smallNote">No live photos found yet.</div>`}
      `;
      return;
    }

    if (roomId === "photos") {
      const studio = (m.images?.studio || []).slice();
      const candid = (m.images?.candid || []).slice();
      const artwork = (m.images?.artwork || []).slice();

      el.roomBody.innerHTML = `
        <div class="sectionTitle">Artwork</div>
        <p class="smallNote">covers, posters, artifacts</p>
        ${artwork.length ? renderGallery(artwork) : `<div class="smallNote">No artwork found yet.</div>`}

        <div class="sectionTitle" style="margin-top:18px;">Studio</div>
        <p class="smallNote">work-in-progress world</p>
        ${studio.length ? renderGallery(studio) : `<div class="smallNote">No studio photos found yet.</div>`}

        <div class="sectionTitle" style="margin-top:18px;">Candid</div>
        <p class="smallNote">the years</p>
        ${candid.length ? renderGallery(candid) : `<div class="smallNote">No candid photos found yet.</div>`}
      `;
      return;
    }

    if (roomId === "about") {
      const facts = (data.quickFacts || []).map(f => `
        <div class="item" style="grid-column: span 12;">
          <div class="thumb">${(f.k || "").slice(0,2).toUpperCase()}</div>
          <div class="item__meta">
            <div class="item__title">${f.k}</div>
            <div class="item__sub">${f.v}</div>
          </div>
        </div>
      `).join("");

      el.roomBody.innerHTML = `
        <div class="sectionTitle">The Story</div>
        <p class="smallNote">${(data.about || []).join("<br/>")}</p>

        <div class="sectionTitle" style="margin-top:18px;">Quick Facts</div>
        <div class="list">${facts || `<div class="smallNote">Add facts in <b>js/data.js</b></div>`}</div>
      `;
      return;
    }

    if (roomId === "contact") {
      const c = data.contact || {};
      el.roomBody.innerHTML = `
        <div class="sectionTitle">Booking / Contact</div>
        <p class="smallNote">If you’re here for an interview, a show, or a writing room — let’s talk.</p>

        <div class="list">
          ${contactRow("EMAIL", c.email ? `<a href="mailto:${c.email}">${c.email}</a>` : "add in js/data.js")}
          ${contactRow("INSTAGRAM", c.instagram ? `<a target="_blank" rel="noreferrer" href="${c.instagram}">${c.instagram}</a>` : "add in js/data.js")}
          ${contactRow("TIKTOK", c.tiktok ? `<a target="_blank" rel="noreferrer" href="${c.tiktok}">${c.tiktok}</a>` : "add in js/data.js")}
          ${contactRow("YOUTUBE", c.youtube ? `<a target="_blank" rel="noreferrer" href="${c.youtube}">${c.youtube}</a>` : "add in js/data.js")}
        </div>
      `;
      return;
    }

    el.roomBody.innerHTML = `<div class="smallNote">Unknown room.</div>`;
  }

  function contactRow(k, vHtml) {
    return `
      <div class="item" style="grid-column: span 12;">
        <div class="thumb">${k.slice(0,2)}</div>
        <div class="item__meta">
          <div class="item__title">${k}</div>
          <div class="item__sub">${vHtml}</div>
        </div>
      </div>
    `;
  }

  function renderGallery(paths) {
    const shots = paths.map(p => `
      <div class="shot">
        <img loading="lazy" src="${p}" alt="${safeName(p)}" />
        <div class="shot__cap">${safeName(p)}</div>
      </div>
    `).join("");
    return `<div class="gallery">${shots}</div>`;
  }

  function rowAudioCard({ title, path, sub }) {
    const thumb = pickThumbForAudio(path);
    return `
      <div class="item">
        <div class="thumb">${thumb ? `<img src="${thumb}" alt="cover"/>` : `AUDIO`}</div>
        <div class="item__meta">
          <div class="item__title">${title}</div>
          <div class="item__sub">${sub || path.split("/").slice(-2, -1)[0].toUpperCase()}</div>
        </div>
        <button class="item__btn" data-action="play" data-path="${encodeURIComponent(path)}">Play</button>
      </div>
    `;
  }

  // ---------- player ----------
  function setPlaylist(paths, startPath) {
    state.playlist = paths.slice();
    const idx = Math.max(0, state.playlist.indexOf(startPath));
    state.index = idx;
  }

  function playPath(path) {
    if (!path) return;

    // Build a playlist from same folder type
    const m = state.manifest || {};
    const decoded = decodeURIComponent(path);
    const parts = decoded.split("/");
    const folder = parts.slice(0, -1).join("/");

    const allAudio = Object.values(m.audio || {}).flat();
    const group = allAudio.filter(p => p.startsWith(folder + "/"));

    setPlaylist(group.length ? group : [decoded], decoded);

    el.audio.src = decoded;
    el.audio.play().catch(() => {});
    el.nowPlaying.textContent = safeName(decoded);
    updatePlayButton(true);
  }

  function updatePlayButton(isPlaying) {
    const btn = document.querySelector('[data-action="toggle"]');
    if (!btn) return;
    btn.textContent = isPlaying ? "Pause" : "Play";
  }

  function prev() {
    if (!state.playlist.length) return;
    state.index = (state.index - 1 + state.playlist.length) % state.playlist.length;
    playPath(state.playlist[state.index]);
  }

  function next() {
    if (!state.playlist.length) return;
    state.index = (state.index + 1) % state.playlist.length;
    playPath(state.playlist[state.index]);
  }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");

    if (action === "openPalette") openPalette();
    if (action === "closePalette") closePalette();
    if (action === "closeRoom") closeRoom();

    if (action === "play") {
      const path = btn.getAttribute("data-path");
      playPath(path);
    }

    if (action === "toggle") {
      if (el.audio.paused) el.audio.play().catch(() => {});
      else el.audio.pause();
    }
    if (action === "prev") prev();
    if (action === "next") next();
  });

  $$(".roomCard").forEach(card => {
    card.addEventListener("click", () => openRoom(card.dataset.room));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter") openRoom(card.dataset.room);
    });
    card.tabIndex = 0;
  });

  el.palette.addEventListener("click", (e) => {
    if (e.target.matches(".palette__scrim")) closePalette();
  });

  el.paletteInput.addEventListener("input", () => renderPalette(el.paletteInput.value));
  el.paletteList.addEventListener("click", (e) => {
    const item = e.target.closest("[data-room]");
    if (!item) return;
    closePalette();
    openRoom(item.dataset.room);
  });

  document.addEventListener("keydown", (e) => {
    const isMac = navigator.platform.toLowerCase().includes("mac");
    const cmdK = (isMac && e.metaKey && e.key.toLowerCase() === "k") || (!isMac && e.ctrlKey && e.key.toLowerCase() === "k");

    if (cmdK) {
      e.preventDefault();
      if (el.palette.classList.contains("isOpen")) closePalette();
      else openPalette();
    }

    if (e.key === "Escape") {
      if (el.palette.classList.contains("isOpen")) closePalette();
      else if (el.overlay.classList.contains("isOpen")) closeRoom();
    }
  });

  el.audio.addEventListener("play", () => updatePlayButton(true));
  el.audio.addEventListener("pause", () => updatePlayButton(false));
  el.audio.addEventListener("ended", () => next());

  el.audio.addEventListener("loadedmetadata", () => {
    el.tDur.textContent = fmtTime(el.audio.duration);
  });

  el.audio.addEventListener("timeupdate", () => {
    el.tCur.textContent = fmtTime(el.audio.currentTime);
    const pct = el.audio.duration ? (el.audio.currentTime / el.audio.duration) : 0;
    el.seek.value = Math.round(pct * 1000);
  });

  el.seek.addEventListener("input", () => {
    if (!el.audio.duration) return;
    const pct = Number(el.seek.value) / 1000;
    el.audio.currentTime = el.audio.duration * pct;
  });

  // ---------- boot ----------
  async function init() {
    try {
      state.manifest = await loadManifest();
      const { img, aud } = manifestStats(state.manifest);
      el.statusText.textContent = `Loaded: ${aud} audio • ${img} photos`;

      // deep link open
      const hash = (window.location.hash || "").replace("#", "").trim();
      if (hash && rooms.some(r => r.id === hash)) openRoom(hash);
    } catch (err) {
      console.error(err);
      el.statusText.textContent = "Couldn’t load manifest.json (run generate + push).";
    }

    // build palette list
    renderPalette("");
  }

  init();
})();

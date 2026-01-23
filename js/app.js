// ==========================
// CLAYTON — dossier world UI
// ==========================

const PROFILE = {
  name: "CLAYTON",
  headline: "IF ALL ISN'T LOST, WHERE IS IT?",
  status: "Born to run.",
  email: "claybrown530@gmail.com",

  // Optional: add these later
  socials: [
    // { label: "Instagram", url: "https://instagram.com/..." },
    // { label: "TikTok", url: "https://tiktok.com/@..." },
    // { label: "YouTube", url: "https://youtube.com/..." },
  ],

  // “Boss credibility” quick bullets
  highlights: [
    "Indie rock / alt-pop storyteller — funny, raw, cinematic.",
    "Built like a resume, moves like a world.",
    "Everything here is expandable: surface = clean, depth = infinite."
  ]
};

const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => Array.from(el.querySelectorAll(q));

const routes = ["dossier", "music", "live", "archive", "contact"];

const state = {
  manifest: null,
  audioFlat: [],   // flattened playlist
  audioScope: "all",
  audioFilter: "",
  nowIndex: -1,
  imagesFlat: [],
  imgScope: "all",
  lightboxIndex: 0,
};

function encodePath(p) {
  // handle spaces and special chars safely in URLs
  return encodeURI(p);
}

function prettyName(path) {
  const base = path.split("/").pop() || path;
  const noExt = base.replace(/\.[^/.]+$/, "");
  return noExt
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// --------------------
// Manifest normalization
// --------------------
function normalizeManifest(raw) {
  const m = raw || {};
  m.images = m.images || {};
  m.audio = m.audio || {};
  m.video = m.video || {};

  // Support slight key variations
  const audio = {};
  const setAudio = (k, v) => { if (Array.isArray(v)) audio[k] = v; };

  setAudio("finished", m.audio.finished);
  setAudio("demos", m.audio.demos);
  setAudio("day1-demos", m.audio["day1-demos"]);
  setAudio("boardtapes", m.audio.boardtapes);
  setAudio("board-tapes", m.audio["board-tapes"]);

  // Merge boardtapes variants
  const board = [...(audio.boardtapes || []), ...(audio["board-tapes"] || [])];
  audio.boardtapes = Array.from(new Set(board));
  delete audio["board-tapes"];

  // Merge day1 demos if your generator uses "demos" or "day1-demos"
  audio["day1-demos"] = audio["day1-demos"] || [];

  const images = {};
  const setImg = (k, v) => { if (Array.isArray(v)) images[k] = v; };

  setImg("live", m.images.live);
  setImg("studio", m.images.studio);
  setImg("candid", m.images.candid);
  setImg("artwork", m.images.artwork);

  // Flatten counts
  const imgCount = Object.values(images).reduce((a, arr) => a + (arr?.length || 0), 0);
  const audCount = Object.values(audio).reduce((a, arr) => a + (arr?.length || 0), 0);
  const vidCount = Object.values(m.video).reduce((a, arr) => a + (arr?.length || 0), 0);

  return { ...m, images, audio, _counts: { imgCount, audCount, vidCount } };
}

async function loadManifest() {
  const bust = `v=${Date.now()}`;
  const res = await fetch(`manifest.json?${bust}`);
  if (!res.ok) throw new Error("Could not load manifest.json");
  const raw = await res.json();
  return normalizeManifest(raw);
}

// -------------
// Routing
// -------------
function setRoute(name) {
  const view = routes.includes(name) ? name : "dossier";
  $$(".route").forEach(r => r.classList.toggle("is-active", r.dataset.view === view));
  $$(".topnav a").forEach(a => a.classList.toggle("is-active", a.dataset.route === view));
  window.location.hash = `#${view}`;
}

function getRouteFromHash() {
  const h = (window.location.hash || "#dossier").replace("#", "").trim();
  return routes.includes(h) ? h : "dossier";
}

// -------------
// Modal
// -------------
function openModal(title, html) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = html;
  const m = $("#modal");
  m.classList.add("is-on");
  m.setAttribute("aria-hidden", "false");
}
function closeModal() {
  const m = $("#modal");
  m.classList.remove("is-on");
  m.setAttribute("aria-hidden", "true");
}

// -------------
// Lightbox
// -------------
function openLightbox(index) {
  state.lightboxIndex = Math.max(0, Math.min(state.imagesFlat.length - 1, index));
  const lb = $("#lightbox");
  lb.classList.add("is-on");
  lb.setAttribute("aria-hidden", "false");
  renderLightbox();
}
function closeLightbox() {
  const lb = $("#lightbox");
  lb.classList.remove("is-on");
  lb.setAttribute("aria-hidden", "true");
}
function renderLightbox() {
  const item = state.imagesFlat[state.lightboxIndex];
  if (!item) return;

  $("#lbImg").src = encodePath(item.path);
  $("#lbCap").textContent = item.caption || prettyName(item.path);
}
function lbPrev() {
  state.lightboxIndex = (state.lightboxIndex - 1 + state.imagesFlat.length) % state.imagesFlat.length;
  renderLightbox();
}
function lbNext() {
  state.lightboxIndex = (state.lightboxIndex + 1) % state.imagesFlat.length;
  renderLightbox();
}

// -------------
// Audio player
// -------------
const audioEl = $("#audio");
const btnPlay = $("#btnPlay");
const btnPrev = $("#btnPrev");
const btnNext = $("#btnNext");
const seek = $("#seek");

function setNow(index) {
  state.nowIndex = Math.max(0, Math.min(state.audioFlat.length - 1, index));
  const t = state.audioFlat[state.nowIndex];
  if (!t) return;

  $("#nowTitle").textContent = t.title;
  $("#nowSub").textContent = t.groupLabel || "—";
  audioEl.src = encodePath(t.path);
  audioEl.play().catch(() => {});
  btnPlay.textContent = "Pause";
}

function togglePlay() {
  if (!audioEl.src) return;
  if (audioEl.paused) {
    audioEl.play().catch(() => {});
    btnPlay.textContent = "Pause";
  } else {
    audioEl.pause();
    btnPlay.textContent = "Play";
  }
}
function playPrev() {
  if (!state.audioFlat.length) return;
  const i = (state.nowIndex - 1 + state.audioFlat.length) % state.audioFlat.length;
  setNow(i);
}
function playNext() {
  if (!state.audioFlat.length) return;
  const i = (state.nowIndex + 1) % state.audioFlat.length;
  setNow(i);
}
function fmtTime(s) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
audioEl.addEventListener("timeupdate", () => {
  const cur = audioEl.currentTime || 0;
  const dur = audioEl.duration || 0;
  $("#tCur").textContent = fmtTime(cur);
  $("#tDur").textContent = fmtTime(dur);
  if (dur > 0) seek.value = Math.floor((cur / dur) * 1000);
});
seek.addEventListener("input", () => {
  const dur = audioEl.duration || 0;
  if (dur <= 0) return;
  const pct = Number(seek.value) / 1000;
  audioEl.currentTime = dur * pct;
});
audioEl.addEventListener("ended", playNext);

// -------------
// Render: audio
// -------------
function buildAudioFlat(manifest) {
  const groups = [
    { key: "finished", label: "Finished" },
    { key: "demos", label: "Demos" },
    { key: "day1-demos", label: "Day 1 Demos" },
    { key: "boardtapes", label: "Boardtapes" },
  ];

  const flat = [];
  for (const g of groups) {
    const arr = manifest.audio[g.key] || [];
    for (const p of arr) {
      flat.push({
        path: p,
        title: prettyName(p),
        groupKey: g.key,
        groupLabel: g.label,
      });
    }
  }
  return flat;
}

function renderAudioLists() {
  const wrap = $("#audioLists");
  wrap.innerHTML = "";

  const scoped = state.audioFlat.filter(t => {
    const scopeOK =
      state.audioScope === "all" ||
      t.groupKey === state.audioScope ||
      (state.audioScope === "boardtapes" && t.groupKey === "boardtapes");
    const q = state.audioFilter.trim().toLowerCase();
    const filterOK = !q || t.title.toLowerCase().includes(q);
    return scopeOK && filterOK;
  });

  const byGroup = new Map();
  for (const t of scoped) {
    if (!byGroup.has(t.groupKey)) byGroup.set(t.groupKey, []);
    byGroup.get(t.groupKey).push(t);
  }

  const order = ["finished", "demos", "day1-demos", "boardtapes"];
  for (const key of order) {
    const list = byGroup.get(key) || [];
    if (!list.length) continue;

    const title =
      key === "day1-demos" ? "Day 1 Demos" :
      key === "boardtapes" ? "Boardtapes" :
      key.charAt(0).toUpperCase() + key.slice(1);

    const panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = `
      <div class="panel__top">
        <div class="panel__title">${title}</div>
        <div class="badge">${list.length} tracks</div>
      </div>
      <ul class="tracklist"></ul>
    `;

    const ul = $(".tracklist", panel);
    list.forEach(t => {
      const li = document.createElement("li");
      li.className = "track";
      li.innerHTML = `
        <div class="track__name">${t.title}</div>
        <div class="track__meta">${t.groupLabel}</div>
      `;
      li.addEventListener("click", () => {
        const idx = state.audioFlat.findIndex(x => x.path === t.path);
        if (idx >= 0) setNow(idx);
      });
      ul.appendChild(li);
    });

    wrap.appendChild(panel);
  }

  if (!wrap.children.length) {
    wrap.innerHTML = `<div class="mono" style="color:rgba(242,239,232,.72)">No tracks match that filter yet.</div>`;
  }
}

// -------------
// Render: images
// -------------
function buildImagesFlat(manifest) {
  const groups = [
    { key: "live", label: "Live" },
    { key: "studio", label: "Studio" },
    { key: "candid", label: "Candid" },
    { key: "artwork", label: "Artwork" },
  ];

  const flat = [];
  for (const g of groups) {
    const arr = manifest.images[g.key] || [];
    for (const p of arr) {
      flat.push({ path: p, groupKey: g.key, groupLabel: g.label, caption: prettyName(p) });
    }
  }
  return flat;
}

function renderImageGrid(targetId, scopeKey) {
  const grid = document.getElementById(targetId);
  grid.innerHTML = "";

  const list = state.imagesFlat.filter(img => scopeKey === "all" || img.groupKey === scopeKey);

  list.slice(0, 60).forEach((img, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img loading="lazy" src="${encodePath(img.path)}" alt="${img.caption}" />
      <div class="card__cap">${img.caption}</div>
    `;
    card.addEventListener("click", () => {
      const idx = state.imagesFlat.findIndex(x => x.path === img.path);
      openLightbox(idx >= 0 ? idx : i);
    });
    grid.appendChild(card);
  });

  if (!grid.children.length) {
    grid.innerHTML = `<div class="mono" style="color:rgba(242,239,232,.72)">No photos found yet.</div>`;
  }
}

// -------------
// Dossier tiles (world building)
// -------------
function wireTiles() {
  $$(".tile").forEach(btn => {
    btn.addEventListener("click", () => {
      const which = btn.dataset.open;
      if (which === "music") return setRoute("music");
      if (which === "gallery") return setRoute("archive");
      if (which === "live") return setRoute("live");
      if (which === "contact") return setRoute("contact");

      if (which === "about") {
        openModal("WHO I AM", `
          <p><strong>${PROFILE.name}</strong> — indie rock / alt-pop storyteller.</p>
          <p>Built for the surface-level skim and the deep dive. If someone only has 20 seconds, they get the point. If they have 20 minutes, they can disappear in the archive.</p>
          <p class="mono" style="opacity:.9">“Born to run.” isn’t a reference — it’s a posture.</p>
        `);
      }

      if (which === "highlights") {
        openModal("HIGHLIGHTS", `
          <ul>
            ${PROFILE.highlights.map(x => `<li>${x}</li>`).join("")}
          </ul>
          <p>Want this to feel more “Boss”? We can add a <em>timeline</em> section next: years/eras/volumes + key shows + wins.</p>
        `);
      }
    });
  });
}

// -------------
// Init
// -------------
async function init() {
  // top UI
  $("#statusLine").textContent = PROFILE.status;
  $("#today").textContent = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });

  // press kit button placeholder
  $("#btnDownload").addEventListener("click", () => {
    openModal("PRESS KIT", `
      <p>When you’re ready, we’ll drop a real press kit PDF in <code>/assets/press/</code> and link it here.</p>
      <p>For now, this site is the press kit.</p>
    `);
  });

  // Search button = jump to filter on music
  $("#btnSearch").addEventListener("click", () => {
    setRoute("music");
    $("#audioFilter").focus();
  });

  // modal events
  $("#modalClose").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => {
    if (e.target?.dataset?.close) closeModal();
  });

  // lightbox events
  $("#lbClose").addEventListener("click", closeLightbox);
  $("#lbPrev").addEventListener("click", lbPrev);
  $("#lbNext").addEventListener("click", lbNext);

  window.addEventListener("keydown", (e) => {
    const lbOn = $("#lightbox").classList.contains("is-on");
    if (e.key === "Escape") {
      if (lbOn) closeLightbox();
      if ($("#modal").classList.contains("is-on")) closeModal();
    }
    if (lbOn && e.key === "ArrowLeft") lbPrev();
    if (lbOn && e.key === "ArrowRight") lbNext();
  });

  // player controls
  btnPlay.addEventListener("click", togglePlay);
  btnPrev.addEventListener("click", playPrev);
  btnNext.addEventListener("click", playNext);

  // routing
  window.addEventListener("hashchange", () => setRoute(getRouteFromHash()));
  $$(".topnav a").forEach(a => a.addEventListener("click", () => setRoute(a.dataset.route)));

  // segment controls
  $$(".seg__btn[data-audio-scope]").forEach(b => {
    b.addEventListener("click", () => {
      $$(".seg__btn[data-audio-scope]").forEach(x => x.classList.remove("is-on"));
      b.classList.add("is-on");
      state.audioScope = b.dataset.audioScope;
      renderAudioLists();
    });
  });

  $$(".seg__btn[data-img-scope]").forEach(b => {
    b.addEventListener("click", () => {
      $$(".seg__btn[data-img-scope]").forEach(x => x.classList.remove("is-on"));
      b.classList.add("is-on");
      state.imgScope = b.dataset.imgScope;
      renderImageGrid("archiveGrid", state.imgScope);
    });
  });

  $("#audioFilter").addEventListener("input", (e) => {
    state.audioFilter = e.target.value || "";
    renderAudioLists();
  });

  wireTiles();

  // load manifest
  try {
    state.manifest = await loadManifest();

    // counts
    $("#countAudio").textContent = String(state.manifest._counts.audCount);
    $("#countImages").textContent = String(state.manifest._counts.imgCount);
    $("#countVideo").textContent = String(state.manifest._counts.vidCount);

    // field report
    $("#fieldReport").innerHTML = `
      <p><strong>Archive detected.</strong> Audio: <span style="color:var(--accent)">${state.manifest._counts.audCount}</span>,
      Photos: <span style="color:var(--accent)">${state.manifest._counts.imgCount}</span>,
      Video: <span style="color:var(--accent)">${state.manifest._counts.vidCount}</span>.</p>

      <p>This is built to scale. You can dump years of content in here and the site won’t collapse — it will just get deeper.</p>

      <p><span class="mono">Next:</span> We can add “Eras / Volumes” so your whole story reads like a Bruce dossier: chapters, stakes, mythology.</p>
    `;

    // audio + images
    state.audioFlat = buildAudioFlat(state.manifest);
    state.imagesFlat = buildImagesFlat(state.manifest);

    renderAudioLists();
    renderImageGrid("liveGrid", "live");
    renderImageGrid("archiveGrid", "all");

  } catch (err) {
    console.error(err);
    $("#fieldReport").textContent = "Couldn’t load manifest.json. Run npm run generate and redeploy.";
  }

  // start on correct route
  setRoute(getRouteFromHash());
}

init();

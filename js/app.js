/* CLAYTON — Dossier player
   Goals:
   - One obvious “Play”
   - Titles only (no “FINISHED” metadata under tracks)
   - “Babe I Know You” first
   - Random photos rotate while audio plays
   - Hide broken images in gallery
*/

const $ = (sel) => document.querySelector(sel);

const audio = $("#audio");
const playBtn = $("#playBtn");
const playIcon = playBtn.querySelector(".playBtn__icon");
const nowTitle = $("#nowTitle");
const seek = $("#seek");
const tCur = $("#tCur");
const tDur = $("#tDur");
const trackList = $("#trackList");
const photo = $("#photo");
const nextBtn = $("#nextBtn");
const galleryGrid = $("#galleryGrid");
const yearEl = $("#year");

yearEl.textContent = new Date().getFullYear();

let manifest = null;
let imagePool = [];
let groups = {};
let currentGroup = "finished";
let currentIndex = -1;
let currentTracks = [];
let photoTimer = null;

const AUDIO_EXT = [".mp3", ".m4a", ".wav", ".aiff", ".flac", ".aac", ".ogg"];

function safeUrl(path) {
  return encodeURI(path);
}

function isAudioFile(path) {
  const lower = String(path || "").toLowerCase();
  return AUDIO_EXT.some(ext => lower.endsWith(ext));
}

function prettifyTitleFromPath(path) {
  const parts = String(path || "").split("/");
  let file = parts[parts.length - 1] || "";
  if (!file && parts.length > 1) file = parts[parts.length - 2] || "";
  const base = decodeURIComponent(file).replace(/\.[^/.]+$/, "");
  return base.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled";
}

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function setPlayUI(isPlaying) {
  playBtn.classList.toggle("is-playing", isPlaying);
  playIcon.textContent = isPlaying ? "❚❚" : "▶";
  playIcon.style.marginLeft = isPlaying ? "0px" : "3px";
}

function pickRandomPhoto() {
  if (!imagePool.length) return;

  // Try a few times in case some images are broken
  for (let i = 0; i < 6; i++) {
    const src = safeUrl(imagePool[Math.floor(Math.random() * imagePool.length)]);
    if (!src) continue;

    photo.classList.remove("is-ready");
    photo.onload = () => photo.classList.add("is-ready");
    photo.onerror = () => {
      // if an image fails, try another next tick
      setTimeout(() => pickRandomPhoto(), 50);
    };
    photo.src = src;
    break;
  }
}

function startPhotoRotation() {
  stopPhotoRotation();
  // rotate every ~18s while music plays
  photoTimer = setInterval(() => pickRandomPhoto(), 18000);
}

function stopPhotoRotation() {
  if (photoTimer) clearInterval(photoTimer);
  photoTimer = null;
}

function renderTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((t) => {
    const g = t.dataset.group;

    if (!groups[g] || groups[g].length === 0) {
      t.style.display = "none";
      return;
    }

    t.style.display = "";
    t.classList.toggle("is-active", g === currentGroup);
    t.setAttribute("aria-selected", g === currentGroup ? "true" : "false");

    t.onclick = () => {
      currentGroup = g;
      tabs.forEach((x) => {
        x.classList.remove("is-active");
        x.setAttribute("aria-selected", "false");
      });
      t.classList.add("is-active");
      t.setAttribute("aria-selected", "true");
      loadGroup(g);
    };
  });
}

function renderTrackList(tracks) {
  trackList.innerHTML = "";

  tracks.forEach((tr, idx) => {
    const btn = document.createElement("button");
    btn.className = "track";
    btn.type = "button";
    btn.innerHTML = `
      <div class="track__title">${tr.title}</div>
      <div class="track__right"></div>
    `;
    btn.onclick = () => playIndex(idx);
    trackList.appendChild(btn);
  });

  highlightActive();
}

function highlightActive() {
  const items = trackList.querySelectorAll(".track");
  items.forEach((el, i) => {
    el.classList.toggle("is-active", i === currentIndex);
    const right = el.querySelector(".track__right");
    if (right) right.textContent = i === currentIndex ? "PLAYING" : "";
  });
}

function playIndex(idx) {
  if (!currentTracks.length) return;
  currentIndex = idx;

  const tr = currentTracks[currentIndex];
  audio.src = safeUrl(tr.path);
  audio.play().catch(() => {});
  nowTitle.textContent = tr.title;

  pickRandomPhoto();
  highlightActive();
}

function nextTrack() {
  if (!currentTracks.length) return;
  const next = (currentIndex + 1) % currentTracks.length;
  playIndex(next);
}

function loadGroup(groupKey) {
  const list = (groups[groupKey] || [])
    .filter(isAudioFile) // critical: prevents “finished finished finished”
    .map((path) => ({ path, title: prettifyTitleFromPath(path) }));

  // Pin “Babe I Know You” first
  const pin = "babe i know you";
  list.sort((a, b) => {
    const A = a.title.toLowerCase();
    const B = b.title.toLowerCase();
    const aPin = A.includes(pin) ? 0 : 1;
    const bPin = B.includes(pin) ? 0 : 1;
    if (aPin !== bPin) return aPin - bPin;
    return A.localeCompare(B);
  });

  currentTracks = list;
  currentIndex = -1;
  renderTrackList(currentTracks);

  if (currentTracks[0]) {
    nowTitle.textContent = currentTracks[0].title;
  }
}

function buildImagePool(m) {
  const imgs = m.images || {};
  const pool = [];
  Object.keys(imgs).forEach((k) => (imgs[k] || []).forEach((p) => pool.push(p)));
  return pool;
}

function buildGroups(m) {
  const aud = m.audio || {};
  return {
    finished: []
      .concat(aud.finished || [])
      .concat(aud["finished-tracks"] || []),
    demos: []
      .concat(aud.demos || [])
      .concat(aud["day1-demos"] || [])
      .concat(aud["day-1-demos"] || []),
    boardtapes: []
      .concat(aud.boardtapes || [])
      .concat(aud["board-tapes"] || [])
      .concat(aud["boardtapes"] || []),
  };
}

function renderGallery() {
  if (!imagePool.length) return;
  galleryGrid.innerHTML = "";

  // Keep iPhone fast: show a shuffled slice, hide broken items
  const max = Math.min(imagePool.length, 60);
  const shuffled = [...imagePool].sort(() => Math.random() - 0.5).slice(0, max);

  shuffled.forEach((src) => {
    const div = document.createElement("div");
    div.className = "gItem";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = "CLAYTON image";
    img.src = safeUrl(src);

    img.onerror = () => {
      // If an image fails (HEIC / bad path), remove the tile entirely
      div.remove();
    };

    div.appendChild(img);
    galleryGrid.appendChild(div);
  });
}

function togglePlay() {
  if (!audio.src) {
    if (!currentTracks.length) return;
    playIndex(0);
    return;
  }
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

function wireUI() {
  playBtn.addEventListener("click", togglePlay);
  nextBtn.addEventListener("click", () => nextTrack());

  // keyboard: space = play/pause, → = next
  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    if (e.code === "Space") {
      e.preventDefault();
      togglePlay();
    }
    if (e.code === "ArrowRight") nextTrack();
  });

  audio.addEventListener("play", () => {
    setPlayUI(true);
    startPhotoRotation();
  });

  audio.addEventListener("pause", () => {
    setPlayUI(false);
    stopPhotoRotation();
  });

  audio.addEventListener("ended", () => {
    stopPhotoRotation();
    nextTrack();
  });

  audio.addEventListener("loadedmetadata", () => {
    tDur.textContent = fmtTime(audio.duration);
  });

  audio.addEventListener("timeupdate", () => {
    tCur.textContent = fmtTime(audio.currentTime);
    if (audio.duration) {
      const pct = (audio.currentTime / audio.duration) * 100;
      seek.value = String(pct);
    }
  });

  seek.addEventListener("input", () => {
    if (!audio.duration) return;
    const pct = Number(seek.value) / 100;
    audio.currentTime = pct * audio.duration;
  });
}

async function init() {
  wireUI();

  const res = await fetch("manifest.json", { cache: "no-store" });
  manifest = await res.json();

  imagePool = buildImagePool(manifest);
  groups = buildGroups(manifest);

  renderTabs();
  pickRandomPhoto();
  renderGallery();

  // default group
  loadGroup("finished");
}

init().catch((err) => {
  console.error(err);
  nowTitle.textContent = "manifest.json failed to load";
});

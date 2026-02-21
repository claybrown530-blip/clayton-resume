const $ = (s) => document.querySelector(s);

const yearEl = $("#year");
yearEl.textContent = new Date().getFullYear();

// Smooth scroll cue
document.querySelectorAll("[data-scroll]").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-scroll");
    const el = document.querySelector(target);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

// Watch button placeholder (we’ll wire to videos section later)
const watchBtn = $("#watchBtn");
watchBtn?.addEventListener("click", () => {
  alert("Videos coming next — pick your best 2 and we’ll drop them in.");
});

/* ---------- SHOW HISTORY ---------- */
const showTable = $("#showTable");

const SHOWS = [
  { venue: "Mars Music Hall (Huntsville, AL) — opener for Judah & the Lion", nums: "827 / 1575", soldOut: true },
  { venue: "Strawberry Fest (Cullman, AL) — 1 of 4 headliners", nums: "10,000 tickets sold", soldOut: false },

  { venue: "Dive Motel (Nashville) — opener", nums: "SOLD OUT (cap 110)", soldOut: true },
  { venue: "The East Room (Nashville)", nums: "SOLD OUT (cap 300)", soldOut: true },
  { venue: "Marathon Music Works (Nashville)", nums: "SOLD OUT", soldOut: true },

  { venue: "Eddie’s Attic (Atlanta) — headliner", nums: "SOLD OUT (cap 165)", soldOut: true },

  { venue: "CLAYTON Halloween Backyard Show (Nashville)", nums: "541 attended", soldOut: true },
  { venue: "Copperline Ranch (Kenny Rogers Estate) — self-thrown", nums: "227 / 227 • $25", soldOut: true },
];

function renderShows(){
  showTable.innerHTML = SHOWS.map(s => {
    const badge = s.soldOut
      ? `<span class="badge">SOLD OUT</span>`
      : `<span class="badge off">—</span>`;
    return `
      <div class="srow">
        <div class="svenue">${s.venue}</div>
        <div class="snums">${s.nums}</div>
        ${badge}
      </div>
    `;
  }).join("");
}
renderShows();

/* ---------- LIVE PHOTO WALL (from manifest.json) ---------- */
const liveLeft = $("#liveLeft");
const liveRight = $("#liveRight");

function safeUrl(p){
  const s = String(p || "");
  // manifest.json uses "assets/..." (relative). On /epk/ that becomes /epk/assets/... (wrong).
  // Force root-absolute paths.
  const abs = s.startsWith("/") ? s : "/" + s;
  return encodeURI(abs);
}
function shuffle(arr){ return [...arr].sort(() => Math.random() - 0.5); }

function renderPhotoCol(el, paths, count = 5){
  if (!el) return;
  el.innerHTML = "";
  const picks = shuffle(paths).slice(0, count);
  picks.forEach(p => {
    const wrap = document.createElement("div");
    wrap.className = "pimg";
    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = "Live photo";
    img.src = safeUrl(p);
    wrap.appendChild(img);
    el.appendChild(wrap);
  });
}

async function loadManifest(){
  const res = await fetch("/manifest.json", { cache: "no-store" });
  return res.json();
}

(async function initPhotos(){
  try{
    const manifest = await loadManifest();
    const imgs = manifest.images || {};
    const live = (imgs.live || []).filter(Boolean);
    const pool = live.length ? live : Object.values(imgs).flat();
    renderPhotoCol(liveLeft, pool, 5);
    renderPhotoCol(liveRight, pool, 5);
  }catch(e){
    console.warn("manifest.json failed for photos", e);
  }
})();

/* ---------- SHITTY EP PLAYER (hard-wired filenames) ---------- */
const audio = $("#audio");
const playBtn = $("#playBtn");
const nowTitle = $("#nowTitle");
const seek = $("#seek");
const tCur = $("#tCur");
const tDur = $("#tDur");
const nextBtn = $("#nextBtn");
const epTrackList = $("#epTrackList");

let tracks = [
  { title: "Doormat", path: "/assets/audio/finished/Doormat.wav" },
  { title: "Cards", path: "/assets/audio/finished/Cards.mp3" },
  { title: "Sitcom", path: "/assets/audio/finished/Sitcom.wav" },
  { title: "Nice Guy", path: "/assets/audio/demos/Nice Guy.mp3" },
  { title: "Mary", path: "/assets/audio/finished/Mary.m4a" },
  { title: "Shitty Song", path: "/assets/audio/finished/Shitty Song.mp3" },
];

let idx = -1;

function fmt(sec){
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec/60);
  const s = Math.floor(sec%60);
  return `${m}:${String(s).padStart(2,"0")}`;
}

function setNow(i){
  if (!tracks[i]) return;
  nowTitle.textContent = tracks[i].title;

  document.querySelectorAll(".track").forEach((el, n) => {
    el.classList.toggle("is-active", n === i);
    const r = el.querySelector(".track__r");
    if (r) r.textContent = (n === i) ? "PLAYING" : "";
  });
}

function playAt(i){
  if (!tracks.length) return;
  idx = i;
  audio.src = safeUrl(tracks[idx].path);
  audio.play().catch(()=>{});
  setNow(idx);
}

function next(){
  if (!tracks.length) return;
  playAt((idx + 1) % tracks.length);
}

function toggle(){
  if (!audio.src){
    playAt(0);
    return;
  }
  if (audio.paused) audio.play().catch(()=>{});
  else audio.pause();
}

function renderTrackList(){
  epTrackList.innerHTML = "";
  tracks.forEach((tr, i) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "track";
    row.innerHTML = `<div class="track__t">${tr.title}</div><div class="track__r"></div>`;
    row.addEventListener("click", () => playAt(i));
    epTrackList.appendChild(row);
  });
  if (tracks[0]) nowTitle.textContent = tracks[0].title;
}

renderTrackList();

// wire player UI
playBtn?.addEventListener("click", toggle);
nextBtn?.addEventListener("click", next);

window.addEventListener("keydown", (e)=>{
  const tag = (e.target && e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea") return;

  if (e.code === "Space"){
    e.preventDefault();
    toggle();
  }
  if (e.code === "ArrowRight"){
    next();
  }
});

audio?.addEventListener("loadedmetadata", ()=>{ tDur.textContent = fmt(audio.duration); });
audio?.addEventListener("timeupdate", ()=>{
  tCur.textContent = fmt(audio.currentTime);
  if (audio.duration) seek.value = String((audio.currentTime/audio.duration)*100);
});
seek?.addEventListener("input", ()=>{
  if (!audio.duration) return;
  audio.currentTime = (Number(seek.value)/100) * audio.duration;
});
audio?.addEventListener("ended", next);
const $ = (s) => document.querySelector(s);

const audio = $("#audio");
const playBtn = $("#playBtn");
const nowTitle = $("#nowTitle");
const seek = $("#seek");
const tCur = $("#tCur");
const tDur = $("#tDur");
const nextBtn = $("#nextBtn");
const yearEl = $("#year");
const photo = $("#photo");
const showTable = $("#showTable");

yearEl.textContent = new Date().getFullYear();

let manifest = null;
let imagePool = [];
let tracks = [];
let idx = -1;
let timer = null;

const AUDIO_EXT = [".mp3",".m4a",".wav",".aiff",".flac",".aac",".ogg"];
const PIN = "babe i know you";

function safeUrl(p){ return encodeURI(p); }
function isAudio(p){
  const l = String(p||"").toLowerCase();
  return AUDIO_EXT.some(ext => l.endsWith(ext));
}
function titleFromPath(p){
  const parts = String(p||"").split("/");
  const file = parts[parts.length-1] || "";
  return decodeURIComponent(file).replace(/\.[^/.]+$/, "").replace(/[_]+/g," ").replace(/\s+/g," ").trim() || "Untitled";
}
function fmt(sec){
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec/60);
  const s = Math.floor(sec%60);
  return `${m}:${String(s).padStart(2,"0")}`;
}

function pickPhoto(){
  if (!imagePool.length) return;
  const src = safeUrl(imagePool[Math.floor(Math.random()*imagePool.length)]);
  photo.classList.remove("ready");
  photo.onload = () => photo.classList.add("ready");
  photo.onerror = () => setTimeout(pickPhoto, 50);
  photo.src = src;
}
function startPics(){
  stopPics();
  timer = setInterval(pickPhoto, 18000);
}
function stopPics(){
  if (timer) clearInterval(timer);
  timer = null;
}

function playAt(i){
  if (!tracks.length) return;
  idx = i;
  const tr = tracks[idx];
  audio.src = safeUrl(tr.path);
  nowTitle.textContent = tr.title;
  audio.play().catch(()=>{});
  pickPhoto();
}
function next(){
  if (!tracks.length) return;
  playAt((idx+1) % tracks.length);
}
function toggle(){
  if (!audio.src){ playAt(0); return; }
  if (audio.paused) audio.play().catch(()=>{});
  else audio.pause();
}

/* SHOW HISTORY
   - “sold” is tickets sold or attendance
   - “cap” is capacity when known
   - soldOut true adds badge
*/
const SHOWS = [
  { venue: "Mars Music Hall (Huntsville, AL) — opener for Judah & the Lion", sold: 827, cap: 1575, soldOut: true },
  { venue: "Strawberry Fest (Cullman, AL)", sold: 260, cap: null, soldOut: false },
  { venue: "Dive Motel (Nashville) — opener", sold: 93, cap: 110, soldOut: true },
  { venue: "Eddie’s Attic (Atlanta) — headliner", sold: 83, cap: 165, soldOut: true }, // per your words; change if needed
  { venue: "The East Room (Nashville)", sold: 76, cap: 300, soldOut: false },          // number from doc; if sold out headliner later, we’ll add it
  { venue: "Backyard Halloween show (Nashville)", sold: 400, cap: null, soldOut: true, label: "attendance" },
  { venue: "Kenny Rogers former estate show (Nashville)", sold: 227, cap: 227, soldOut: true },
  { venue: "Marathon Music Works (Nashville)", sold: null, cap: null, soldOut: true },  // add numbers when you have them
];

function renderShows(){
  showTable.innerHTML = SHOWS.map(s => {
    const isAttendance = s.label === "attendance";
    const left = s.venue;

    let nums = "—";
    if (s.sold != null && s.cap != null) nums = `${s.sold}/${s.cap}`;
    else if (s.sold != null && s.cap == null) nums = isAttendance ? `${s.sold}+ attendance` : `${s.sold} tickets`;
    else if (s.sold == null && s.cap == null) nums = s.soldOut ? `sold out` : `—`;

    const badge = s.soldOut ? `<span class="badge">SOLD OUT</span>` : `<span class="badge off">—</span>`;

    return `
      <div class="srow">
        <div class="svenue">${left}</div>
        <div class="snums">${nums}</div>
        ${badge}
      </div>
    `;
  }).join("");
}

async function init(){
  renderShows();
  pickPhoto();

  // load main manifest (site root)
  const res = await fetch("/manifest.json", { cache: "no-store" });
  manifest = await res.json();

  // images
  const imgs = manifest.images || {};
  imagePool = Object.values(imgs).flat();

  // finished tracks only (clean EPK)
  const aud = manifest.audio || {};
  const finished = []
    .concat(aud.finished || [])
    .concat(aud["finished-tracks"] || [])
    .filter(isAudio)
    .map(p => ({ path:p, title:titleFromPath(p) }));

  finished.sort((a,b)=>{
    const A = a.title.toLowerCase();
    const B = b.title.toLowerCase();
    const aPin = A.includes(PIN) ? 0 : 1;
    const bPin = B.includes(PIN) ? 0 : 1;
    if (aPin !== bPin) return aPin - bPin;
    return A.localeCompare(B);
  });

  tracks = finished;
  idx = -1;
  if (tracks[0]) nowTitle.textContent = tracks[0].title;

  playBtn.addEventListener("click", toggle);
  nextBtn.addEventListener("click", next);

  window.addEventListener("keydown", (e)=>{
    if (e.code === "Space"){ e.preventDefault(); toggle(); }
    if (e.code === "ArrowRight"){ next(); }
  });

  audio.addEventListener("loadedmetadata", ()=>{ tDur.textContent = fmt(audio.duration); });
  audio.addEventListener("timeupdate", ()=>{
    tCur.textContent = fmt(audio.currentTime);
    if (audio.duration) seek.value = String((audio.currentTime/audio.duration)*100);
  });
  seek.addEventListener("input", ()=>{
    if (!audio.duration) return;
    audio.currentTime = (Number(seek.value)/100) * audio.duration;
  });

  audio.addEventListener("play", ()=> startPics());
  audio.addEventListener("pause", ()=> stopPics());
  audio.addEventListener("ended", ()=>{ stopPics(); next(); });
}

init().catch(err=>{
  console.error(err);
  nowTitle.textContent = "Audio failed to load (check manifest/paths)";
});
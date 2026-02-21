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
const tourTable = $("#tourTable");

const pjBtn = $("#pjBtn");
const pjPanel = $("#pjPanel");

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
  if (!audio.src){
    playAt(0);
    return;
  }
  if (audio.paused) audio.play().catch(()=>{});
  else audio.pause();
}

function renderTour(){
  const rows = [
    ["Sun 3/22", "Spokane, WA — The Chameleon"],
    ["Mon 3/23", "Vancouver, BC — Wise Hall"],
    ["Wed 3/25", "Seattle, WA — Baba Yaga"],
    ["Thu 3/26", "Boise, ID — Treefort"],
    ["Sat 3/28", "San Francisco, CA — Brick + Mortar"],
    ["Mon 3/30", "San Diego, CA — Voodoo Room @ House of Blues"],
    ["Fri 4/3", "Los Angeles, CA — The Wiltern"],
    ["Sat 4/4", "Phoenix, AZ — The Van Buren"],
    ["Mon 4/6", "Salt Lake City, UT — The Union"],
    ["Wed 4/8", "Denver, CO — Paramount Theater"],
    ["Fri 4/10", "Dallas, TX — House of Blues"],
    ["Sat 4/11", "Houston, TX — House of Blues"],
    ["Sun 4/12", "Austin, TX — ACL Live at the Moody Theater"],
  ];

  tourTable.innerHTML = rows.map(([d,v]) => `
    <div class="trow">
      <div class="tdate">${d}</div>
      <div class="tvenue">${v}</div>
    </div>
  `).join("");
}

async function init(){
  renderTour();
  pickPhoto();

  // Gift button toggle (Pretty Jane)
  pjBtn.addEventListener("click", () => {
    const isHidden = pjPanel.hasAttribute("hidden");
    if (isHidden) pjPanel.removeAttribute("hidden");
    else pjPanel.setAttribute("hidden", "");

    pjBtn.setAttribute("aria-expanded", isHidden ? "true" : "false");
  });

  // Use the main site manifest
  const res = await fetch("/manifest.json", { cache: "no-store" });
  manifest = await res.json();

  // images
  const imgs = manifest.images || {};
  imagePool = Object.values(imgs).flat();

  // finished tracks (strongest lane for EPK)
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
    if (e.code === "Space"){
      e.preventDefault();
      toggle();
    }
    if (e.code === "ArrowRight"){
      next();
    }
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
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const overlay = $("#overlay");
const roomTitle = $("#roomTitle");
const roomBody = $("#roomBody");
const statusLine = $("#statusLine");
const quickFacts = $("#quickFacts");
const latestLine = $("#latestLine");

const audio = $("#audio");
const nowTitle = $("#nowTitle");
const btnPlay = $("#btnPlay");
const btnPrev = $("#btnPrev");
const btnNext = $("#btnNext");
const seek = $("#seek");
const tCur = $("#tCur");
const tDur = $("#tDur");

const palette = $("#palette");
const palInput = $("#palInput");
const palList = $("#palList");
const btnCmd = $("#btnCmd");

let MANIFEST = null;
let TRACKS = [];
let currentIndex = -1;
let isPlaying = false;

const ROOMS = [
  { id:"work", title:"Work — Featured", desc:"Finished songs + key pieces" },
  { id:"archive", title:"Archive — Demos / Board Tapes", desc:"Day-one stuff, the raw folder" },
  { id:"live", title:"Live — Chaos + proof", desc:"Photos now, video hooks later" },
  { id:"photos", title:"Photos — Years of the project", desc:"Gallery by folder" },
  { id:"about", title:"About", desc:"Who you are, what you do" },
  { id:"contact", title:"Contact", desc:"Booking / links / email" },
];

init().catch(err => {
  console.error(err);
  statusLine.textContent = "Couldn’t load manifest.json. (Run npm run generate + push)";
  quickFacts.textContent = "manifest.json missing or unreadable.";
});

async function init(){
  wireUI();
  statusLine.textContent = "Loading manifest.json…";

  MANIFEST = await loadManifest();
  const files = normalizeFiles(MANIFEST);

  const imgs = files.filter(p => isImage(p));
  const auds = files.filter(p => isAudio(p));

  TRACKS = auds.map(p => ({ path:p, title: prettifyName(p) }));

  statusLine.textContent = `Loaded ${imgs.length} photos • ${TRACKS.length} audio files`;
  quickFacts.textContent = `${imgs.length} photos • ${TRACKS.length} audio files • local-first`;
  latestLine.textContent = pickLatestLine(imgs, TRACKS);

  // Hash routing
  routeFromHash();

  // Default room if user clicks / deep links
  window.addEventListener("hashchange", routeFromHash);

  // Build command palette list
  buildPalette();
}

function wireUI(){
  // Open room buttons
  $$("[data-open]").forEach(btn => {
    btn.addEventListener("click", () => openRoom(btn.dataset.open));
  });

  // Close overlay
  $$("[data-close]").forEach(el => el.addEventListener("click", closeRoom));

  // Keyboard
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape"){
      if (palette.getAttribute("aria-hidden") === "false") closePalette();
      else closeRoom();
    }
    if ((e.key.toLowerCase() === "k") && !e.metaKey && !e.ctrlKey && !e.altKey){
      // If typing in an input, don't steal focus
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag !== "input" && tag !== "textarea") openPalette();
    }
  });

  // Command palette open
  btnCmd?.addEventListener("click", openPalette);
  $$("[data-pal-close]").forEach(el => el.addEventListener("click", closePalette));

  palInput?.addEventListener("input", () => filterPalette(palInput.value));
  palInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter"){
      const first = $(".palItem", palList);
      if (first) first.click();
    }
    if (e.key === "Escape") closePalette();
  });

  // Audio controls
  btnPlay.addEventListener("click", togglePlay);
  btnPrev.addEventListener("click", () => playIndex(currentIndex - 1));
  btnNext.addEventListener("click", () => playIndex(currentIndex + 1));

  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    seek.value = String(Math.floor((audio.currentTime / audio.duration) * 100));
    tCur.textContent = fmtTime(audio.currentTime);
  });

  audio.addEventListener("loadedmetadata", () => {
    tDur.textContent = fmtTime(audio.duration || 0);
  });

  audio.addEventListener("ended", () => {
    isPlaying = false;
    btnPlay.textContent = "Play";
    playIndex(currentIndex + 1);
  });

  seek.addEventListener("input", () => {
    if (!audio.duration) return;
    const pct = Number(seek.value) / 100;
    audio.currentTime = pct * audio.duration;
  });
}

async function loadManifest(){
  // Works on Netlify and local server
  const res = await fetch("./manifest.json", { cache:"no-store" });
  if (!res.ok) throw new Error(`manifest.json fetch failed: ${res.status}`);
  return await res.json();
}

function normalizeFiles(man){
  // Accept multiple shapes:
  // 1) { files: [...] }
  // 2) { photos: [...], audio: [...] }
  // 3) [ "assets/..." , ... ]
  if (Array.isArray(man)) return man;
  if (man?.files && Array.isArray(man.files)) return man.files;
  const out = [];
  for (const key of ["photos","images","img","audio","songs","tracks","videos"]){
    if (Array.isArray(man?.[key])) out.push(...man[key]);
  }
  // fallback: flatten any arrays in object
  if (!out.length && man && typeof man === "object"){
    Object.values(man).forEach(v => { if (Array.isArray(v)) out.push(...v); });
  }
  return out.filter(Boolean);
}

function isImage(p){ return /\.(png|jpe?g|webp|gif|heic)$/i.test(p); }
function isAudio(p){ return /\.(mp3|wav|m4a|aac|ogg)$/i.test(p); }

function prettifyName(path){
  const base = path.split("/").pop() || path;
  const noExt = base.replace(/\.[^.]+$/, "");
  return decodeURIComponent(noExt)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickLatestLine(imgs, tracks){
  const imgHint = imgs.length ? `Latest photo loaded.` : `No photos yet.`;
  const trHint = tracks.length ? `Audio dock ready.` : `No audio yet.`;
  return `${imgHint} ${trHint}`;
}

function openRoom(id){
  const room = ROOMS.find(r => r.id === id) || ROOMS[0];
  roomTitle.textContent = room.title;

  // Update hash
  history.replaceState(null, "", `#room=${room.id}`);

  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  renderRoom(room.id);
}

function closeRoom(){
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  roomBody.innerHTML = "";
  // Clear hash
  history.replaceState(null, "", "#");
}

function routeFromHash(){
  const m = location.hash.match(/room=([a-z]+)/i);
  if (m && m[1]){
    openRoom(m[1].toLowerCase());
  }
}

function renderRoom(id){
  if (!MANIFEST){
    roomBody.innerHTML = `<p>manifest.json not loaded yet.</p>`;
    return;
  }

  const files = normalizeFiles(MANIFEST);
  const imgs = files.filter(isImage);
  const auds = files.filter(isAudio);

  if (id === "work"){
    roomBody.innerHTML = `
      <div class="tools">
        <input class="input" id="qWork" placeholder="Search finished tracks..." />
        <button class="pill" id="btnAllWork">All</button>
        <button class="pill" id="btnFinished">Finished</button>
        <button class="pill" id="btnDemos">Demos</button>
      </div>
      <div class="list" id="workList"></div>
      <p style="color:rgba(244,240,232,.6);margin-top:14px;">
        Tip: put “finished” files in <b>assets/audio/finished</b> and demos in <b>assets/audio/demos</b>.
      </p>
    `;

    const q = $("#qWork");
    const list = $("#workList");

    const all = auds.map(p => ({ path:p, title:prettifyName(p), bucket: bucketOf(p) }));

    const paint = (mode="all", query="") => {
      const qq = query.trim().toLowerCase();
      const rows = all
        .filter(x => mode==="all" ? true : x.bucket===mode)
        .filter(x => qq ? x.title.toLowerCase().includes(qq) : true)
        .slice(0, 200);

      list.innerHTML = rows.length ? rows.map((x,i) => rowHTML(x, i)).join("") : `<div style="color:rgba(244,240,232,.65)">Nothing yet.</div>`;
      $$("[data-play]", list).forEach(btn => {
        btn.addEventListener("click", () => {
          const path = btn.getAttribute("data-play");
          const idx = TRACKS.findIndex(t => t.path === path);
          playIndex(idx);
        });
      });
    };

    $("#btnAllWork").addEventListener("click", ()=>paint("all", q.value));
    $("#btnFinished").addEventListener("click", ()=>paint("finished", q.value));
    $("#btnDemos").addEventListener("click", ()=>paint("demos", q.value));
    q.addEventListener("input", ()=>paint("all", q.value));

    paint("all","");

    return;
  }

  if (id === "archive"){
    roomBody.innerHTML = `
      <div class="tools">
        <input class="input" id="qArch" placeholder="Search the archive..." />
        <button class="pill" id="btnArchAudio">Audio</button>
        <button class="pill" id="btnArchImg">Images</button>
      </div>
      <div id="archOut"></div>
    `;

    const q = $("#qArch");
    const out = $("#archOut");
    let mode = "audio";

    const paint = () => {
      const qq = q.value.trim().toLowerCase();
      if (mode === "audio"){
        const rows = TRACKS
          .filter(t => qq ? t.title.toLowerCase().includes(qq) : true)
          .slice(0, 250);

        out.innerHTML = `<div class="list">${
          rows.map((t) => `
            <div class="row">
              <div class="row__left">
                <div class="row__title">${escapeHTML(t.title)}</div>
                <div class="row__meta">${escapeHTML(shortPath(t.path))}</div>
              </div>
              <button class="row__btn" data-play="${escapeAttr(t.path)}">Play</button>
            </div>
          `).join("")
        }</div>`;

        $$("[data-play]", out).forEach(btn => {
          btn.addEventListener("click", () => {
            const path = btn.getAttribute("data-play");
            const idx = TRACKS.findIndex(x => x.path === path);
            playIndex(idx);
          });
        });
      } else {
        const rows = imgs
          .filter(p => qq ? prettifyName(p).toLowerCase().includes(qq) : true)
          .slice(0, 90);

        out.innerHTML = `<div class="grid">${
          rows.map(p => tileHTML(p)).join("")
        }</div>`;
      }
    };

    $("#btnArchAudio").addEventListener("click", ()=>{ mode="audio"; paint(); });
    $("#btnArchImg").addEventListener("click", ()=>{ mode="img"; paint(); });
    q.addEventListener("input", paint);

    paint();
    return;
  }

  if (id === "live"){
    const liveImgs = imgs.filter(p => /\/live\//i.test(p));
    roomBody.innerHTML = `
      <p style="color:rgba(244,240,232,.8);line-height:1.6;max-width:70ch;">
        This room is built for proof. Right now it shows <b>live photos</b>.
        Later we’ll add a “Video Wall” that uses local MP4 files (or YouTube links if you want lightweight).
      </p>
      <div class="grid">
        ${liveImgs.slice(0, 60).map(p => tileHTML(p)).join("")}
      </div>
    `;
    return;
  }

  if (id === "photos"){
    const groups = groupByFolder(imgs);
    roomBody.innerHTML = `
      <div class="tools">
        <input class="input" id="qPhotos" placeholder="Search photos..." />
      </div>
      <div id="photosOut"></div>
    `;
    const q = $("#qPhotos");
    const out = $("#photosOut");

    const paint = () => {
      const qq = q.value.trim().toLowerCase();
      const blocks = Object.entries(groups).map(([folder, arr]) => {
        const filtered = qq
          ? arr.filter(p => prettifyName(p).toLowerCase().includes(qq) || folder.toLowerCase().includes(qq))
          : arr;

        if (!filtered.length) return "";
        const head = `<div style="margin:16px 0 10px;color:rgba(244,240,232,.75);letter-spacing:1px;text-transform:uppercase;font-size:12px;">${escapeHTML(folder)} (${filtered.length})</div>`;
        const grid = `<div class="grid">${filtered.slice(0, 30).map(p => tileHTML(p)).join("")}</div>`;
        return head + grid;
      }).join("");

      out.innerHTML = blocks || `<div style="color:rgba(244,240,232,.65)">No photos found.</div>`;
    };

    q.addEventListener("input", paint);
    paint();
    return;
  }

  if (id === "about"){
    roomBody.innerHTML = `
      <p style="color:rgba(244,240,232,.85);line-height:1.8;max-width:72ch;">
        I make indie/alt music that’s honest, cinematic, and built on storytelling.
        This site is my “everything folder” — finished work, raw demos, and the live proof.
      </p>
      <div style="margin-top:14px;color:rgba(244,240,232,.70);line-height:1.7;max-width:72ch;">
        <div><b>Based in:</b> Nashville, TN</div>
        <div><b>Sound:</b> indie rock / alternative / pop • warm + gritty</div>
        <div><b>North Star:</b> make people feel seen, then give them a hook they can’t forget</div>
      </div>
      <p style="margin-top:14px;color:rgba(244,240,232,.60);line-height:1.7;max-width:72ch;">
        Want this to feel even more “Boss”? Next pass we’ll add:
        tour-poster typography, a “timeline” room, and a proper press-kit panel.
      </p>
    `;
    return;
  }

  if (id === "contact"){
    roomBody.innerHTML = `
      <p style="color:rgba(244,240,232,.85);line-height:1.8;max-width:72ch;">
        Booking, collabs, sessions, or label/management interest — hit me here:
      </p>
      <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px;">
        <div class="row">
          <div class="row__left">
            <div class="row__title">Email</div>
            <div class="row__meta">claybrown530@gmail.com</div>
          </div>
          <a class="row__btn" href="mailto:claybrown530@gmail.com">Send</a>
        </div>
        <div class="row">
          <div class="row__left">
            <div class="row__title">Press / EPK</div>
            <div class="row__meta">Coming next (we’ll build a clean panel)</div>
          </div>
          <button class="row__btn" data-close type="button">Close</button>
        </div>
      </div>
    `;
    return;
  }

  roomBody.innerHTML = `<p>Unknown room.</p>`;
}

/* ---------- Audio ---------- */

function bucketOf(path){
  if (/\/finished\//i.test(path)) return "finished";
  if (/\/demo|\/demos|\/board/i.test(path)) return "demos";
  return "finished";
}

function playIndex(idx){
  if (!TRACKS.length) return;
  if (idx < 0) idx = TRACKS.length - 1;
  if (idx >= TRACKS.length) idx = 0;

  currentIndex = idx;
  const t = TRACKS[currentIndex];
  audio.src = t.path;
  nowTitle.textContent = t.title;
  audio.play().then(() => {
    isPlaying = true;
    btnPlay.textContent = "Pause";
  }).catch(() => {
    isPlaying = false;
    btnPlay.textContent = "Play";
  });
}

function togglePlay(){
  if (!TRACKS.length){
    // if user hits play with no track loaded, load first
    if (currentIndex === -1 && TRACKS[0]) playIndex(0);
    return;
  }
  if (!audio.src && TRACKS[0]) playIndex(0);

  if (isPlaying){
    audio.pause();
    isPlaying = false;
    btnPlay.textContent = "Play";
  } else {
    audio.play().then(() => {
      isPlaying = true;
      btnPlay.textContent = "Pause";
    }).catch(() => {
      isPlaying = false;
      btnPlay.textContent = "Play";
    });
  }
}

/* ---------- Command Palette ---------- */

function buildPalette(){
  palList.innerHTML = ROOMS.map(r => `
    <div class="palItem" data-room="${r.id}">
      <div style="font-family:var(--cond);letter-spacing:.8px;font-size:16px;">${escapeHTML(r.id)}</div>
      <div style="color:rgba(244,240,232,.70);font-size:12px;margin-top:4px;">${escapeHTML(r.desc)}</div>
    </div>
  `).join("");

  $$("[data-room]", palList).forEach(item => {
    item.addEventListener("click", () => {
      const id = item.getAttribute("data-room");
      closePalette();
      openRoom(id);
    });
  });
}

function openPalette(){
  palette.setAttribute("aria-hidden","false");
  palInput.value = "";
  filterPalette("");
  setTimeout(() => palInput.focus(), 30);
}

function closePalette(){
  palette.setAttribute("aria-hidden","true");
}

function filterPalette(q){
  const qq = q.trim().toLowerCase();
  $$("[data-room]", palList).forEach(item => {
    const id = (item.getAttribute("data-room") || "").toLowerCase();
    item.style.display = (!qq || id.includes(qq)) ? "" : "none";
  });
}

/* ---------- Helpers ---------- */

function groupByFolder(imgs){
  const map = {};
  imgs.forEach(p => {
    // assets/img/<folder>/file.jpg
    const parts = p.split("/");
    const idx = parts.findIndex(x => x === "img");
    let folder = "misc";
    if (idx !== -1 && parts[idx+1]) folder = parts[idx+1];
    map[folder] = map[folder] || [];
    map[folder].push(p);
  });
  return map;
}

function tileHTML(path){
  const cap = prettifyName(path);
  return `
    <div class="tile">
      <img class="tile__img" loading="lazy" src="${escapeAttr(path)}" alt="${escapeAttr(cap)}" />
      <div class="tile__cap">${escapeHTML(cap)}</div>
    </div>
  `;
}

function rowHTML(x){
  return `
    <div class="row">
      <div class="row__left">
        <div class="row__title">${escapeHTML(x.title)}</div>
        <div class="row__meta">${escapeHTML(shortPath(x.path))}</div>
      </div>
      <button class="row__btn" data-play="${escapeAttr(x.path)}">Play</button>
    </div>
  `;
}

function shortPath(p){
  return p.replace(/^\.?\//,"");
}

function fmtTime(sec){
  sec = Math.max(0, Number(sec || 0));
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2,"0")}`;
}

function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}
function escapeAttr(s){
  return escapeHTML(s).replace(/"/g, "&quot;");
}

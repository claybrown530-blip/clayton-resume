// generate-manifest.js
// Creates manifest.json with grouped image + audio file lists.
// Run: npm run generate

const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const assetsDir = path.join(projectRoot, "assets");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg"]);
const VIDEO_EXT = new Set([".mp4", ".mov", ".webm"]); // future

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function rel(p) {
  // convert to web path
  const rp = path.relative(projectRoot, p).split(path.sep).join("/");
  return rp;
}

function groupFiles(base, groups, extSet) {
  const result = {};
  for (const g of groups) {
    const dir = path.join(base, g);
    const files = walk(dir)
      .filter(f => extSet.has(path.extname(f).toLowerCase()))
      .map(rel)
      .sort((a, b) => a.localeCompare(b));
    result[g] = files;
  }
  return result;
}

function main() {
  const imagesBase = path.join(assetsDir, "img");
  const audioBase = path.join(assetsDir, "audio");
  const videoBase = path.join(assetsDir, "video"); // optional later

  const manifest = {
    generatedAt: new Date().toISOString(),
    images: groupFiles(imagesBase, ["live", "studio", "candid", "artwork"], IMAGE_EXT),
    audio: groupFiles(audioBase, ["finished", "demos", "boardtapes", "day1-demos", "board-tapes"], AUDIO_EXT),
    video: groupFiles(videoBase, ["live"], VIDEO_EXT)
  };

  fs.writeFileSync(path.join(projectRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  const imgCount = Object.values(manifest.images).reduce((a, arr) => a + arr.length, 0);
  const audCount = Object.values(manifest.audio).reduce((a, arr) => a + arr.length, 0);

  console.log(`Manifest generated with ${audCount} audio and ${imgCount} photos`);
}

main();

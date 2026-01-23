// generate-manifest.js
const fs = require('fs');
const path = require('path');

const baseDirs = {
  day1: 'assets/audio/day1-demos',
  finished: 'assets/audio/finished',
  tapes: 'assets/audio/board-tapes',
  videos: 'assets/video',
  photos: 'assets/img'
};

function getFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath).filter((f) => {
    const full = path.join(dirPath, f);
    return fs.statSync(full).isFile();
  });
}

const manifest = {
  audio: {
    day1: [],
    finished: [],
    tapes: []
  },
  videos: [],
  photos: []
};

['day1', 'finished', 'tapes'].forEach((lane) => {
  const files = getFiles(baseDirs[lane]);
  files.forEach((file) => {
    manifest.audio[lane].push({
      filename: file,
      path: `${baseDirs[lane]}/${file}`
    });
  });
});

getFiles(baseDirs.videos).forEach((file) => {
  manifest.videos.push({
    filename: file,
    path: `${baseDirs.videos}/${file}`
  });
});

function walkPhotoDirs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPhotoDirs(full);
    } else if (entry.isFile()) {
      manifest.photos.push({
        filename: entry.name,
        path: full.replace(/\\/g, '/')
      });
    }
  });
}
walkPhotoDirs(baseDirs.photos);

fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
console.log('Manifest generated with', manifest.photos.length, 'photos');

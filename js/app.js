// js/app.js

// Utility to shuffle an array
function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

// Build the hero gallery
function renderHeroGallery(photos) {
  const grid = document.getElementById('heroGrid');
  if (!grid) return;
  // Choose up to 8 photos
  const selected = shuffle(photos).slice(0, 8);
  selected.forEach((p) => {
    const img = document.createElement('img');
    img.src = p.path;
    img.alt = p.filename;
    grid.appendChild(img);
  });
}

// Create a card for featured work
function createFeaturedCard(title, note, filePath) {
  const article = document.createElement('article');
  article.className = 'card';

  const h3 = document.createElement('h3');
  h3.textContent = title;

  const p = document.createElement('p');
  p.textContent = note;

  const audio = document.createElement('audio');
  audio.controls = true;
  audio.preload = 'metadata';
  audio.src = filePath;

  article.appendChild(h3);
  article.appendChild(p);
  article.appendChild(audio);

  return article;
}

// Render the featured section
function renderFeatured(manifest) {
  const container = document.getElementById('featuredGrid');
  if (!container) return;
  // Choose first item from each lane
  ['day1', 'finished', 'tapes'].forEach((lane) => {
    const items = manifest.audio[lane];
    if (items && items.length > 0) {
      const item = items[0];
      const title = `${lane.charAt(0).toUpperCase() + lane.slice(1)} — ${item.filename}`;
      const note = `Featured from ${lane}`;
      const card = createFeaturedCard(title, note, item.path);
      container.appendChild(card);
    }
  });
}

// Render the archive list
function renderArchive(manifest) {
  const container = document.getElementById('archiveGrid');
  if (!container) return;
  let count = 1;
  ['day1', 'finished', 'tapes'].forEach((lane) => {
    manifest.audio[lane].forEach((item) => {
      const div = document.createElement('div');
      div.className = 'archive-item';
      const num = document.createElement('span');
      num.className = 'number';
      num.textContent = String(count).padStart(2, '0');
      const title = document.createElement('span');
      title.textContent = `${lane} — ${item.filename}`;
      div.appendChild(num);
      div.appendChild(title);
      // click to open audio in a new window
      div.addEventListener('click', () => {
        const audioWin = window.open('', '_blank', 'width=400,height=100');
        audioWin.document.write(`<audio controls autoplay src="${item.path}"></audio>`);
      });
      container.appendChild(div);
      count += 1;
    });
  });
}

// Populate the year in the footer
document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
});

// Fetch the manifest and render sections
fetch('manifest.json')
  .then((res) => res.json())
  .then((manifest) => {
    // If there are photos, build a mosaic hero
    if (manifest.photos && manifest.photos.length) {
      renderHeroGallery(manifest.photos);
    }
    // Render featured cards
    renderFeatured(manifest);
    // Render archive list
    renderArchive(manifest);
  })
  .catch((err) => {
    console.error('Error loading manifest:', err);
  });

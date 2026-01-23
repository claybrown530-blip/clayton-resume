(function () {
  const DATA = window.CLAYTON_DATA;

  // Year
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  // Smooth scroll chips
  document.querySelectorAll("[data-scrollto]").forEach(btn => {
    btn.addEventListener("click", () => {
      const sel = btn.getAttribute("data-scrollto");
      const el = document.querySelector(sel);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // Copy buttons
  const copyTextBtn = document.getElementById("copyTextBtn");
  const copyAllBtn = document.getElementById("copyAllBtn");

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch (err) {
        document.body.removeChild(ta);
        return false;
      }
    }
  }

  if (copyTextBtn) {
    copyTextBtn.addEventListener("click", async () => {
      const ok = await copyToClipboard(DATA.contact.phoneCopy);
      copyTextBtn.textContent = ok ? "Copied ✅" : "Copy failed";
      setTimeout(() => (copyTextBtn.textContent = "Copy my number"), 1200);
    });
  }

  if (copyAllBtn) {
    copyAllBtn.addEventListener("click", async () => {
      const blob = `Clayton Brown\nText: ${DATA.contact.phoneDisplay}\nEmail: ${DATA.contact.email}`;
      const ok = await copyToClipboard(blob);
      copyAllBtn.textContent = ok ? "Copied ✅" : "Copy failed";
      setTimeout(() => (copyAllBtn.textContent = "Copy contact"), 1200);
    });
  }

  // Tabs + Work rendering
  const workGrid = document.getElementById("workGrid");
  const tabs = document.querySelectorAll(".tab");

  function trackCard(t) {
    const wrap = document.createElement("article");
    wrap.className = "track";

    const img = document.createElement("img");
    img.className = "track__art";
    img.src = t.art;
    img.alt = t.title;

    const body = document.createElement("div");
    body.className = "track__body";

    const h = document.createElement("h3");
    h.className = "track__title";
    h.textContent = t.title;

    const meta = document.createElement("p");
    meta.className = "track__meta";
    meta.textContent = t.meta;

    const audio = document.createElement("audio");
    audio.setAttribute("controls", "controls");
    audio.setAttribute("preload", "metadata");

    const source = document.createElement("source");
    source.src = t.audio;
    source.type = "audio/mpeg";

    audio.appendChild(source);

    body.appendChild(h);
    body.appendChild(meta);
    body.appendChild(audio);

    wrap.appendChild(img);
    wrap.appendChild(body);
    return wrap;
  }

  function renderWork(key) {
    if (!workGrid) return;
    workGrid.innerHTML = "";
    const list = DATA.work[key] || [];
    list.forEach(t => workGrid.appendChild(trackCard(t)));
  }

  function setActiveTab(key) {
    tabs.forEach(t => {
      const is = t.dataset.tab === key;
      t.classList.toggle("is-active", is);
      t.setAttribute("aria-selected", is ? "true" : "false");
    });
    renderWork(key);
  }

  tabs.forEach(t => t.addEventListener("click", () => setActiveTab(t.dataset.tab)));
  setActiveTab("day1");

  // Gallery render + modal
  const galleryGrid = document.getElementById("galleryGrid");
  const modal = document.getElementById("modal");
  const modalImg = document.getElementById("modalImg");
  const modalClose = document.getElementById("modalClose");

  function openModal(src, alt) {
    if (!modal || !modalImg) return;
    modalImg.src = src;
    modalImg.alt = alt || "Preview";
    modal.classList.remove("is-hidden");
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.add("is-hidden");
    if (modalImg) modalImg.src = "";
  }

  if (galleryGrid) {
    DATA.gallery.forEach((g) => {
      const b = document.createElement("button");
      b.className = "thumb";
      b.type = "button";

      const img = document.createElement("img");
      img.src = g.src;
      img.alt = g.alt;

      b.appendChild(img);
      b.addEventListener("click", () => openModal(g.src, g.alt));
      galleryGrid.appendChild(b);
    });
  }

  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  // Resume PDF auto-link (won't break if missing)
  const resumeLink = document.getElementById("resumeLink");
  if (resumeLink) {
    // Can't truly check file existence reliably without server-side,
    // but we can show the link anyway; user can remove if not needed.
    resumeLink.classList.remove("is-hidden");
  }
})();

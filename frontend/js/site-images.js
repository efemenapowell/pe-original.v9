/* ============================================================
   PE_ORIGINALS — js/site-images.js
   Applies admin-managed "heading"/marketing images (hero,
   category cards, story banners, Instagram strip, etc.) that
   are stored as ContentBlock rows (type: "image") and served
   via GET /api/content, e.g.:
     home.hero.image, home.category.dresses.image,
     home.story.image, home.instagram.1 … home.instagram.5,
     about.story.image, about.sustainability.image

   Any <img data-content-key="..."> on the page ships with
   images/placeholder.svg as its baked-in src. On load, this
   script swaps in the real image if the admin has set one for
   that key — the site never ships hardcoded stock photos, and
   never breaks if the backend is unreachable (placeholder just
   stays).
   Runs AFTER js/api.js.
   ============================================================ */

(function () {
  "use strict";

  async function applyContentImages() {
    const nodes = document.querySelectorAll("img[data-content-key]");
    if (!nodes.length) return;

    let content;
    try {
      const api = window.PEOAPI || window.API;
      if (!api || typeof api.getContent !== "function" || window.location.protocol === "file:") return;
      content = await api.getContent();
    } catch (err) {
      console.info("[site-images] backend unavailable, keeping placeholders");
      return;
    }
    if (!content) return;

    nodes.forEach((img) => {
      const key = img.getAttribute("data-content-key");
      const url = content[key];
      if (url && typeof url === "string" && url.trim()) {
        img.src = url;
        img.classList.remove("img-unset");
      } else {
        img.classList.add("img-unset");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyContentImages);
  } else {
    applyContentImages();
  }
})();

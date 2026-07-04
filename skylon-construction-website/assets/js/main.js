/* ==========================================================================
   SKYLON CONSTRUCTION — main.js
   1. Header state (top / scrolled)
   2. Mobile navigation
   3. Scroll reveal
   4. Category filters (projects & gallery)
   5. Gallery lightbox (keyboard accessible)
   6. Footer year
   ========================================================================== */

(function () {
  "use strict";

  var prefersReducedMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 1. HEADER STATE -------------------------------------------------------- */
  var header = document.querySelector(".site-header");

  function updateHeader() {
    if (!header) return;
    var y = window.scrollY || window.pageYOffset;
    header.classList.toggle("is-top", y < 24);
    header.classList.toggle("is-scrolled", y > 24);
  }
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  /* 2. MOBILE NAVIGATION ---------------------------------------------------- */
  var navToggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");

  function setNav(open) {
    if (!nav || !navToggle) return;
    nav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("nav-open", open);
  }

  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      setNav(!nav.classList.contains("is-open"));
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setNav(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        setNav(false);
        navToggle.focus();
      }
    });
  }

  /* 2b. NAV DROPDOWNS ------------------------------------------------------- */
  var subItems = Array.prototype.slice.call(
    document.querySelectorAll(".nav__item--sub")
  );

  function closeSubs(except) {
    subItems.forEach(function (item) {
      if (item !== except) {
        item.classList.remove("is-open");
        var b = item.querySelector(".nav__parent");
        if (b) b.setAttribute("aria-expanded", "false");
      }
    });
  }

  subItems.forEach(function (item) {
    var btn = item.querySelector(".nav__parent");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var open = item.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
      closeSubs(item);
    });
  });

  if (subItems.length) {
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".nav__item--sub")) closeSubs(null);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeSubs(null);
    });
  }

  /* 3. SCROLL REVEAL --------------------------------------------------------- */
  var revealItems = document.querySelectorAll(".reveal");

  if (revealItems.length) {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealItems.forEach(function (el) { el.classList.add("is-visible"); });
    } else {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
      );
      revealItems.forEach(function (el) { io.observe(el); });
    }
  }

  /* 4. CATEGORY FILTERS ------------------------------------------------------ */
  var filterBar = document.querySelector("[data-filter-bar]");

  if (filterBar) {
    var filterButtons = filterBar.querySelectorAll(".filter-btn");
    var filterables = document.querySelectorAll("[data-cat]");

    filterBar.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-btn");
      if (!btn) return;

      var value = btn.getAttribute("data-filter");

      filterButtons.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });

      filterables.forEach(function (item) {
        var cats = (item.getAttribute("data-cat") || "").split(" ");
        var show = value === "all" || cats.indexOf(value) !== -1;
        item.hidden = !show;
      });
    });
  }

  /* 5. LIGHTBOX --------------------------------------------------------------- */
  var galleryItems = Array.prototype.slice.call(
    document.querySelectorAll(".masonry__item")
  );

  if (galleryItems.length) {
    var lightbox = null;
    var lbImage, lbTitle, lbCounter, lbPrev, lbNext, lbClose;
    var currentIndex = 0;
    var lastFocused = null;

    function visibleItems() {
      return galleryItems.filter(function (item) { return !item.hidden; });
    }

    function buildLightbox() {
      lightbox = document.createElement("div");
      lightbox.className = "lightbox";
      lightbox.setAttribute("role", "dialog");
      lightbox.setAttribute("aria-modal", "true");
      lightbox.setAttribute("aria-label", "Image viewer");
      lightbox.hidden = true;

      lightbox.innerHTML =
        '<figure class="lightbox__figure">' +
        '  <img class="lightbox__img" src="" alt="">' +
        '  <figcaption class="lightbox__caption">' +
        '    <span class="lightbox__counter"></span>' +
        '    <span class="lightbox__title"></span>' +
        "  </figcaption>" +
        "</figure>" +
        '<button type="button" class="lightbox__btn lightbox__close" aria-label="Close viewer">' +
        '  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
        "</button>" +
        '<button type="button" class="lightbox__btn lightbox__prev" aria-label="Previous image">' +
        '  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        "</button>" +
        '<button type="button" class="lightbox__btn lightbox__next" aria-label="Next image">' +
        '  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        "</button>";

      document.body.appendChild(lightbox);

      lbImage = lightbox.querySelector(".lightbox__img");
      lbTitle = lightbox.querySelector(".lightbox__title");
      lbCounter = lightbox.querySelector(".lightbox__counter");
      lbPrev = lightbox.querySelector(".lightbox__prev");
      lbNext = lightbox.querySelector(".lightbox__next");
      lbClose = lightbox.querySelector(".lightbox__close");

      lbClose.addEventListener("click", closeLightbox);
      lbPrev.addEventListener("click", function () { step(-1); });
      lbNext.addEventListener("click", function () { step(1); });

      lightbox.addEventListener("click", function (e) {
        if (e.target === lightbox) closeLightbox();
      });

      lightbox.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { closeLightbox(); return; }
        if (e.key === "ArrowLeft") { step(-1); return; }
        if (e.key === "ArrowRight") { step(1); return; }
        if (e.key === "Tab") {
          // Simple focus trap between the three controls
          var focusables = [lbClose, lbPrev, lbNext];
          var idx = focusables.indexOf(document.activeElement);
          if (e.shiftKey && (idx === 0 || idx === -1)) {
            e.preventDefault();
            focusables[focusables.length - 1].focus();
          } else if (!e.shiftKey && idx === focusables.length - 1) {
            e.preventDefault();
            focusables[0].focus();
          }
        }
      });
    }

    function render() {
      var items = visibleItems();
      var item = items[currentIndex];
      if (!item) return;

      var img = item.querySelector("img");
      var caption = item.querySelector(".masonry__caption strong");

      // Load a clean copy of the image at full size
      lbImage.src = img.currentSrc || img.src;
      lbImage.alt = img.alt || "";
      lbTitle.textContent = caption ? caption.textContent : "";
      lbCounter.textContent =
        String(currentIndex + 1).padStart(2, "0") +
        " / " +
        String(items.length).padStart(2, "0");

      var single = items.length < 2;
      lbPrev.hidden = single;
      lbNext.hidden = single;
    }

    function openLightbox(item) {
      if (!lightbox) buildLightbox();
      var items = visibleItems();
      currentIndex = Math.max(0, items.indexOf(item));
      lastFocused = document.activeElement;
      render();
      lightbox.hidden = false;
      document.body.classList.add("lightbox-open");
      lbClose.focus();
    }

    function closeLightbox() {
      lightbox.hidden = true;
      document.body.classList.remove("lightbox-open");
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      }
    }

    function step(dir) {
      var items = visibleItems();
      currentIndex = (currentIndex + dir + items.length) % items.length;
      render();
    }

    galleryItems.forEach(function (item) {
      item.addEventListener("click", function () { openLightbox(item); });
    });
  }

  /* 5b. HERO VIDEO — respect reduced motion ------------------------------- */
  var heroVideo = document.querySelector(".hero__media video");
  if (heroVideo && prefersReducedMotion) {
    heroVideo.removeAttribute("autoplay");
    heroVideo.pause();
  }

  /* 6. FOOTER YEAR ------------------------------------------------------------ */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();

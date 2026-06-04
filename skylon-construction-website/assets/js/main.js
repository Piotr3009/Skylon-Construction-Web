/* ==========================================================================
   SKYLON CONSTRUCTION — main.js
   Vanilla JS, no dependencies. Progressive enhancement only.
     1. Mobile navigation toggle (accessible, aria-expanded)
     2. Header shadow on scroll
     3. Project filter (projects.html)
     4. FAQ / accordion
     5. Current year in footer
     6. Demo form submit prevention + message
     7. Scroll reveal (respects prefers-reduced-motion)
   ========================================================================== */
(function () {
  "use strict";

  /* ---- 1. Mobile navigation toggle ------------------------------------ */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector("#primary-nav");
  var body = document.body;

  function closeNav() {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
    body.classList.remove("is-locked");
  }

  function openNav() {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", "true");
    nav.classList.add("is-open");
    body.classList.add("is-locked");
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var expanded = toggle.getAttribute("aria-expanded") === "true";
      expanded ? closeNav() : openNav();
    });

    // Close when a nav link is tapped (mobile)
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeNav();
    });

    // Close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        closeNav();
        toggle.focus();
      }
    });

    // Reset when resizing back to desktop
    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) closeNav();
    });
  }

  /* ---- 2. Header shadow on scroll ------------------------------------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- 3. Project filter ---------------------------------------------- */
  var filterWrap = document.querySelector("[data-filters]");
  if (filterWrap) {
    var buttons = filterWrap.querySelectorAll(".filter-btn");
    var items = document.querySelectorAll("[data-project]");

    filterWrap.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-btn");
      if (!btn) return;

      buttons.forEach(function (b) {
        b.classList.remove("is-active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-pressed", "true");

      var filter = btn.getAttribute("data-filter");
      items.forEach(function (item) {
        var cats = (item.getAttribute("data-categories") || "").split(" ");
        var show = filter === "all" || cats.indexOf(filter) !== -1;
        item.hidden = !show;
      });
    });
  }

  /* ---- 4. FAQ / accordion --------------------------------------------- */
  var triggers = document.querySelectorAll(".accordion__trigger");
  triggers.forEach(function (trigger) {
    var panel = document.getElementById(trigger.getAttribute("aria-controls"));
    if (!panel) return;

    trigger.addEventListener("click", function () {
      var open = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", String(!open));
      if (open) {
        panel.style.maxHeight = null;
      } else {
        panel.style.maxHeight = panel.scrollHeight + "px";
      }
    });

    // Keep an open panel sized correctly on resize
    window.addEventListener("resize", function () {
      if (trigger.getAttribute("aria-expanded") === "true") {
        panel.style.maxHeight = panel.scrollHeight + "px";
      }
    });
  });

  /* ---- 5. Current year in footer -------------------------------------- */
  var yearEls = document.querySelectorAll("[data-year]");
  var year = new Date().getFullYear();
  yearEls.forEach(function (el) { el.textContent = year; });

  /* ---- 6. Demo form submit prevention --------------------------------- */
  // TODO: connect form to backend, CRM, email service or Zapier.
  var form = document.querySelector("[data-demo-form]");
  if (form) {
    var message = form.querySelector(".form-message");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (message) {
        message.hidden = false;
        message.textContent =
          "Thank you. This demo form needs to be connected before launch.";
        message.focus();
        message.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  /* ---- 7. Scroll reveal ----------------------------------------------- */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealEls = document.querySelectorAll(".reveal");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });

    revealEls.forEach(function (el) { io.observe(el); });
  }
})();

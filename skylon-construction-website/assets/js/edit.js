/* Skylon site editor — Phase 1: photo replacement.
   Activate: click the header logo 5 times, enter the team password. */
(function () {
  "use strict";

  var API = "/api/upload-image";
  var MAX_W = 1600;
  var QUALITY = 0.82;

  var css =
    ".edit-badge{position:fixed;bottom:14px;left:14px;z-index:9999;background:#0D2238;color:#DCE2E8;font:600 11px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;padding:9px 14px;border:1px solid rgba(197,206,215,.35);border-radius:999px}" +
    ".edit-wrap{position:relative}" +
    ".edit-pencil{position:absolute;top:8px;right:8px;z-index:50;width:34px;height:34px;border:0;border-radius:50%;background:#0D2238;color:#E9EDF1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(5,14,27,.5);opacity:.92}" +
    ".edit-pencil:hover{opacity:1;background:#143049}" +
    ".edit-modal{position:fixed;inset:0;z-index:10000;background:rgba(5,14,27,.72);display:flex;align-items:center;justify-content:center;padding:20px}" +
    ".edit-modal__box{background:#fff;border-radius:6px;max-width:420px;width:100%;padding:26px;font-family:Inter,sans-serif;color:#16202B}" +
    ".edit-modal__box h3{font:600 15px/1.3 Inter,sans-serif;margin:0 0 14px;letter-spacing:.02em}" +
    ".edit-modal__box input[type=password]{width:100%;padding:11px 12px;border:1px solid #C5CED7;border-radius:4px;font:400 14px Inter}" +
    ".edit-modal__box img{max-width:100%;max-height:260px;display:block;margin:0 auto 14px;border-radius:4px}" +
    ".edit-modal__row{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}" +
    ".edit-btn{padding:10px 16px;border-radius:4px;border:1px solid #C5CED7;background:#fff;font:600 11px Inter;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}" +
    ".edit-btn--primary{background:#0D2238;border-color:#0D2238;color:#E9EDF1}" +
    ".edit-msg{font:400 13px/1.5 Inter;color:#5A6B7C;margin-top:10px}" +
    "body.is-editing [data-edit]{outline:1px dashed rgba(90,120,150,.55);outline-offset:3px;cursor:text;min-height:1em}" +
    "body.is-editing [data-edit]:hover{outline-color:#3E6C97;background:rgba(62,108,151,.06)}" +
    "body.is-editing [data-edit].edit-dirty{outline:2px solid #B98A2F;background:rgba(185,138,47,.07)}" +
    ".edit-savebar{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:14px;align-items:center;background:#0D2238;border:1px solid rgba(197,206,215,.4);border-radius:10px;padding:14px 18px;box-shadow:0 18px 44px rgba(5,14,27,.55)}" +
    ".edit-savebar span{color:#DCE2E8;font:600 13px Inter;letter-spacing:.1em;text-transform:uppercase}" +
    ".edit-savebar .edit-btn{padding:13px 22px;font-size:13px}" +
    ".edit-modal__box{max-width:480px;padding:32px}" +
    ".edit-modal__box h3{font-size:18px}" +
    ".edit-modal__box input[type=password]{padding:15px 16px;font-size:17px}" +
    ".edit-modal__row .edit-btn{padding:13px 22px;font-size:13px}" +
    ".edit-toast{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10001;background:#0D2238;color:#F0E9DA;border:1px solid rgba(232,217,188,.5);border-radius:10px;padding:26px 34px;font:600 17px/1.5 Inter;text-align:center;max-width:440px;box-shadow:0 24px 60px rgba(5,14,27,.6)}" +
    ".edit-sec-tools{position:absolute;top:50%;right:18px;left:auto;transform:translateY(-50%);z-index:60;display:flex;flex-direction:column;gap:6px}" +
    ".edit-item-tools{position:absolute;top:8px;left:8px;z-index:60;display:flex;gap:6px}" +
    ".edit-mini{width:34px;height:34px;border:0;border-radius:8px;background:#0D2238;color:#E9EDF1;cursor:pointer;font:700 15px Inter;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(5,14,27,.5);opacity:.92}" +
    ".edit-mini:hover{opacity:1;background:#143049}" +
    ".edit-mini--del{background:#5C1E22}.edit-mini--del:hover{background:#7A272D}" +
    ".edit-addbar{display:flex;justify-content:center;margin-top:18px}" +
    ".edit-addbar .edit-btn{padding:13px 24px;font-size:13px;background:#0D2238;color:#E9EDF1;border-color:#0D2238}" +
    ".edit-catgrid{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}" +
    /* captions are hover-only for visitors; in edit mode they must be visible and clickable */
    "body.is-editing .masonry__caption{opacity:1;transform:none;pointer-events:auto}" +
    "body.is-editing .masonry__item::after{opacity:1}" +
    "body.is-editing .masonry__item{cursor:default}";

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function modal(innerHTML) {
    var m = el("div", "edit-modal");
    var box = el("div", "edit-modal__box", innerHTML);
    m.appendChild(box);
    m.addEventListener("click", function (e) {
      if (e.target === m) m.remove();
    });
    document.body.appendChild(m);
    return { root: m, box: box };
  }

  /* ---------- activation: 5 logo clicks ---------- */
  // auto-wznowienie: zalogowany w tej karcie = tryb edycji na kazdej stronie
  if (sessionStorage.getItem('skylonEditPw')) {
    setTimeout(enterEditMode, 0); // po zdefiniowaniu calego modulu
  }

  var clicks = 0, timer = null, navTimer = null;
  var logo = document.querySelector(".brand");
  if (!logo) return;
  logo.addEventListener("click", function (e) {
    e.preventDefault(); // we navigate manually below, so the click streak survives
    clicks += 1;
    clearTimeout(timer);
    clearTimeout(navTimer);
    timer = setTimeout(function () { clicks = 0; }, 2500);
    if (clicks >= 5) {
      clicks = 0;
      askPassword();
      return;
    }
    if (clicks === 1) {
      navTimer = setTimeout(function () {
        if (clicks === 1) {
          clicks = 0;
          window.location.href = logo.getAttribute("href") || "index.html";
        }
      }, 450);
    }
  });

  function askPassword() {
    if (sessionStorage.getItem("skylonEditPw")) { enterEditMode(); return; }
    var m = modal(
      "<h3>Site editor</h3>" +
      "<input type='password' placeholder='Team password' autocomplete='off'>" +
      "<div class='edit-msg edit-err' style='display:none;color:#B4232A'></div>" +
      "<div class='edit-modal__row'>" +
      "<button class='edit-btn' data-x>Cancel</button>" +
      "<button class='edit-btn edit-btn--primary' data-ok>Enter</button></div>"
    );
    var input = m.box.querySelector("input");
    input.focus();
    function go() {
      var pw = input.value;
      if (!pw) return;
      sessionStorage.setItem("skylonEditPw", pw);
      m.root.remove();
      enterEditMode();
    }
    m.box.querySelector("[data-ok]").addEventListener("click", go);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    m.box.querySelector("[data-x]").addEventListener("click", function () { m.root.remove(); });
  }

  /* ---------- edit mode ---------- */
  function enterEditMode() {
    if (document.body.classList.contains("is-editing")) return;
    document.body.classList.add("is-editing");
    var style = el("style"); style.textContent = css; document.head.appendChild(style);
    var badge = el("div", "edit-badge", "Edit mode &middot; photos + text");
    document.body.appendChild(badge);

    // Browsers do not let contenteditable work inside a <button>, so while
    // editing, gallery tiles become plain <div>s. Visitors still get buttons.
    document.querySelectorAll("button.masonry__item").forEach(function (btn) {
      var d = document.createElement("div");
      Array.prototype.forEach.call(btn.attributes, function (a) {
        if (a.name !== "type") d.setAttribute(a.name, a.value);
      });
      d.innerHTML = btn.innerHTML;
      d.classList.add("is-visible");
      btn.parentNode.replaceChild(d, btn);
    });

    var imgs = document.querySelectorAll('img[src^="assets/images/"]');
    imgs.forEach(function (img) {
      if (img.closest(".site-header") || img.closest(".footer")) return; // logos stay safe
      var holder = img.parentElement;
      // Hero media layers sit behind everything (z-index:-2), so a button placed
      // inside one is invisible and unclickable. Hang the pencil off the section.
      if (holder.classList.contains("page-hero__media") || holder.classList.contains("hero__media")) {
        holder = holder.closest("section") || holder;
      }
      holder.classList.add("edit-wrap");
      var b = el("button", "edit-pencil");
      b.type = "button";
      b.title = "Replace this photo";
      b.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      b.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        pickFile(img);
      });
      holder.appendChild(b);
    });

    // hero loop: a small film button on the homepage header
    var heroVid = document.querySelector(".hero__media video, .page-hero__media video");
    if (heroVid) {
      var heroSec = heroVid.closest("section") || heroVid.parentElement;
      heroSec.classList.add("edit-wrap");
      var hb = el("button", "edit-pencil");
      hb.type = "button";
      hb.title = "Replace hero video";
      hb.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 6h11v12H4zM15 10l5-3.5v11L15 14" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
      hb.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        heroVideoFlow(heroVid);
      });
      heroSec.appendChild(hb);
    }

    initTextEditing();
    initStructure();
    initCaseStudyCreation();
    initBlogCreation();
    initLinkEditing();

    // w trybie edycji klik w edytowalny tekst wewnatrz linku edytuje, nie nawiguje
    document.addEventListener("click", function (e) {
      if (!document.body.classList.contains("is-editing")) return;
      var slot = e.target.closest && e.target.closest("[data-edit]");
      if (slot && e.target.closest("a[href]")) e.preventDefault();
      // klik w podpis kafla edytuje tekst, nie otwiera lightboxa
      if (e.target.closest && e.target.closest(".masonry__caption")) e.stopPropagation();
    }, true);
  }


  /* ---------- structure: reorder sections/cards, add/remove gallery photos ---------- */
  // grid child = figure/article/a/button, or a gallery tile swapped to <div> in edit mode
  function isGridChild(n) {
    return /^(FIGURE|ARTICLE|A|BUTTON)$/.test(n.tagName) ||
      (n.classList && n.classList.contains("masonry__item"));
  }

  var STRUCT_API = "/api/structure";
  var layoutDirty = false;
  var pageName = (location.pathname.split("/").pop() || "index.html");
  if (!/\.html$/.test(pageName)) pageName = "index.html";

  function initStructure() {
    var main = document.getElementById("main");
    if (!main) return;

    // sekcje: strzałki gora/dol
    var sections = Array.prototype.filter.call(main.children, function (n) {
      return n.tagName === "SECTION";
    });
    sections.forEach(function (sec, i) {
      sec.dataset.origIndex = String(i);
      sec.style.position = sec.style.position || "relative";
      var tools = el("div", "edit-sec-tools");
      tools.innerHTML =
        "<button class='edit-mini' data-up title='Move section up'>\u2191</button>" +
        "<button class='edit-mini' data-down title='Move section down'>\u2193</button>";
      tools.querySelector("[data-up]").addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation(); moveNode(sec, -1);
      });
      tools.querySelector("[data-down]").addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation(); moveNode(sec, 1);
      });
      sec.appendChild(tools);
    });

    // siatki: strzalki, kosz na figurach, Add photos
    document.querySelectorAll("[data-grid]").forEach(function (grid) {
      var kids = Array.prototype.filter.call(grid.children, function (n) {
        return isGridChild(n);
      });
      kids.forEach(function (kid, i) {
        kid.dataset.origIndex = String(i);
        decorateGridChild(grid, kid);
      });
      // Add photos tylko dla siatek figur
      if (kids.length && (/^(FIGURE|BUTTON)$/.test(kids[0].tagName) || kids[0].classList.contains("masonry__item")) && kids[0].querySelector("img")) {
        var bar = el("div", "edit-addbar");
        var label = grid.getAttribute("data-add-label") || "+ Add photos";
        var btn = el("button", "edit-btn", label);
        btn.type = "button";
        btn.addEventListener("click", function () { addPhotos(grid); });
        bar.appendChild(btn);
        grid.parentElement.insertBefore(bar, grid.nextSibling);
      } else if (grid.getAttribute("data-grid") === "videos-g1") {
        var vbar = el("div", "edit-addbar");
        var vbtn = el("button", "edit-btn", "+ Add video");
        vbtn.type = "button";
        vbtn.addEventListener("click", function () { addVideoFlow(grid); });
        vbar.appendChild(vbtn);
        grid.parentElement.insertBefore(vbar, grid.nextSibling);
      }
    });
  }

  function decorateGridChild(grid, kid) {
    kid.style.position = kid.style.position || "relative";
    var isFig = (/^(FIGURE|BUTTON)$/.test(kid.tagName) || kid.classList.contains("masonry__item")) && kid.querySelector('img[src^="assets/images/"], img[src^="blob:"]');
    // project cards on projects.html can be removed too (card + its page)
    var isCard = kid.tagName === "A" &&
      grid.getAttribute("data-grid") === "projects-g1" && kid.querySelector("img");
    // video cards on videos.html can be removed too (card + file in storage)
    var isVid = kid.tagName === "ARTICLE" &&
      grid.getAttribute("data-grid") === "videos-g1" && kid.querySelector("img");
    // journal cards on blog.html can be removed too (card + its article page)
    var isPost = kid.tagName === "A" &&
      grid.getAttribute("data-grid") === "blog-g1" && kid.querySelector("img");
    var tools = el("div", "edit-item-tools");
    tools.innerHTML =
      "<button class='edit-mini' data-left title='Move earlier'>\u2190</button>" +
      "<button class='edit-mini' data-right title='Move later'>\u2192</button>" +
      (isFig ? "<button class='edit-mini edit-mini--del' data-del title='Remove photo'>\u00D7</button>" : "") +
      (isCard ? "<button class='edit-mini edit-mini--del' data-del title='Remove project'>\u00D7</button>" : "") +
      (isVid ? "<button class='edit-mini edit-mini--del' data-del title='Remove video'>\u00D7</button>" : "") +
      (isPost ? "<button class='edit-mini edit-mini--del' data-del title='Remove journal post'>\u00D7</button>" : "");
    tools.querySelector("[data-left]").addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation(); moveNode(kid, -1);
    });
    tools.querySelector("[data-right]").addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation(); moveNode(kid, 1);
    });
    if (isFig || isCard || isVid || isPost) tools.querySelector("[data-del]").addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation(); removeFigure(grid, kid, isCard, isVid, isPost);
    });
    kid.appendChild(tools);
  }

  /* ---------- links: edit the URL behind a logo ---------- */
  var LINK_API = "/api/structure";

  function initLinkEditing() {
    document.querySelectorAll("a[data-link]").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); });
      var host = a.parentElement;
      host.style.position = host.style.position || "relative";
      var btn = el("button", "edit-mini edit-mini--link", "\u{1F517}");
      btn.type = "button";
      btn.title = "Set link";
      btn.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        openLinkModal(a);
      });
      host.appendChild(btn);
    });
  }

  function openLinkModal(a) {
    var id = a.getAttribute("data-link");
    var current = a.getAttribute("href") || "";
    if (current === "#") current = "";

    var m = modal(
      "<h3>Link for this logo</h3>" +
      "<p style='font:400 13.5px/1.5 Inter;color:#5B6B7C;margin:0 0 12px'>Paste the full website address. Leave it empty if the logo should not be clickable.</p>" +
      "<input type='url' class='lk-url' placeholder='https://example.co.uk' style='width:100%;padding:13px 14px;border:1px solid #C5CED7;border-radius:4px;font:400 15px Inter'>" +
      "<div class='edit-msg lk-state'></div>" +
      "<div class='edit-modal__row'>" +
      "<button class='edit-btn' data-x>Cancel</button>" +
      "<button class='edit-btn edit-btn--primary' data-ok>Save link</button></div>"
    );
    var input = m.box.querySelector(".lk-url");
    input.value = current;

    m.box.querySelector("[data-x]").addEventListener("click", function () { m.root.remove(); });
    m.box.querySelector("[data-ok]").addEventListener("click", function () {
      var btn = m.box.querySelector("[data-ok]");
      var state = m.box.querySelector(".lk-state");
      var url = input.value.trim();
      if (url && !/^https?:\/\//i.test(url)) {
        state.textContent = "The address must start with https://";
        return;
      }
      btn.disabled = true; btn.textContent = "Saving\u2026";
      fetch(LINK_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: sessionStorage.getItem("skylonEditPw"),
          page: pageName,
          action: "setLink",
          link: id,
          href: url || "#",
        }),
      })
        .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
        .then(function (res) {
          if (res.s !== 200 || !res.j.ok) {
            state.textContent = "Error: " + (res.j.error || res.s);
            btn.disabled = false; btn.textContent = "Save link";
            return;
          }
          a.setAttribute("href", url || "#");
          m.root.remove();
          flash("Link saved \u2713 live in ~1 minute");
        })
        .catch(function () {
          state.textContent = "Network error. Try again.";
          btn.disabled = false; btn.textContent = "Save link";
        });
    });
  }

  /* ---------- journal: create a new article ---------- */
  function initBlogCreation() {
    var grid = document.querySelector('[data-grid="blog-g1"]');
    if (!grid) return;
    var bar = el("div", "edit-addbar");
    var btn = el("button", "edit-btn edit-btn--primary", "+ New journal post");
    btn.type = "button";
    btn.addEventListener("click", openBlogModal);
    bar.appendChild(btn);
    grid.parentElement.insertBefore(bar, grid.nextSibling);
  }

  function existingPostTitles() {
    var out = [];
    document.querySelectorAll('[data-grid="blog-g1"] .post-card h3').forEach(function (h) {
      var t = h.textContent.trim();
      if (t) out.push(t);
    });
    return out;
  }

  function openBlogModal() {
    var titles = existingPostTitles();
    var already = titles.length
      ? "<div class='blog-already'><strong>Already published, do not repeat these:</strong><br>" +
        titles.map(function (t) { return "&bull; " + t; }).join("<br>") + "</div>"
      : "";

    var m = modal(
      "<h3>New journal post</h3>" +

      "<div class='blog-rules'>" +
      "<p class='blog-rules__lead'>Read this before you write. It takes one minute and it decides whether the article works.</p>" +

      "<p class='blog-rules__h'>How often</p>" +
      "<p>Once every two weeks. Not weekly. Two strong articles a month beat eight thin ones, and a blog that dies after two months looks worse than no blog at all.</p>" +

      "<p class='blog-rules__h'>How long</p>" +
      "<p>600 to 800 words minimum. Anything shorter, Google treats as thin content and ignores. If you cannot get to 600 words, the subject is too small. Pick a bigger one.</p>" +

      "<p class='blog-rules__h'>What to write about</p>" +
      "<p>Write what people actually type into Google. Three things work:</p>" +
      "<p>1. <strong>Questions clients really ask you.</strong> How long does an extension take? Do I need permission in the Green Belt? Why do builders quote such different prices?</p>" +
      "<p>2. <strong>Local planning knowledge.</strong> What Hertsmere allows in Radlett. What St Albans conservation officers look for. This is the knowledge our competitors do not have, and it is why our local pages exist.</p>" +
      "<p>3. <strong>Real stories from real sites.</strong> What went wrong, what it cost, how it was fixed. People read the truth. They skip the marketing.</p>" +

      "<p class='blog-rules__h'>What not to write</p>" +
      "<p>No company news, no awards, no general trend lists. Nobody searches for those. Never publish AI text without reading and rewriting it yourself. And never write a second article on a subject we have already covered: the two will compete against each other in Google and both will lose.</p>" +

      "<p class='blog-rules__h'>Be specific</p>" +
      "<p>Name the council. Name the rule. Give the real number, the real timescale, the real cost. Vague writing helps nobody and Google ranks it accordingly.</p>" +
      already +
      "</div>" +

      "<label style='font:600 12px Inter;letter-spacing:.06em;display:block;margin:16px 0 6px'>Article title</label>" +
      "<input type='text' class='bp-title' placeholder='e.g. Do I need planning permission for an extension in Radlett?' style='width:100%;padding:13px 14px;border:1px solid #C5CED7;border-radius:4px;font:400 15px Inter;margin-bottom:14px'>" +

      "<label style='font:600 12px Inter;letter-spacing:.06em;display:block;margin-bottom:6px'>One-line summary (shown on the card and in Google)</label>" +
      "<input type='text' class='bp-intro' maxlength='160' placeholder='One sentence. Max 160 characters.' style='width:100%;padding:13px 14px;border:1px solid #C5CED7;border-radius:4px;font:400 15px Inter;margin-bottom:14px'>" +

      "<label style='font:600 12px Inter;letter-spacing:.06em;display:block;margin-bottom:6px'>Category</label>" +
      "<select class='bp-cat' style='width:100%;padding:13px 14px;border:1px solid #C5CED7;border-radius:4px;font:400 15px Inter'>" +
      "<option value='Planning'>Planning</option>" +
      "<option value='Costs'>Costs</option>" +
      "<option value='Craft'>Craft</option>" +
      "<option value='On site'>On site</option>" +
      "<option value='Refurbishment'>Refurbishment</option>" +
      "<option value='Local'>Local</option>" +
      "</select>" +

      "<div class='edit-msg bp-state'></div>" +
      "<div class='edit-modal__row'>" +
      "<button class='edit-btn' data-x>Cancel</button>" +
      "<button class='edit-btn edit-btn--primary' data-ok>Create post</button></div>"
    );

    m.box.querySelector("[data-x]").addEventListener("click", function () { m.root.remove(); });
    m.box.querySelector("[data-ok]").addEventListener("click", function () {
      var btn = m.box.querySelector("[data-ok]");
      var state = m.box.querySelector(".bp-state");
      var title = m.box.querySelector(".bp-title").value.trim();
      var intro = m.box.querySelector(".bp-intro").value.trim();
      var cat = m.box.querySelector(".bp-cat").value;

      if (title.length < 8) { state.textContent = "Give the article a real title first."; return; }
      var clash = existingPostTitles().some(function (t) {
        return t.toLowerCase() === title.toLowerCase();
      });
      if (clash) { state.textContent = "An article with that title already exists."; return; }

      btn.disabled = true; btn.textContent = "Creating post\u2026";
      fetch(STRUCT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: sessionStorage.getItem("skylonEditPw"),
          page: pageName,
          action: "createBlogPost",
          title: title,
          intro: intro,
          category: cat,
        }),
      })
        .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
        .then(function (res) {
          if (res.s !== 200 || !res.j.ok) {
            state.textContent = "Error: " + (res.j.error || res.s);
            btn.disabled = false; btn.textContent = "Create post";
            return;
          }
          state.textContent = "Post created. It will be live in about a minute. Open it and write the article.";
          btn.textContent = "Done \u2713";
          setTimeout(function () { m.root.remove(); flash("Journal post created \u2713"); }, 2600);
        })
        .catch(function () {
          state.textContent = "Network error. Try again.";
          btn.disabled = false; btn.textContent = "Create post";
        });
    });
  }

  /* ---------- case studies: create from card / add new project ---------- */
  function initCaseStudyCreation() {
    document.querySelectorAll("[data-grid]").forEach(function (grid) {
      if (!grid.querySelector("a.project-card, div.project-card")) return;
      var bar = el("div", "edit-addbar");
      var btn = el("button", "edit-btn", "+ Add project");
      btn.type = "button";
      btn.addEventListener("click", function () { openCreateModal(null); });
      bar.appendChild(btn);
      grid.parentElement.insertBefore(bar, grid.nextSibling);
    });

    document.querySelectorAll('div.project-card[data-card]').forEach(function (card) {
      var btn = el("button", "edit-btn", "Create case study");
      btn.type = "button";
      btn.style.cssText = "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:70;background:#0D2238;color:#E9EDF1;border-color:#0D2238;padding:13px 22px;font-size:13px;box-shadow:0 10px 26px rgba(5,14,27,.55)";
      btn.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        openCreateModal(card);
      });
      card.style.position = card.style.position || "relative";
      card.appendChild(btn);
    });
  }

  function openCreateModal(card) {
    var isNew = !card;
    var h3 = card && card.querySelector("h3");
    var name = h3 ? h3.textContent.trim() : "";
    var loc = card && card.querySelector(".project-card__cat");
    var location = loc ? loc.textContent.trim() : "";
    var m = modal(
      "<h3>" + (isNew ? "Add new project" : "Create case study") + "</h3>" +
      "<label style='font:600 12px Inter;letter-spacing:.06em;display:block;margin-bottom:6px'>Project name</label>" +
      "<input type='text' class='cs-name' style='width:100%;padding:13px 14px;border:1px solid #C5CED7;border-radius:4px;font:400 15px Inter;margin-bottom:14px'>" +
      (isNew ? "<label style='font:600 12px Inter;letter-spacing:.06em;display:block;margin-bottom:6px'>Location (e.g. Camden NW1)</label>" +
      "<input type='text' class='cs-loc' style='width:100%;padding:13px 14px;border:1px solid #C5CED7;border-radius:4px;font:400 15px Inter;margin-bottom:14px'>" : "") +
      "<label style='font:600 12px Inter;letter-spacing:.06em;display:block;margin-bottom:6px'>Category</label>" +
      "<select class='cs-cat' style='width:100%;padding:13px 14px;border:1px solid #C5CED7;border-radius:4px;font:400 15px Inter'>" +
      "<option value='residential'>Residential</option>" +
      "<option value='commercial' selected>Commercial</option>" +
      "<option value='refurbishment'>Refurbishment</option></select>" +
      "<div class='edit-msg cs-state'></div>" +
      "<div class='edit-modal__row'>" +
      "<button class='edit-btn' data-x>Cancel</button>" +
      "<button class='edit-btn edit-btn--primary' data-ok>Create page</button></div>"
    );
    var nameInput = m.box.querySelector(".cs-name");
    nameInput.value = name;
    m.box.querySelector("[data-x]").addEventListener("click", function () { m.root.remove(); });
    m.box.querySelector("[data-ok]").addEventListener("click", function () {
      var btn = m.box.querySelector("[data-ok]");
      var state = m.box.querySelector(".cs-state");
      btn.disabled = true; btn.textContent = "Creating page…";
      fetch(STRUCT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: sessionStorage.getItem("skylonEditPw"),
          page: pageName,
          action: isNew ? "addProject" : "createCaseStudy",
          card: card ? card.getAttribute("data-card") : undefined,
          name: nameInput.value,
          category: m.box.querySelector(".cs-cat").value,
          location: isNew ? (m.box.querySelector(".cs-loc").value || "London") : location,
        }),
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.ok) {
            btn.disabled = false; btn.textContent = "Create page";
            state.textContent = "Error: " + (j.error || "unknown");
            return;
          }
          state.textContent = "Created. Opening the new page…";
          setTimeout(function () { window.location.href = j.slug; }, 900);
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = "Create page";
          state.textContent = "Network error. Try again.";
        });
    });
  }

  function moveNode(node, dir) {
    var parent = node.parentElement;
    var sib = dir < 0 ? node.previousElementSibling : node.nextElementSibling;
    while (sib && !sib.dataset.origIndex) sib = dir < 0 ? sib.previousElementSibling : sib.nextElementSibling;
    if (!sib) return;
    if (dir < 0) parent.insertBefore(node, sib);
    else parent.insertBefore(sib, node);
    layoutDirty = true;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    renderSaveBar();
  }

  function currentOrders() {
    var main = document.getElementById("main");
    var sections = Array.prototype.filter.call(main.children, function (n) {
      return n.tagName === "SECTION" && n.dataset.origIndex != null;
    }).map(function (n) { return parseInt(n.dataset.origIndex, 10); });
    var grids = {};
    document.querySelectorAll("[data-grid]").forEach(function (grid) {
      var order = Array.prototype.filter.call(grid.children, function (n) {
        return n.dataset && n.dataset.origIndex != null;
      }).map(function (n) { return parseInt(n.dataset.origIndex, 10); });
      var changed = order.some(function (v, i) { return v !== i; });
      if (changed) grids[grid.getAttribute("data-grid")] = order;
    });
    var secChanged = sections.some(function (v, i) { return v !== i; });
    return { sections: secChanged ? sections : null, grids: grids };
  }

  function saveLayout() {
    var o = currentOrders();
    var payload = { password: sessionStorage.getItem("skylonEditPw"), page: pageName, action: "reorder" };
    if (o.sections) payload.sections = o.sections;
    if (Object.keys(o.grids).length) payload.grids = o.grids;
    if (!payload.sections && !payload.grids) { layoutDirty = false; renderSaveBar(); return; }
    var btn = savebar.querySelector("[data-savelayout]");
    btn.disabled = true; btn.textContent = "Saving\u2026";
    fetch(STRUCT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        btn.disabled = false; btn.textContent = "Save layout";
        if (!j.ok) { alert("Error: " + (j.error || "unknown")); return; }
        layoutDirty = false;
        flash("Layout saved \u2713 live in ~1 minute");
        // po zapisie kolejnosc w pliku = kolejnosc DOM; zresetuj indeksy
        reindex();
        renderSaveBar();
      })
      .catch(function () { btn.disabled = false; btn.textContent = "Save layout"; alert("Network error."); });
  }

  function reindex() {
    var main = document.getElementById("main");
    Array.prototype.filter.call(main.children, function (n) { return n.tagName === "SECTION"; })
      .forEach(function (n, i) { n.dataset.origIndex = String(i); });
    document.querySelectorAll("[data-grid]").forEach(function (grid) {
      Array.prototype.filter.call(grid.children, isGridChild)
        .forEach(function (n, i) { n.dataset.origIndex = String(i); });
    });
  }

  function flash(msg) {
    var ok = el("div", "edit-badge", msg);
    ok.style.left = "50%"; ok.style.transform = "translateX(-50%)"; ok.style.bottom = "84px";
    document.body.appendChild(ok);
    setTimeout(function () { ok.remove(); }, 5000);
  }

  function removeFigure(grid, fig, isCard, isVid, isPost) {
    if (layoutDirty) { alert("Save layout first, then remove photos."); return; }
    var q = isCard
      ? "Remove this project card AND its project page? This cannot be undone."
      : isVid
        ? "Remove this video? The file will also be deleted from storage."
        : isPost
          ? "Remove this journal post AND its article page? This cannot be undone."
          : "Remove this photo from the page?";
    if (!confirm(q)) return;
    var kids = Array.prototype.filter.call(grid.children, isGridChild);
    var index = kids.indexOf(fig);
    fetch(STRUCT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: sessionStorage.getItem("skylonEditPw"),
        page: pageName, action: "removeItem",
        grid: grid.getAttribute("data-grid"), index: index,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) { alert("Error: " + (j.error || "unknown")); return; }
        fig.remove();
        reindex();
        flash(isCard ? "Project removed \u2713 live in ~1 minute"
          : isVid ? "Video removed \u2713 live in ~1 minute"
          : isPost ? "Journal post removed \u2713 live in ~1 minute"
          : "Photo removed \u2713 live in ~1 minute");
      })
      .catch(function () { alert("Network error."); });
  }

  var VIDEO_API = "/api/upload-video";
  var BLOB_CLIENT_URL = "https://esm.sh/@vercel/blob@2.6.1/client";
  var VIDEO_CATS = ["Residential", "Commercial", "Refurbishment", "Workshop", "Finishes", "The team"];
  var MAX_VIDEO_MB = 500;
  var MAX_HERO_MB = 30;

  var GALLERY_PICK = [
    ["residential", "Residential"],
    ["commercial", "Commercial"],
    ["refurbishment", "Refurbishment"],
    ["joinery", "Joinery & Finishes"],
    ["progress", "In Progress"],
  ];
  var GALLERY_LABELS = {
    residential: "Residential", commercial: "Commercial",
    refurbishment: "Refurbishment", joinery: "Bespoke joinery", progress: "In progress",
  };

  function addPhotos(grid) {
    if (layoutDirty) { alert("Save layout first, then add photos."); return; }
    // gallery tiles carry data-cat, so ask for the category first
    if (!grid.querySelector("[data-cat]")) { pickFiles(grid, ""); return; }
    var active = document.querySelector('[data-filter-bar] .filter-btn[aria-pressed="true"]');
    var pre = active ? active.getAttribute("data-filter") : "all";
    var btns = GALLERY_PICK.map(function (c) {
      var primary = c[0] === pre ? " edit-btn--primary" : "";
      return "<button class='edit-btn" + primary + "' data-cat-pick='" + c[0] + "'>" + c[1] + "</button>";
    }).join("");
    var m = modal(
      "<h3>Which category?</h3>" +
      "<div class='edit-catgrid'>" + btns + "</div>" +
      "<div class='edit-modal__row'><button class='edit-btn' data-x>Cancel</button></div>"
    );
    m.box.querySelectorAll("[data-cat-pick]").forEach(function (b) {
      b.addEventListener("click", function () {
        var cat = b.getAttribute("data-cat-pick");
        m.root.remove();
        pickFiles(grid, cat);
      });
    });
    m.box.querySelector("[data-x]").addEventListener("click", function () { m.root.remove(); });
  }

  /* ---------- videos: upload to Vercel Blob straight from the browser ---------- */
  function addVideoFlow(grid) {
    if (layoutDirty) { alert("Save layout first, then add videos."); return; }
    var cats = VIDEO_CATS.map(function (c) {
      return "<button class='edit-btn' data-vcat=\"" + c + "\">" + c + "</button>";
    }).join("");
    var m = modal(
      "<h3>Add a video</h3>" +
      "<input type='file' accept='video/mp4,video/webm,video/quicktime' class='vfile' style='width:100%;font:400 14px Inter'>" +
      "<input type='text' class='vtitle' placeholder='Video title' maxlength='90' style='width:100%;margin-top:12px;padding:12px;border:1px solid #C5CED7;border-radius:4px;font:400 15px Inter'>" +
      "<div class='edit-msg' style='margin-top:12px'>Category:</div>" +
      "<div class='edit-catgrid vcats'>" + cats + "</div>" +
      "<div class='edit-progress' style='display:none;height:8px;border-radius:4px;background:#E3E8EE;margin-top:14px;overflow:hidden'><div class='edit-progress__bar' style='height:100%;width:0%;background:#0D2238'></div></div>" +
      "<div class='edit-msg vstate'></div>" +
      "<div class='edit-modal__row'>" +
      "<button class='edit-btn' data-x>Cancel</button>" +
      "<button class='edit-btn edit-btn--primary' data-ok>Upload</button></div>"
    );
    var chosenCat = "";
    m.box.querySelectorAll("[data-vcat]").forEach(function (b) {
      b.addEventListener("click", function () {
        chosenCat = b.getAttribute("data-vcat");
        m.box.querySelectorAll("[data-vcat]").forEach(function (x) { x.classList.remove("edit-btn--primary"); });
        b.classList.add("edit-btn--primary");
      });
    });
    m.box.querySelector("[data-x]").addEventListener("click", function () { m.root.remove(); });
    m.box.querySelector("[data-ok]").addEventListener("click", function () {
      var file = (m.box.querySelector(".vfile").files || [])[0];
      var title = m.box.querySelector(".vtitle").value.trim();
      var state = m.box.querySelector(".vstate");
      if (!file) { state.textContent = "Pick a video file first."; return; }
      if (!title) { state.textContent = "Give the video a title."; return; }
      if (!chosenCat) { state.textContent = "Pick a category."; return; }
      if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
        state.textContent = "This file is over " + MAX_VIDEO_MB + " MB. Please compress the video first.";
        return;
      }
      uploadVideo(grid, file, title, chosenCat, m);
    });
  }

  // A poster frame is taken from the middle of the film, so the girls never
  // have to prepare a thumbnail by hand.
  function grabPoster(file) {
    return new Promise(function (resolve) {
      var v = document.createElement("video");
      var url = URL.createObjectURL(file);
      var done = false;
      function finish(blob) {
        if (done) return;
        done = true;
        URL.revokeObjectURL(url);
        resolve(blob);
      }
      var timer = setTimeout(function () { finish(null); }, 8000);
      v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
      v.addEventListener("loadeddata", function () {
        var t = Math.min(2, (v.duration || 4) / 2);
        try { v.currentTime = t; } catch (_e) { clearTimeout(timer); finish(null); }
      });
      v.addEventListener("seeked", function () {
        try {
          var w = Math.min(1200, v.videoWidth || 1200);
          var h = Math.round(w * (v.videoHeight || 675) / (v.videoWidth || 1200));
          var c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(v, 0, 0, w, h);
          c.toBlob(function (b) { clearTimeout(timer); finish(b); }, "image/webp", 0.82);
        } catch (_e) { clearTimeout(timer); finish(null); }
      });
      v.addEventListener("error", function () { clearTimeout(timer); finish(null); });
    });
  }

  function uploadPoster(posterBlob, posterPath, pw) {
    if (!posterBlob) return Promise.resolve("assets/images/placeholder-photo.webp");
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onerror = function () { resolve("assets/images/placeholder-photo.webp"); };
      r.onload = function () {
        fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pw, path: posterPath, dataBase64: String(r.result).split(",")[1] }),
        })
          .then(function (res) { return res.json().then(function (j) { return { s: res.status, j: j }; }); })
          .then(function (up) {
            if (up.s === 401) reject({ auth: true });
            else if (!up.j.ok) reject({ msg: up.j.error });
            else resolve(posterPath);
          })
          .catch(function () { reject({ msg: "network, try again" }); });
      };
      r.readAsDataURL(posterBlob);
    });
  }

  function blobUpload(path, file, pw, bar) {
    return import(BLOB_CLIENT_URL).then(function (mod) {
      return mod.upload(path, file, {
        access: "public",
        handleUploadUrl: VIDEO_API,
        clientPayload: JSON.stringify({ password: pw }),
        multipart: true,
        onUploadProgress: function (p) {
          if (bar && p && typeof p.percentage === "number") bar.style.width = p.percentage + "%";
        },
      });
    });
  }

  function uploadVideo(grid, file, title, cat, m) {
    var state = m.box.querySelector(".vstate");
    var okBtn = m.box.querySelector("[data-ok]");
    var bar = m.box.querySelector(".edit-progress__bar");
    m.box.querySelector(".edit-progress").style.display = "block";
    okBtn.disabled = true;
    state.textContent = "Preparing thumbnail\u2026";
    var pw = sessionStorage.getItem("skylonEditPw");
    var stamp = Date.now();
    var posterPath = "assets/images/uploads/videos-g1-" + stamp + ".webp";
    var slugTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "video";
    var ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    if (!/^(mp4|webm|mov)$/.test(ext)) ext = "mp4";
    var videoPath = "videos/" + slugTitle + "-" + stamp + "." + ext;

    grabPoster(file)
      .then(function (posterBlob) { return uploadPoster(posterBlob, posterPath, pw); })
      .then(function (poster) {
        state.textContent = "Uploading video\u2026 big files can take a few minutes, keep this tab open.";
        return blobUpload(videoPath, file, pw, bar).then(function (blob) {
          return { blob: blob, poster: poster };
        });
      })
      .then(function (r) {
        state.textContent = "Publishing\u2026";
        return fetch(STRUCT_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password: pw, page: pageName, action: "addVideo",
            videoUrl: r.blob.url, posterSrc: r.poster, title: title, cat: cat,
          }),
        }).then(function (res) {
          return res.json().then(function (j) { return { s: res.status, j: j, up: r }; });
        });
      })
      .then(function (res) {
        if (res.s === 401) throw { auth: true };
        if (!res.j.ok) throw { msg: res.j.error };
        insertVideoCard(grid, res.up.blob.url, res.up.poster, title, cat);
        m.root.remove();
        flash("Video added \u2713 live in ~1 minute");
      })
      .catch(function (err) {
        okBtn.disabled = false;
        if (err && err.auth) {
          sessionStorage.removeItem("skylonEditPw");
          state.textContent = "Wrong password. Click the logo 5\u00D7 and try again.";
        } else {
          state.textContent = "Error: " + ((err && (err.msg || err.message)) || "upload failed, try again");
        }
      });
  }

  function insertVideoCard(grid, videoUrl, poster, title, cat) {
    var tpl = grid.querySelector("article.video-card") || grid.children[0];
    if (!tpl) return;
    var clone = tpl.cloneNode(true);
    clone.querySelectorAll(".edit-item-tools,.edit-pencil").forEach(function (n) { n.remove(); });
    clone.querySelectorAll("[data-edit]").forEach(function (n) { n.removeAttribute("data-edit"); n.removeAttribute("contenteditable"); });
    clone.querySelectorAll("[data-img]").forEach(function (n) { n.removeAttribute("data-img"); });
    var soon = clone.querySelector(".video-card__soon");
    if (soon) soon.remove();
    clone.setAttribute("data-video", videoUrl);
    var im = clone.querySelector("img");
    if (im) { im.src = poster; im.alt = title; }
    var c = clone.querySelector(".video-card__cat");
    if (c) c.textContent = cat;
    var h = clone.querySelector("h3");
    if (h) h.textContent = title;
    clone.classList.add("is-visible");
    grid.appendChild(clone);
    decorateGridChild(grid, clone);
    reindex();
  }

  /* ---------- hero loop replacement on the homepage ---------- */
  function heroVideoFlow(videoEl) {
    var m = modal(
      "<h3>Replace the hero loop</h3>" +
      "<p style='font:400 13.5px/1.5 Inter;color:#5B6B7C;margin:0 0 12px'>Short mp4 loop, up to " + MAX_HERO_MB + " MB. It plays automatically for every visitor, so keep it small and quiet.</p>" +
      "<input type='file' accept='video/mp4' class='vfile' style='width:100%;font:400 14px Inter'>" +
      "<div class='edit-progress' style='display:none;height:8px;border-radius:4px;background:#E3E8EE;margin-top:14px;overflow:hidden'><div class='edit-progress__bar' style='height:100%;width:0%;background:#0D2238'></div></div>" +
      "<div class='edit-msg vstate'></div>" +
      "<div class='edit-modal__row'>" +
      "<button class='edit-btn' data-x>Cancel</button>" +
      "<button class='edit-btn edit-btn--primary' data-ok>Upload</button></div>"
    );
    m.box.querySelector("[data-x]").addEventListener("click", function () { m.root.remove(); });
    m.box.querySelector("[data-ok]").addEventListener("click", function () {
      var file = (m.box.querySelector(".vfile").files || [])[0];
      var state = m.box.querySelector(".vstate");
      var okBtn = m.box.querySelector("[data-ok]");
      var bar = m.box.querySelector(".edit-progress__bar");
      if (!file) { state.textContent = "Pick an mp4 file first."; return; }
      if (!/\.mp4$/i.test(file.name)) { state.textContent = "The hero loop must be an mp4 file."; return; }
      if (file.size > MAX_HERO_MB * 1024 * 1024) {
        state.textContent = "The hero loop must be under " + MAX_HERO_MB + " MB. Trim it or compress it first.";
        return;
      }
      okBtn.disabled = true;
      m.box.querySelector(".edit-progress").style.display = "block";
      state.textContent = "Uploading\u2026";
      var pw = sessionStorage.getItem("skylonEditPw");
      blobUpload("videos/hero-loop-" + Date.now() + ".mp4", file, pw, bar)
        .then(function (blob) {
          state.textContent = "Publishing\u2026";
          return fetch(STRUCT_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: pw, page: pageName, action: "setHeroVideo", src: blob.url }),
          }).then(function (res) {
            return res.json().then(function (j) { return { s: res.status, j: j, url: blob.url }; });
          });
        })
        .then(function (res) {
          if (res.s === 401) throw { auth: true };
          if (!res.j.ok) throw { msg: res.j.error };
          var srcEl = videoEl.querySelector("source");
          if (srcEl) { srcEl.src = res.url; videoEl.load(); }
          var p = videoEl.play();
          if (p && p.catch) p.catch(function () {});
          m.root.remove();
          flash("Hero video replaced \u2713 live in ~1 minute");
        })
        .catch(function (err) {
          okBtn.disabled = false;
          if (err && err.auth) {
            sessionStorage.removeItem("skylonEditPw");
            state.textContent = "Wrong password. Click the logo 5\u00D7 and try again.";
          } else {
            state.textContent = "Error: " + ((err && (err.msg || err.message)) || "upload failed, try again");
          }
        });
    });
  }

  function pickFiles(grid, cat) {
    var input = el("input");
    input.type = "file"; input.accept = "image/*"; input.multiple = true;
    input.addEventListener("change", function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (files.length) addSequential(grid, files, 0, cat);
    });
    input.click();
  }

  function addSequential(grid, files, i, cat) {
    if (i >= files.length) { flash("Added " + files.length + " photo" + (files.length > 1 ? "s" : "") + " \u2713 live in ~1 minute"); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var image = new Image();
      image.onload = function () {
        var scale = Math.min(1, MAX_W / image.width);
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          var gid = grid.getAttribute("data-grid");
          var src = "assets/images/uploads/" + gid + "-" + Date.now() + ".webp";
          var r2 = new FileReader();
          r2.onload = function () {
            var base64 = String(r2.result).split(",")[1];
            fetch(API, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password: sessionStorage.getItem("skylonEditPw"), path: src, dataBase64: base64 }),
            })
              .then(function (r) { return r.json(); })
              .then(function (j) {
                if (!j.ok) { alert("Upload error: " + (j.error || "")); return; }
                return fetch(STRUCT_API, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    password: sessionStorage.getItem("skylonEditPw"),
                    page: pageName, action: "addFigure",
                    grid: grid.getAttribute("data-grid"), src: src, alt: "",
                    cat: cat || undefined,
                  }),
                }).then(function (r) { return r.json(); }).then(function (j2) {
                  if (!j2.ok) { alert("Error: " + (j2.error || "")); return; }
                  // natychmiastowy podglad: klon pierwszej figury
                  var tpl = grid.querySelector("figure, button.masonry__item, div.masonry__item") || grid.children[0];
                  var clone = tpl.cloneNode(true);
                  clone.querySelectorAll(".edit-item-tools,.edit-pencil").forEach(function (n) { n.remove(); });
                  clone.querySelectorAll("[data-edit]").forEach(function (n) { n.removeAttribute("data-edit"); n.removeAttribute("contenteditable"); });
                  clone.querySelectorAll("[data-img]").forEach(function (n) { n.removeAttribute("data-img"); });
                  var im = clone.querySelector("img");
                  im.src = URL.createObjectURL(blob); im.removeAttribute("srcset");
                  // reveal animation never runs for injected nodes, force visibility
                  clone.classList.add("is-visible");
                  if (cat) {
                    clone.setAttribute("data-cat", cat);
                    var capCat = clone.querySelector(".masonry__caption > span");
                    var capTitle = clone.querySelector(".masonry__caption strong");
                    if (capCat) capCat.textContent = GALLERY_LABELS[cat];
                    if (capTitle) capTitle.textContent = "Untitled";
                    var activeBtn = document.querySelector('[data-filter-bar] .filter-btn[aria-pressed="true"]');
                    if (activeBtn) {
                      var v = activeBtn.getAttribute("data-filter");
                      clone.hidden = !(v === "all" || v === cat);
                    }
                  }
                  grid.appendChild(clone);
                  decorateGridChild(grid, clone);
                  reindex();
                  addSequential(grid, files, i + 1, cat);
                });
              })
              .catch(function () { alert("Network error."); });
          };
          r2.readAsDataURL(blob);
        }, "image/webp", QUALITY);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(files[i]);
  }

  /* ---------- text editing ---------- */
  var TEXT_API = "/api/update-text";
  var dirty = {};

  function initTextEditing() {
    var slots = document.querySelectorAll("[data-edit]");
    slots.forEach(function (el) {
      el.setAttribute("contenteditable", "true");
      el.setAttribute("spellcheck", "false");
      el.dataset.editOriginal = el.innerHTML;
      el.addEventListener("input", function () {
        var id = el.getAttribute("data-edit");
        if (el.innerHTML !== el.dataset.editOriginal) {
          dirty[id] = el;
          el.classList.add("edit-dirty");
        } else {
          delete dirty[id];
          el.classList.remove("edit-dirty");
        }
        renderSaveBar();
      });
      // Enter = nowa linia zamiast dziwnych divów
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          document.execCommand("insertLineBreak");
        }
      });
    });
    renderSaveBar();
  }

  var savebar = null;
  function renderSaveBar() {
    var n = Object.keys(dirty).length;
    if (!savebar) {
      savebar = el("div", "edit-savebar");
      savebar.style.display = "none";
      savebar.innerHTML =
        "<span class='edit-count'></span>" +
        "<button class='edit-btn' data-undo>Undo texts</button>" +
        "<button class='edit-btn edit-btn--primary' data-save>Save texts</button>" +
        "<button class='edit-btn edit-btn--primary' data-savelayout>Save layout</button>";
      document.body.appendChild(savebar);
      savebar.querySelector("[data-save]").addEventListener("click", saveTexts);
      savebar.querySelector("[data-savelayout]").addEventListener("click", saveLayout);
      savebar.querySelector("[data-undo]").addEventListener("click", function () {
        Object.keys(dirty).forEach(function (id) {
          var elx = dirty[id];
          elx.innerHTML = elx.dataset.editOriginal;
          elx.classList.remove("edit-dirty");
        });
        dirty = {};
        renderSaveBar();
      });
    }
    var show = n > 0 || layoutDirty;
    savebar.style.display = show ? "flex" : "none";
    savebar.querySelector("[data-save]").style.display = n ? "" : "none";
    savebar.querySelector("[data-undo]").style.display = n ? "" : "none";
    savebar.querySelector("[data-savelayout]").style.display = layoutDirty ? "" : "none";
    var label = [];
    if (n) label.push(n + " text change" + (n > 1 ? "s" : ""));
    if (layoutDirty) label.push("layout moved");
    savebar.querySelector(".edit-count").textContent = label.join(" \u00B7 ");
  }

  function saveTexts() {
    var ids = Object.keys(dirty);
    if (!ids.length) return;
    var page = (location.pathname.split("/").pop() || "index.html");
    if (!/\.html$/.test(page)) page = "index.html";
    var edits = ids.map(function (id) {
      return { id: id, html: dirty[id].innerHTML };
    });
    var btn = savebar.querySelector("[data-save]");
    btn.disabled = true; btn.textContent = "Saving\u2026";
    fetch(TEXT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password: sessionStorage.getItem("skylonEditPw"),
        page: page,
        edits: edits,
      }),
    })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (res) {
        btn.disabled = false; btn.textContent = "Save texts";
        if (res.s === 401) {
          sessionStorage.removeItem("skylonEditPw");
          alert("Wrong password. Click the logo 5\u00D7 and log in again.");
          return;
        }
        if (!res.j.ok) { alert("Error: " + (res.j.error || "unknown")); return; }
        ids.forEach(function (id) {
          dirty[id].dataset.editOriginal = dirty[id].innerHTML;
          dirty[id].classList.remove("edit-dirty");
        });
        dirty = {};
        renderSaveBar();
        var ok = el("div", "edit-badge", "Saved \u2713 live in ~1 minute");
        ok.style.left = "auto"; ok.style.right = "14px"; ok.style.bottom = "64px";
        document.body.appendChild(ok);
        setTimeout(function () { ok.remove(); }, 5000);
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = "Save texts";
        alert("Network error. Try again.");
      });
  }

  function pickFile(img) {
    var input = el("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      if (f) compressAndPreview(f, img);
    });
    input.click();
  }

  function compressAndPreview(file, img) {
    var reader = new FileReader();
    reader.onload = function () {
      var image = new Image();
      image.onload = function () {
        var scale = Math.min(1, MAX_W / image.width);
        var w = Math.round(image.width * scale);
        var h = Math.round(image.height * scale);
        var canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(image, 0, 0, w, h);
        canvas.toBlob(function (blob) {
          if (!blob) { alert("Could not process this image."); return; }
          preview(blob, w, h, img);
        }, "image/webp", QUALITY);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function preview(blob, w, h, img) {
    var url = URL.createObjectURL(blob);
    var kb = Math.round(blob.size / 1024);
    var path = img.getAttribute("src");
    var m = modal(
      "<h3>Replace photo</h3>" +
      "<img src='" + url + "' alt=''>" +
      "<div class='edit-msg'>" + w + "&times;" + h + " &middot; " + kb + " KB &middot; " + path + "</div>" +
      "<div class='edit-msg edit-state'></div>" +
      "<div class='edit-modal__row'>" +
      "<button class='edit-btn' data-x>Cancel</button>" +
      "<button class='edit-btn edit-btn--primary' data-ok>Save to site</button></div>"
    );
    m.box.querySelector("[data-x]").addEventListener("click", function () { m.root.remove(); });
    m.box.querySelector("[data-ok]").addEventListener("click", function () {
      upload(blob, path, img, m);
    });
  }

  function upload(blob, path, img, m) {
    var state = m.box.querySelector(".edit-state");
    var okBtn = m.box.querySelector("[data-ok]");
    okBtn.disabled = true;
    state.textContent = "Uploading…";
    var imgId = img.getAttribute("data-img");
    var newPath = imgId
      ? "assets/images/uploads/" + imgId + "-" + Date.now() + ".webp"
      : path; // fallback dla slotu bez ID
    var reader = new FileReader();
    reader.onload = function () {
      var base64 = String(reader.result).split(",")[1];
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: sessionStorage.getItem("skylonEditPw"),
          path: newPath,
          dataBase64: base64,
        }),
      })
        .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
        .then(function (up) {
          if (up.s === 401) throw { auth: true };
          if (!up.j.ok) throw { msg: up.j.error };
          if (!imgId) return { s: 200, j: { ok: true } };
          return fetch(STRUCT_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              password: sessionStorage.getItem("skylonEditPw"),
              page: pageName, action: "setImageSrc",
              imgId: imgId, src: newPath,
            }),
          }).then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); });
        })
        .then(function (res) {
          if (res.s === 401) throw { auth: true };
          if (!res.j.ok) throw { msg: res.j.error };
          img.src = URL.createObjectURL(blob); // natychmiastowy podglad
          state.textContent = "Saved. The live site will update in about a minute.";
          okBtn.style.display = "none";
          m.box.querySelector("[data-x]").textContent = "Close";
        })
        .catch(function (err) {
          if (err && err.auth) {
            sessionStorage.removeItem("skylonEditPw");
            state.textContent = "Wrong password. Click the logo 5\u00D7 and try again.";
          } else {
            state.textContent = "Error: " + ((err && err.msg) || "network, try again");
          }
          okBtn.disabled = false;
        });
    };
    reader.readAsDataURL(blob);
  }
})();

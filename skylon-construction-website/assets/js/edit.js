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
    ".edit-savebar{position:fixed;bottom:14px;right:14px;z-index:9999;display:flex;gap:10px;align-items:center;background:#0D2238;border:1px solid rgba(197,206,215,.35);border-radius:8px;padding:10px 12px}" +
    ".edit-savebar span{color:#DCE2E8;font:600 11px Inter;letter-spacing:.1em;text-transform:uppercase}";

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

    var imgs = document.querySelectorAll('img[src^="assets/images/"]');
    imgs.forEach(function (img) {
      if (img.closest(".site-header") || img.closest(".footer")) return; // logos stay safe
      var holder = img.parentElement;
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

    initTextEditing();
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
        "<button class='edit-btn' data-undo>Undo all</button>" +
        "<button class='edit-btn edit-btn--primary' data-save>Save texts</button>";
      document.body.appendChild(savebar);
      savebar.querySelector("[data-save]").addEventListener("click", saveTexts);
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
    savebar.style.display = n ? "flex" : "none";
    if (n) savebar.querySelector(".edit-count").textContent = n + " change" + (n > 1 ? "s" : "");
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
    var reader = new FileReader();
    reader.onload = function () {
      var base64 = String(reader.result).split(",")[1];
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: sessionStorage.getItem("skylonEditPw"),
          path: path,
          dataBase64: base64,
        }),
      })
        .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
        .then(function (res) {
          if (res.s === 401) {
            sessionStorage.removeItem("skylonEditPw");
            state.textContent = "Wrong password. Click the logo 5\u00D7 and try again.";
            okBtn.disabled = false;
            return;
          }
          if (!res.j.ok) {
            state.textContent = "Error: " + (res.j.error || "unknown");
            okBtn.disabled = false;
            return;
          }
          img.src = URL.createObjectURL(blob); // instant local preview
          state.textContent = "Saved. The live site will update in about a minute.";
          okBtn.style.display = "none";
          m.box.querySelector("[data-x]").textContent = "Close";
        })
        .catch(function () {
          state.textContent = "Network error. Try again.";
          okBtn.disabled = false;
        });
    };
    reader.readAsDataURL(blob);
  }
})();

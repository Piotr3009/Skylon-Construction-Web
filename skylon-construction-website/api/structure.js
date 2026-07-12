// Skylon site editor — structure endpoint: reorder sections/cards, add/remove gallery figures.
const crypto = require("crypto");

const REPO = "Piotr3009/Skylon-Construction-Web";
const BRANCH = "main";
const SITE_DIR = "skylon-construction-website";
const PAGE_RE = /^[a-z0-9\-]+\.html$/;
const GRID_RE = /^[a-z0-9\-]+-g\d+$/;
const IMG_RE = /^[a-z0-9\-]+-i\d+$/;
const CARD_RE = /^projects-c\d+$/;
const CATS = ["residential", "commercial", "refurbishment"];
const SRC_RE = /^assets\/images\/[a-z0-9][a-z0-9\-\/_.]*\.(webp|jpg|jpeg|png)$/i;

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/* ---------- block scanners (regex-free depth walk for reliability) ---------- */
// find the block <tag ...>...</tag> starting at `start` (index of "<tag")
function blockAt(html, start, tag) {
  const openRe = new RegExp(`<${tag}\\b`, "gi");
  const closeStr = `</${tag}>`;
  let depth = 0;
  let i = start;
  while (i < html.length) {
    const nextOpen = html.indexOf(`<${tag}`, i);
    const nextClose = html.indexOf(closeStr, i);
    if (nextClose === -1) return null;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      // ensure word boundary (e.g. <section vs <sect...)
      const ch = html[nextOpen + tag.length + 1];
      if (/[\s>]/.test(ch)) depth += 1;
      i = nextOpen + tag.length + 1;
    } else {
      depth -= 1;
      i = nextClose + closeStr.length;
      if (depth === 0) return { start, end: i };
    }
  }
  return null;
}

// top-level blocks of `tag` inside html fragment
function topBlocks(fragment, tag) {
  const blocks = [];
  let i = 0;
  const probe = new RegExp(`<${tag}[\\s>]`, "gi");
  while (true) {
    probe.lastIndex = i;
    const m = probe.exec(fragment);
    if (!m) break;
    const b = blockAt(fragment, m.index, tag);
    if (!b) break;
    blocks.push(b);
    i = b.end;
  }
  return blocks;
}

function gridRegion(html, gridId) {
  const openIdx = html.search(new RegExp(`<div[^>]*data-grid="${gridId}"`));
  if (openIdx === -1) return null;
  return blockAt(html, openIdx, "div");
}

function childTagOf(inner) {
  const m = inner.match(/<(figure|article|button|a)[\s>]/i);
  return m ? m[1].toLowerCase() : null;
}

function permute(fragment, blocks, order) {
  if (!Array.isArray(order) || order.length !== blocks.length) return null;
  const seen = new Set(order);
  if (seen.size !== blocks.length || order.some((n) => n < 0 || n >= blocks.length)) return null;
  const parts = [];
  let cursor = 0;
  // gaps between blocks preserved: rebuild as prefix + b0 + sep0 + b1 ... + suffix
  const prefix = fragment.slice(0, blocks[0].start);
  const suffix = fragment.slice(blocks[blocks.length - 1].end);
  const seps = [];
  for (let k = 0; k < blocks.length - 1; k++)
    seps.push(fragment.slice(blocks[k].end, blocks[k + 1].start));
  const pieces = order.map((idx) => fragment.slice(blocks[idx].start, blocks[idx].end));
  let out = prefix;
  pieces.forEach((p, k) => {
    out += p;
    if (k < seps.length) out += seps[k];
  });
  out += suffix;
  return out;
}

function renumberAttr(cloneHtml, fullHtml, slug, attr, pat, fmt) {
  let max = 0;
  const re = new RegExp(`${attr}="${slug}-${pat}"`, "g");
  let m;
  while ((m = re.exec(fullHtml))) max = Math.max(max, parseInt(m[1], 10));
  return cloneHtml.replace(new RegExp(`${attr}="${slug}-${pat.replace(/\((.*)\)/, "$1")}"`, "g"), function () {
    max += 1;
    return `${attr}="${slug}-${fmt(max)}"`;
  });
}
function renumberDataCard(cloneHtml, fullHtml) {
  let max = 0;
  const re = /data-card="projects-c(\d+)"/g;
  let m;
  while ((m = re.exec(fullHtml))) max = Math.max(max, parseInt(m[1], 10));
  return cloneHtml.replace(/data-card="projects-c\d+"/, () => `data-card="projects-c${max + 1}"`);
}
function slugify(name) {
  return "project-" + String(name).toLowerCase()
    .replace(/&[a-z]+;/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) + ".html";
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function renumberDataEdit(cloneHtml, fullHtml, slug) {
  cloneHtml = renumberAttr(cloneHtml, fullHtml, slug, "data-edit", "(\\d{3})",
    function (n) { return String(n).padStart(3, "0"); });
  cloneHtml = renumberAttr(cloneHtml, fullHtml, slug, "data-img", "i(\\d+)",
    function (n) { return "i" + n; });
  return cloneHtml;
}

/* ---------- GitHub io ---------- */
async function ghGet(api, headers) {
  const r = await fetch(`${api}?ref=${BRANCH}`, { headers });
  if (!r.ok) return null;
  return r.json();
}
async function ghPut(api, headers, message, content, sha) {
  const payload = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch: BRANCH,
  };
  if (sha) payload.sha = sha;
  return fetch(api, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const body = req.body || {};
    if (!process.env.EDIT_PASSWORD || !process.env.GITHUB_TOKEN) {
      res.status(500).json({ error: "Editor not configured" });
      return;
    }
    if (!safeEqual(body.password, process.env.EDIT_PASSWORD)) {
      res.status(401).json({ error: "Wrong password" });
      return;
    }
    const page = body.page;
    if (typeof page !== "string" || !PAGE_RE.test(page)) {
      res.status(400).json({ error: "Bad page" });
      return;
    }
    const slug = page.replace(/\.html$/, "");
    const ghPath = `${SITE_DIR}/${page}`;
    const api = `https://api.github.com/repos/${REPO}/contents/${encodeURI(ghPath)}`;
    const ghHeaders = {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "skylon-site-editor",
    };
    const meta = await ghGet(api, ghHeaders);
    if (!meta) {
      res.status(404).json({ error: "Page not found" });
      return;
    }
    let html = Buffer.from(meta.content, "base64").toString("utf8");
    let message = "";

    if (body.action === "reorder") {
      let changed = 0;
      if (Array.isArray(body.sections)) {
        const mm = html.match(/(<main id="main">)([\s\S]*)(<\/main>)/);
        if (!mm) { res.status(400).json({ error: "No main" }); return; }
        const blocks = topBlocks(mm[2], "section");
        const out = permute(mm[2], blocks, body.sections);
        if (!out) { res.status(400).json({ error: "Bad section order" }); return; }
        html = html.replace(mm[0], mm[1] + out + mm[3]);
        changed += 1;
      }
      if (body.grids && typeof body.grids === "object") {
        for (const gid of Object.keys(body.grids)) {
          if (!GRID_RE.test(gid)) continue;
          const region = gridRegion(html, gid);
          if (!region) continue;
          const frag = html.slice(region.start, region.end);
          const tag = childTagOf(frag);
          if (!tag) continue;
          const inner = frag;
          const blocks = topBlocks(inner, tag).slice(tag === "div" ? 1 : 0);
          const out = permute(inner, blocks, body.grids[gid]);
          if (!out) { res.status(400).json({ error: `Bad order for ${gid}` }); return; }
          html = html.slice(0, region.start) + out + html.slice(region.end);
          changed += 1;
        }
      }
      if (!changed) { res.status(400).json({ error: "Nothing to reorder" }); return; }
      message = `Layout update via site editor: ${page}`;
    } else if (body.action === "addFigure") {
      const gid = body.grid, src = body.src;
      const alt = String(body.alt || "").replace(/[<>"]/g, "").slice(0, 160);
      if (!GRID_RE.test(String(gid)) || !SRC_RE.test(String(src))) {
        res.status(400).json({ error: "Bad grid/src" });
        return;
      }
      const region = gridRegion(html, gid);
      if (!region) { res.status(404).json({ error: "Grid not found" }); return; }
      const frag = html.slice(region.start, region.end);
      const tag = childTagOf(frag);
      const figures = tag ? topBlocks(frag, tag) : [];
      if (!figures.length) { res.status(400).json({ error: "Grid has no item template" }); return; }
      let clone = frag.slice(figures[0].start, figures[0].end);
      clone = clone.replace(/src="assets\/images\/[^"]+"/, `src="${src}"`);
      clone = clone.replace(/alt="[^"]*"/, `alt="${alt}"`);
      clone = clone.replace(/<!--[\s\S]*?-->/g, "");
      clone = clone.replace(/(<figcaption\b[^>]*>)[\s\S]*?(<\/figcaption>)/, "$1$2");
      clone = clone.replace(/<span class="masonry__caption">[\s\S]*?<\/strong>\s*<\/span>/, "");
      clone = clone.replace(/aria-label="[^"]*"/, 'aria-label="View larger"');
      clone = renumberDataEdit(clone, html, slug);
      const last = figures[figures.length - 1];
      const insertAt = region.start + last.end;
      html = html.slice(0, insertAt) + "\n" + clone + html.slice(insertAt);
      message = `Gallery add via site editor: ${page} (${src})`;
    } else if (body.action === "removeItem") {
      const gid = body.grid, index = body.index;
      if (!GRID_RE.test(String(gid)) || !Number.isInteger(index) || index < 0) {
        res.status(400).json({ error: "Bad grid/index" });
        return;
      }
      const region = gridRegion(html, gid);
      if (!region) { res.status(404).json({ error: "Grid not found" }); return; }
      const frag = html.slice(region.start, region.end);
      const tag = childTagOf(frag);
      const blocks = topBlocks(frag, tag);
      if (index >= blocks.length) { res.status(400).json({ error: "Index out of range" }); return; }
      if (blocks.length <= 1) { res.status(400).json({ error: "Cannot remove the last item" }); return; }
      const b = blocks[index];
      const newFrag = frag.slice(0, b.start) + frag.slice(b.end);
      html = html.slice(0, region.start) + newFrag + html.slice(region.end);
      message = `Gallery remove via site editor: ${page} (#${index + 1})`;
    } else if (body.action === "setImageSrc") {
      const imgId = body.imgId, src = body.src;
      if (!IMG_RE.test(String(imgId)) || !SRC_RE.test(String(src))) {
        res.status(400).json({ error: "Bad imgId/src" });
        return;
      }
      const tagRe = new RegExp(`<img\\b[^>]*data-img="${imgId}"[^>]*>`);
      const tagMatch = html.match(tagRe);
      if (!tagMatch) { res.status(404).json({ error: "Image slot not found" }); return; }
      const newTag = tagMatch[0].replace(/src="[^"]*"/, `src="${src}"`);
      html = html.replace(tagMatch[0], newTag);
      message = `Photo replace via site editor: ${page} (${imgId})`;
    } else if (body.action === "createCaseStudy" || body.action === "addProject") {
      const isNew = body.action === "addProject";
      const cardId = body.card;
      const name = String(body.name || "").trim().slice(0, 80);
      const location = String(body.location || "London").trim().slice(0, 60);
      const category = CATS.includes(body.category) ? body.category : "commercial";
      if (name.length < 3 || (!isNew && !CARD_RE.test(String(cardId)))) {
        res.status(400).json({ error: "Bad name/card" });
        return;
      }
      const newSlug = slugify(name);
      const safeName = escapeHtml(name);
      const safeLoc = escapeHtml(location);
      const pageApi = (f) => `https://api.github.com/repos/${REPO}/contents/${encodeURI(SITE_DIR + "/" + f)}`;

      // 1) strona z szablonu (idempotentnie)
      const exists = await ghGet(pageApi(newSlug), ghHeaders);
      if (!exists) {
        const tplMeta = await ghGet(pageApi("project-template.html"), ghHeaders);
        if (!tplMeta) { res.status(500).json({ error: "Template missing in repo" }); return; }
        let tpl = Buffer.from(tplMeta.content, "base64").toString("utf8");
        const newPrefix = newSlug.replace(/\.html$/, "");
        tpl = tpl.split("project-template").join(newPrefix)
                 .split("{{NAME}}").join(safeName)
                 .split("{{LOCATION}}").join(safeLoc)
                 .split("{{SLUG}}").join(newSlug);
        const putPage = await ghPut(pageApi(newSlug), ghHeaders,
          `Case study created via site editor: ${newSlug}`, tpl);
        if (!putPage.ok) {
          const d = await putPage.text();
          res.status(502).json({ error: "Could not create page", detail: d.slice(0, 160) });
          return;
        }
      }

      // 2) karta w siatce
      if (!isNew) {
        const tagRe = new RegExp(`<div class="project-card[^"]*"[^>]*data-card="${cardId}"[^>]*>`);
        const openM = html.match(tagRe);
        if (openM) {
          const start = html.indexOf(openM[0]);
          const block = blockAt(html, start, "div");
          if (block) {
            let card = html.slice(block.start, block.end);
            let openTag = openM[0]
              .replace(/^<div /, "<a ")
              .replace(/ data-cat="[^"]*"/, "")
              .replace(/ data-card="/, ` href="${newSlug}" data-cat="${category}" data-card="`);
            card = card.replace(openM[0], openTag);
            card = card.replace(/<span class="video-card__soon"[^>]*>[\s\S]*?<\/span>\s*/, "");
            card = card.replace(/<\/div>\s*$/, "</a>");
            html = html.slice(0, block.start) + card + html.slice(block.end);
            const putGrid = await ghPut(api, ghHeaders,
              `Case study linked via site editor: ${page} -> ${newSlug}`, html, meta.sha);
            if (!putGrid.ok) {
              const d = await putGrid.text();
              res.status(502).json({ error: "Page created but card update failed, retry", detail: d.slice(0, 160) });
              return;
            }
          }
        }
      } else if (!html.includes(`href="${newSlug}"`)) {
        const region = gridRegion(html, "projects-g1");
        if (!region) { res.status(404).json({ error: "Projects grid not found" }); return; }
        const frag = html.slice(region.start, region.end);
        const cards = topBlocks(frag, "a");
        if (!cards.length) { res.status(400).json({ error: "No card template" }); return; }
        let clone = frag.slice(cards[0].start, cards[0].end);
        clone = clone.replace(/href="[^"]*"/, `href="${newSlug}"`);
        clone = clone.replace(/data-cat="[^"]*"/, `data-cat="${category}"`);
        clone = clone.replace(/src="assets\/images\/[^"]+"/, 'src="assets/images/placeholder-photo.webp"');
        clone = clone.replace(/alt="[^"]*"/, 'alt=""');
        clone = clone.replace(/(<span class="project-card__cat"[^>]*>)[\s\S]*?(<\/span>)/, `$1${safeLoc}$2`);
        clone = clone.replace(/(<h3[^>]*>)[\s\S]*?(<\/h3>)/, `$1${safeName}$2`);
        clone = clone.replace(/<!--[\s\S]*?-->/g, "");
        clone = renumberDataEdit(clone, html, slug);
        clone = renumberDataCard(clone, html);
        const insertAt = region.end - "</div>".length;
        html = html.slice(0, insertAt) + clone + "\n        " + html.slice(insertAt);
        const putGrid = await ghPut(api, ghHeaders,
          `Project card added via site editor: ${newSlug}`, html, meta.sha);
        if (!putGrid.ok) {
          const d = await putGrid.text();
          res.status(502).json({ error: "Page created but card insert failed, retry", detail: d.slice(0, 160) });
          return;
        }
      }

      // 3) sitemap (idempotentnie)
      const smApi = pageApi("sitemap.xml");
      const smMeta = await ghGet(smApi, ghHeaders);
      if (smMeta) {
        let sm = Buffer.from(smMeta.content, "base64").toString("utf8");
        if (!sm.includes(newSlug)) {
          sm = sm.replace("</urlset>",
            `  <url>\n    <loc>https://www.skylonconstruction.com/${newSlug}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n</urlset>`);
          await ghPut(smApi, ghHeaders, `Sitemap: add ${newSlug}`, sm, smMeta.sha);
        }
      }
      res.status(200).json({ ok: true, slug: newSlug });
      return;
    } else if (body.action === "setLink") {
      // -------- ADRES POD LOGO --------
      const linkId = String(body.link || "");
      let href = String(body.href || "#").trim();
      if (!/^[a-z0-9-]+$/i.test(linkId.replace(/-/g, "-"))) {
        res.status(400).json({ error: "Bad link id" });
        return;
      }
      if (href !== "#" && !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(href)) {
        res.status(400).json({ error: "Link must be a full https:// address" });
        return;
      }
      href = href.replace(/["<>]/g, "");
      const re = new RegExp(
        `(<a\\b[^>]*data-link="${linkId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>)`
      );
      const hit = html.match(re);
      if (!hit) { res.status(404).json({ error: "Link slot not found" }); return; }
      let openTag = hit[1];
      openTag = /href="/.test(openTag)
        ? openTag.replace(/href="[^"]*"/, `href="${href}"`)
        : openTag.replace(/^<a /, `<a href="${href}" `);
      html = html.replace(hit[1], openTag);
      message = `Link updated via site editor: ${page} (${linkId})`;
    } else if (body.action === "createBlogPost") {
      // -------- NOWY WPIS NA BLOGU --------
      const title = String(body.title || "").trim().slice(0, 110);
      const category = String(body.category || "Craft").trim().slice(0, 30).replace(/[<>"]/g, "");
      const intro = String(body.intro || "").trim().slice(0, 160).replace(/[<>"]/g, "");
      if (title.length < 8) {
        res.status(400).json({ error: "Title must be at least 8 characters" });
        return;
      }

      const postSlug = slugify(title);
      const safeTitle = escapeHtml(title);
      const safeCat = escapeHtml(category);
      const safeIntro = escapeHtml(intro || title);
      const today = new Date().toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      });
      const blogApi = (f) =>
        `https://api.github.com/repos/${REPO}/contents/${encodeURI(SITE_DIR + "/" + f)}`;

      // 1) strona z szablonu (idempotentnie)
      const already = await ghGet(blogApi(postSlug), ghHeaders);
      if (!already) {
        const tplMeta = await ghGet(blogApi("blog-template.html"), ghHeaders);
        if (!tplMeta) {
          res.status(500).json({ error: "blog-template.html missing in repo" });
          return;
        }
        let tpl = Buffer.from(tplMeta.content, "base64").toString("utf8");
        const newPrefix = postSlug.replace(/\.html$/, "");
        tpl = tpl.split("blog-template").join(newPrefix)
                 .split("{{TITLE}}").join(safeTitle)
                 .split("{{CATEGORY}}").join(safeCat)
                 .split("{{INTRO}}").join(safeIntro)
                 .split("{{DATE}}").join(today)
                 .split("{{SLUG}}").join(postSlug);
        const putPost = await ghPut(blogApi(postSlug), ghHeaders,
          `Journal post created via site editor: ${postSlug}`, tpl);
        if (!putPost.ok) {
          const d = await putPost.text();
          res.status(502).json({ error: "Could not create post page", detail: d.slice(0, 160) });
          return;
        }
      }

      // 2) kafelek na blog.html
      if (!html.includes(`href="${postSlug}"`)) {
        const region = gridRegion(html, "blog-g1");
        if (!region) { res.status(404).json({ error: "Journal grid not found" }); return; }
        const frag = html.slice(region.start, region.end);
        const cards = topBlocks(frag, "a");
        if (!cards.length) { res.status(400).json({ error: "No post card template" }); return; }
        let clone = frag.slice(cards[0].start, cards[0].end);
        clone = clone.replace(/href="[^"]*"/, `href="${postSlug}"`);
        clone = clone.replace(/src="assets\/images\/[^"]+"/, 'src="assets/images/placeholder-photo.webp"');
        clone = clone.replace(/alt="[^"]*"/, 'alt=""');
        clone = clone.replace(
          /(<span class="post-card__meta">)[\s\S]*?(<\/span>\s*<\/span>|<\/span>)/,
          `$1<span>${safeCat}</span><span>${today}</span></span>`
        );
        clone = clone.replace(/(<h3[^>]*>)[\s\S]*?(<\/h3>)/, `$1${safeTitle}$2`);
        clone = clone.replace(/(<p[^>]*>)[\s\S]*?(<\/p>)/, `$1${safeIntro}$2`);
        clone = clone.replace(/<!--[\s\S]*?-->/g, "");
        clone = renumberDataEdit(clone, html, slug);
        // nowy wpis na poczatek listy (najnowsze u gory)
        const insertAt = region.start + cards[0].start;
        html = html.slice(0, insertAt) + clone + "\n          " + html.slice(insertAt);
        const putGrid = await ghPut(api, ghHeaders,
          `Journal card added via site editor: ${postSlug}`, html, meta.sha);
        if (!putGrid.ok) {
          const d = await putGrid.text();
          res.status(502).json({ error: "Post created but card insert failed, retry", detail: d.slice(0, 160) });
          return;
        }
      }

      // 3) sitemap (idempotentnie)
      const smApi2 = blogApi("sitemap.xml");
      const smMeta2 = await ghGet(smApi2, ghHeaders);
      if (smMeta2) {
        let sm2 = Buffer.from(smMeta2.content, "base64").toString("utf8");
        if (!sm2.includes(postSlug)) {
          sm2 = sm2.replace("</urlset>",
            `  <url>\n    <loc>https://www.skylonconstruction.com/${postSlug}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n</urlset>`);
          await ghPut(smApi2, ghHeaders, `Sitemap: add ${postSlug}`, sm2, smMeta2.sha);
        }
      }

      res.status(200).json({ ok: true, slug: postSlug });
      return;
    } else {
      res.status(400).json({ error: "Unknown action" });
      return;
    }

    const put = await ghPut(api, ghHeaders, message, html, meta.sha);
    if (!put.ok) {
      if (put.status === 409) {
        res.status(409).json({ error: "Someone else just saved changes. Refresh the page and try again." });
        return;
      }
      const detail = await put.text();
      res.status(502).json({ error: "GitHub commit failed", detail: detail.slice(0, 200) });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Server error", detail: String(e).slice(0, 200) });
  }
};

module.exports._test = { blockAt, topBlocks, permute, gridRegion, childTagOf, renumberDataEdit };

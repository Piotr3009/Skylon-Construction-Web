// Skylon site editor — structure endpoint: reorder sections/cards, add/remove gallery figures.
const crypto = require("crypto");

const REPO = "Piotr3009/Skylon-Construction-Web";
const BRANCH = "main";
const SITE_DIR = "skylon-construction-website";
const PAGE_RE = /^[a-z0-9\-]+\.html$/;
const GRID_RE = /^[a-z0-9\-]+-g\d+$/;
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
  const m = inner.match(/<(figure|article|a)[\s>]/i);
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

function renumberDataEdit(cloneHtml, fullHtml, slug) {
  let max = 0;
  const re = new RegExp(`data-edit="${slug}-(\\d{3})"`, "g");
  let m;
  while ((m = re.exec(fullHtml))) max = Math.max(max, parseInt(m[1], 10));
  return cloneHtml.replace(new RegExp(`data-edit="${slug}-\\d{3}"`, "g"), function () {
    max += 1;
    return `data-edit="${slug}-${String(max).padStart(3, "0")}"`;
  });
}

/* ---------- GitHub io ---------- */
async function ghGet(api, headers) {
  const r = await fetch(`${api}?ref=${BRANCH}`, { headers });
  if (!r.ok) return null;
  return r.json();
}
async function ghPut(api, headers, message, content, sha) {
  return fetch(api, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: BRANCH,
      sha,
    }),
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
      const figures = topBlocks(frag, "figure");
      if (!figures.length) { res.status(400).json({ error: "Grid has no figure template" }); return; }
      let clone = frag.slice(figures[0].start, figures[0].end);
      clone = clone.replace(/src="assets\/images\/[^"]+"/, `src="${src}"`);
      clone = clone.replace(/alt="[^"]*"/, `alt="${alt}"`);
      clone = clone.replace(/<!--[\s\S]*?-->/g, "");
      clone = clone.replace(/(<figcaption\b[^>]*>)[\s\S]*?(<\/figcaption>)/, "$1$2");
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

// Skylon site editor — text update endpoint (Vercel Serverless Function)
// Accepts a batch of slot edits for ONE page → single commit.
const crypto = require("crypto");

const REPO = "Piotr3009/Skylon-Construction-Web";
const BRANCH = "main";
const SITE_DIR = "skylon-construction-website";
const PAGE_RE = /^[a-z0-9\-]+\.html$/;
const ID_RE = /^[a-z0-9\-]+-\d{3}$/;
const TAGS = "(?:h1|h2|h3|h4|p|li|dt|dd|figcaption|summary)";
const MAX_EDITS = 40;
const MAX_LEN = 4000;

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// Keep only <em>/<strong>/<br> (em may keep class="silver-text"); no dashes ever.
function sanitize(html) {
  let s = String(html).slice(0, MAX_LEN);
  s = s.replace(/<div[^>]*>/gi, "<br>").replace(/<\/div>/gi, "");
  s = s.replace(/<(?!\/?(?:em|strong|br)\b)[^>]*>/gi, "");
  s = s.replace(/<em[^>]*class="[^"]*silver-text[^"]*"[^>]*>/gi, '<em class="silver-text">');
  s = s.replace(/<em(?![^>]* class="silver-text")[^>]*>/gi, "<em>");
  s = s.replace(/<strong[^>]*>/gi, "<strong>");
  s = s.replace(/<br[^>]*>/gi, "<br>");
  s = s.replace(/\s*[\u2014\u2013]\s*/g, ", "); // em/en dash -> comma (site rule)
  s = s.replace(/&mdash;|&ndash;/gi, ", ");
  s = s.replace(/\s+,/g, ",").replace(/ {2,}/g, " ");
  s = s.replace(/^(?:\s|<br>)+|(?:\s|<br>)+$/g, "");
  return s;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { password, page, edits } = req.body || {};
    if (!process.env.EDIT_PASSWORD || !process.env.GITHUB_TOKEN) {
      res.status(500).json({ error: "Editor not configured" });
      return;
    }
    if (!safeEqual(password, process.env.EDIT_PASSWORD)) {
      res.status(401).json({ error: "Wrong password" });
      return;
    }
    if (typeof page !== "string" || !PAGE_RE.test(page)) {
      res.status(400).json({ error: "Bad page" });
      return;
    }
    if (!Array.isArray(edits) || edits.length === 0 || edits.length > MAX_EDITS) {
      res.status(400).json({ error: "Bad edits" });
      return;
    }

    const ghPath = `${SITE_DIR}/${page}`;
    const api = `https://api.github.com/repos/${REPO}/contents/${encodeURI(ghPath)}`;
    const ghHeaders = {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "skylon-site-editor",
    };

    const head = await fetch(`${api}?ref=${BRANCH}`, { headers: ghHeaders });
    if (!head.ok) {
      res.status(404).json({ error: "Page not found in repo" });
      return;
    }
    const meta = await head.json();
    let content = Buffer.from(meta.content, "base64").toString("utf8");

    const applied = [];
    for (const e of edits) {
      if (!e || typeof e.id !== "string" || !ID_RE.test(e.id)) continue;
      const clean = sanitize(e.html);
      const re = new RegExp(
        `(<(${TAGS})\\b[^>]*data-edit="${e.id}"[^>]*>)([\\s\\S]*?)(</\\2>)`
      );
      if (re.test(content)) {
        content = content.replace(re, `$1${clean.replace(/\$/g, "$$$$")}$4`);
        applied.push(e.id);
      }
    }
    if (applied.length === 0) {
      res.status(400).json({ error: "No matching slots" });
      return;
    }

    const put = await fetch(api, {
      method: "PUT",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Text update via site editor: ${page} (${applied.length} slot${applied.length > 1 ? "s" : ""})`,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch: BRANCH,
        sha: meta.sha,
      }),
    });
    if (!put.ok) {
      if (put.status === 409) {
        res.status(409).json({ error: "Someone else just saved changes. Refresh the page and try again." });
        return;
      }
      const detail = await put.text();
      res.status(502).json({ error: "GitHub commit failed", detail: detail.slice(0, 200) });
      return;
    }
    res.status(200).json({ ok: true, applied });
  } catch (e) {
    res.status(500).json({ error: "Server error", detail: String(e).slice(0, 200) });
  }
};

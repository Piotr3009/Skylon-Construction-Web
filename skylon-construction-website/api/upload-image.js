// Skylon site editor — image upload endpoint (Vercel Serverless Function)
// Env vars required (Vercel → Settings → Environment Variables):
//   EDIT_PASSWORD  — team password for edit mode
//   GITHUB_TOKEN   — fine-grained PAT, repo Skylon-Construction-Web, Contents: Read/Write
const crypto = require("crypto");

const REPO = "Piotr3009/Skylon-Construction-Web";
const BRANCH = "main";
const SITE_DIR = "skylon-construction-website";
const PATH_RE = /^assets\/images\/[a-z0-9][a-z0-9\-\/_.]*\.(webp|jpg|jpeg|png)$/i;
const MAX_BYTES = 3.5 * 1024 * 1024; // ~3.5 MB after client-side compression

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { password, path, dataBase64 } = req.body || {};

    if (!process.env.EDIT_PASSWORD || !process.env.GITHUB_TOKEN) {
      res.status(500).json({ error: "Editor not configured (missing env vars)" });
      return;
    }
    if (!safeEqual(password, process.env.EDIT_PASSWORD)) {
      res.status(401).json({ error: "Wrong password" });
      return;
    }
    if (typeof path !== "string" || !PATH_RE.test(path) || path.includes("..")) {
      res.status(400).json({ error: "Path not allowed" });
      return;
    }
    if (typeof dataBase64 !== "string" || dataBase64.length < 100) {
      res.status(400).json({ error: "No image data" });
      return;
    }
    const bytes = Math.floor(dataBase64.length * 0.75);
    if (bytes > MAX_BYTES) {
      res.status(413).json({ error: "Image too large after compression" });
      return;
    }

    const ghPath = `${SITE_DIR}/${path}`;
    const api = `https://api.github.com/repos/${REPO}/contents/${encodeURI(ghPath)}`;
    const ghHeaders = {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "skylon-site-editor",
    };

    // existing file? (need sha to update)
    let sha;
    const head = await fetch(`${api}?ref=${BRANCH}`, { headers: ghHeaders });
    if (head.ok) sha = (await head.json()).sha;

    const put = await fetch(api, {
      method: "PUT",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Photo update via site editor: ${path}`,
        content: dataBase64,
        branch: BRANCH,
        ...(sha ? { sha } : {}),
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
    res.status(200).json({ ok: true, path });
  } catch (e) {
    res.status(500).json({ error: "Server error", detail: String(e).slice(0, 200) });
  }
};

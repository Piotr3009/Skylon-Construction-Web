// Skylon site editor — video upload endpoint (Vercel Serverless Function)
// The browser sends big video files STRAIGHT to Vercel Blob storage; this
// endpoint only hands out a short one-time permission after checking the
// team password. The file itself never passes through here, because Vercel
// functions cap request bodies at 4.5 MB.
const crypto = require("crypto");
const { handleUpload } = require("@vercel/blob/client");

const MAX_VIDEO = 500 * 1024 * 1024; // videos page: hard stop at 500 MB
const MAX_HERO = 30 * 1024 * 1024;   // hero loop autoplays for everyone, keep it small
const PATH_RE = /^videos\/[a-z0-9][a-z0-9\-]*-\d+\.(mp4|webm|mov)$/;

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
    if (!process.env.EDIT_PASSWORD) {
      res.status(500).json({ error: "Editor not configured" });
      return;
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      res.status(500).json({
        error: "Video storage is not enabled yet. In Vercel: Storage, Create Blob store, connect it to this project, then Redeploy.",
      });
      return;
    }
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload = {};
        try { payload = JSON.parse(clientPayload || "{}"); } catch (_e) { /* fall through */ }
        if (!safeEqual(payload.password, process.env.EDIT_PASSWORD)) {
          throw new Error("Wrong password");
        }
        if (!PATH_RE.test(pathname)) {
          throw new Error("Bad file path");
        }
        const isHero = pathname.indexOf("videos/hero-loop-") === 0;
        return {
          allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime"],
          maximumSizeInBytes: isHero ? MAX_HERO : MAX_VIDEO,
          addRandomSuffix: false,
          tokenPayload: "",
        };
      },
      // The editor confirms success itself by calling /api/structure afterwards.
      onUploadCompleted: async () => {},
    });
    res.status(200).json(jsonResponse);
  } catch (e) {
    res.status(400).json({ error: String((e && e.message) || e).slice(0, 200) });
  }
};

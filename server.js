const express = require("express");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const app = express();
const PORT = process.env.PORT || 3000;
const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION || "ap-south-1";

const s3 = new S3Client({ region: REGION });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/upload-url", async (req, res) => {
  try {
    if (!BUCKET) return res.status(500).json({ error: "S3_BUCKET is not configured." });

    const { fileName, contentType } = req.body || {};
    if (!fileName || !contentType || !contentType.startsWith("image/")) {
      return res.status(400).json({ error: "Please provide a valid image file." });
    }

    const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
    if (!allowed.has(contentType)) {
      return res.status(400).json({ error: "Allowed formats: PNG, JPG, WEBP, GIF." });
    }

    const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `app-logos/${Date.now()}-${safeName}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    res.json({ uploadUrl, key });
  } catch (err) {
    console.error("Could not create upload URL:", err);
    res.status(500).json({ error: "Could not prepare the S3 upload. Check server permissions." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`App listening on port ${PORT}`);
});

const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

const {
  S3Client,
  PutObjectCommand
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const app = express();

const PORT = process.env.PORT || 3000;
const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION || "ap-south-1";

// MySQL RDS configuration
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// S3 configuration
const s3 = new S3Client({ region: REGION });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get("/api/health", async (_req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    console.error("Database health check failed:", err.message);
    res.status(503).json({
      ok: false,
      database: "disconnected"
    });
  }
});

// Save user details in RDS MySQL
app.post("/api/profiles", async (req, res) => {
  try {
    const { name, age } = req.body || {};

    const cleanName = String(name || "").trim();
    const parsedAge = Number(age);

    if (
      !cleanName ||
      cleanName.length > 80 ||
      !Number.isInteger(parsedAge) ||
      parsedAge < 1 ||
      parsedAge > 120
    ) {
      return res.status(400).json({
        error: "Enter a valid name and age."
      });
    }

    const [result] = await db.execute(
      "INSERT INTO users (name, age) VALUES (?, ?)",
      [cleanName, parsedAge]
    );

    res.status(201).json({
      message: "Profile saved successfully!",
      id: result.insertId,
      name: cleanName,
      age: parsedAge
    });

  } catch (err) {
    console.error("Could not save profile:", err.message);

    res.status(500).json({
      error: "Could not save profile in the database."
    });
  }
});

// Retrieve saved user details
app.get("/api/profiles", async (_req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, name, age, created_at FROM users ORDER BY id DESC"
    );

    res.json(rows);

  } catch (err) {
    console.error("Could not retrieve profiles:", err.message);

    res.status(500).json({
      error: "Could not retrieve profiles."
    });
  }
});

// Existing S3 upload URL endpoint
app.post("/api/upload-url", async (req, res) => {
  try {
    if (!BUCKET) {
      return res.status(500).json({
        error: "S3_BUCKET is not configured."
      });
    }

    const { fileName, contentType } = req.body || {};

    if (!fileName || !contentType || !contentType.startsWith("image/")) {
      return res.status(400).json({
        error: "Please provide a valid image file."
      });
    }

    const allowed = new Set([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif"
    ]);

    if (!allowed.has(contentType)) {
      return res.status(400).json({
        error: "Allowed formats: PNG, JPG, WEBP, GIF."
      });
    }

    const safeName = String(fileName).replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    const key = `app-logos/${Date.now()}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 300
    });

    res.json({ uploadUrl, key });

  } catch (err) {
    console.error("Could not create upload URL:", err);

    res.status(500).json({
      error: "Could not prepare the S3 upload. Check server permissions."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`App listening on port ${PORT}`);
});

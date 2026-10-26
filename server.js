const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const { load, save } = require("./lib/store");
const { signToken, readToken } = require("./lib/tokens");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "10kb" }));

// Security headers (CSP blunts any XSS that slips through escaping).
app.use((_req, res, next) => {
  res.set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "no-referrer");
  next();
});

app.use(express.static(path.join(__dirname, "public")));

// Tiny in-memory login rate limiter: 10 attempts per 15 min per IP.
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function loginLimiter(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  const rec = attempts.get(key);
  if (!rec || now - rec.start > WINDOW_MS) {
    attempts.set(key, { start: now, count: 1 });
    return next();
  }
  rec.count += 1;
  if (rec.count > MAX_ATTEMPTS) {
    return res.status(429).json({ error: "Too many attempts. Try again later." });
  }
  next();
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role
  };
}

// Role comes from the database, never from the token claims.
function requireUser(req, res, next) {
  const claims = readToken(req.headers.authorization);
  if (!claims) return res.status(401).json({ error: "Sign in again." });
  const user = load().users.find((row) => row.id === Number(claims.sub));
  if (!user) return res.status(401).json({ error: "Unknown account." });
  req.claims = { sub: user.id, username: user.username, role: user.role };
  next();
}

app.get("/api/health", (_req, res) => {
  load();
  res.json({ ok: true });
});

app.post("/api/login", loginLimiter, (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const db = load();
  const user = db.users.find((row) => row.username === username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Those credentials do not match a Marks account." });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get("/api/me", requireUser, (req, res) => {
  const db = load();
  const user = db.users.find((row) => row.id === Number(req.claims.sub));
  if (!user) return res.status(401).json({ error: "Unknown account." });
  const grades = db.grades.filter((row) => row.student_id === user.id);
  res.json({ user: publicUser(user), course: db.section.course, grades });
});

// FIX: ownership check (was an IDOR). Students see only themselves; TA sees any.
app.get("/api/students/:id", requireUser, (req, res) => {
  const id = Number(req.params.id);
  if (req.claims.role !== "ta" && req.claims.sub !== id) {
    return res.status(403).json({ error: "You can only view your own marks." });
  }
  const db = load();
  const student = db.users.find((row) => row.id === id && row.role === "student");
  if (!student) return res.status(404).json({ error: "No student with that id." });
  const grades = db.grades.filter((row) => row.student_id === student.id);
  res.json({ user: publicUser(student), grades });
});

app.get("/api/section", requireUser, (req, res) => {
  if (req.claims.role !== "ta") {
    return res.status(403).json({ error: "Section view is for the TA." });
  }
  const db = load();
  const students = db.users
    .filter((row) => row.role === "student")
    .map((student) => ({
      user: publicUser(student),
      grades: db.grades.filter((row) => row.student_id === student.id)
    }));
  res.json({
    course: db.section.course,
    term: db.section.term,
    instructor_note: db.section.instructor_note,
    students
  });
});

app.post("/api/grades", requireUser, (req, res) => {
  if (req.claims.role !== "ta") {
    return res.status(403).json({ error: "Only the TA can enter marks." });
  }
  const studentId = Number(req.body.student_id);
  const item = String(req.body.item || "").trim();
  const score = Number(req.body.score);
  const outOf = Number(req.body.out_of);
  if (!studentId || !item || Number.isNaN(score) || Number.isNaN(outOf)) {
    return res.status(400).json({ error: "student_id, item, score, and out_of are required." });
  }
  if (item.length > 60 || score < 0 || outOf <= 0 || score > outOf) {
    return res.status(400).json({ error: "Invalid item or score." });
  }
  const db = load();
  if (!db.users.some((u) => u.id === studentId && u.role === "student")) {
    return res.status(400).json({ error: "Unknown student." });
  }
  db.grades.push({ student_id: studentId, item, score, out_of: outOf });
  save(db);
  res.status(201).json({ ok: true });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => {
  load();
  console.log(`Marks listening on ${port}`);
});

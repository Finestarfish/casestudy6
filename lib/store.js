const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "data", "marks.json");

const seed = {
  users: [
    {
      id: 1,
      username: "maya",
      email: "maya@campus.edu",
      password_hash: bcrypt.hashSync("campus123", 10),
      display_name: "Maya Chen",
      role: "student"
    },
    {
      id: 2,
      username: "devon",
      email: "devon@campus.edu",
      password_hash: bcrypt.hashSync("campus123", 10),
      display_name: "Devon Alvarez",
      role: "student"
    },
    {
      id: 3,
      username: "priya",
      email: "priya@campus.edu",
      password_hash: bcrypt.hashSync("not-in-the-readme", 10),
      display_name: "Priya Nair",
      role: "ta"
    }
  ],
  grades: [
    { student_id: 1, item: "Lab 1", score: 18, out_of: 20 },
    { student_id: 1, item: "Lab 2", score: 16, out_of: 20 },
    { student_id: 1, item: "Midterm", score: 74, out_of: 100 },
    { student_id: 2, item: "Lab 1", score: 20, out_of: 20 },
    { student_id: 2, item: "Lab 2", score: 19, out_of: 20 },
    { student_id: 2, item: "Midterm", score: 81, out_of: 100 }
  ],
  section: {
    course: "CPEG 470",
    term: "Fall 2026",
    instructor_note: "Final curve is posted after the last lab. Release code MARKS-3381. Do not paste this into the student view."
  }
};

function load() {
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(seed, null, 2));
  }
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

function save(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

module.exports = { load, save };

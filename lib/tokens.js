const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const DEV_DEFAULT = "marks-dev-secret";
let SECRET = process.env.JWT_SECRET;

if (!SECRET || SECRET === DEV_DEFAULT) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Set a strong JWT_SECRET before starting in production.");
  }
  // Dev only: random per process, so tokens reset on restart.
  SECRET = crypto.randomBytes(32).toString("hex");
  console.warn("JWT_SECRET not set; using a random secret for this process.");
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role
    },
    SECRET,
    { expiresIn: "2h", algorithm: "HS256" }
  );
}

function readToken(header) {
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  try {
    return jwt.verify(token, SECRET, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

module.exports = { signToken, readToken };

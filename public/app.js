const tokenKey = "marks_token";

// FIX: escape everything interpolated into innerHTML (stored XSS).
function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function token() {
  return localStorage.getItem(tokenKey);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token()) headers.Authorization = "Bearer " + token();
  if (options.body) headers["Content-Type"] = "application/json";
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function nav(user) {
  const el = document.getElementById("nav");
  if (!user) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<span>${esc(user.display_name)}</span><button id="out" type="button">Sign out</button>`;
  document.getElementById("out").onclick = () => {
    localStorage.removeItem(tokenKey);
    render();
  };
}

function loginView(error) {
  return `
    <section class="narrow">
      <h1>Sign in</h1>
      <p class="lede">Demo accounts are in the project README. Use the username.</p>
      ${error ? `<p class="flash">${esc(error)}</p>` : ""}
      <form id="login" class="stack">
        <label><span>Username</span><input name="username" autocomplete="username" required></label>
        <label><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
        <button type="submit">Sign in</button>
      </form>
    </section>`;
}

function gradesTable(rows) {
  if (!rows.length) return "<p class=\"lede\">No marks yet.</p>";
  const body = rows.map((row) => `<tr><td>${esc(row.item)}</td><td>${esc(row.score)}</td><td>${esc(row.out_of)}</td></tr>`).join("");
  return `<table><thead><tr><th>Item</th><th>Score</th><th>Out of</th></tr></thead><tbody>${body}</tbody></table>`;
}

function studentView(data) {
  return `
    <section>
      <h1>${esc(data.course)}</h1>
      <p class="lede">${esc(data.user.display_name)}</p>
      ${gradesTable(data.grades)}
    </section>`;
}

function sectionView(data) {
  const blocks = data.students.map((row) => `
    <article class="card">
      <h2>${esc(row.user.display_name)}</h2>
      ${gradesTable(row.grades)}
    </article>`).join("");
  return `
    <section>
      <h1>${esc(data.course)} · ${esc(data.term)}</h1>
      <p class="note">${esc(data.instructor_note)}</p>
      ${blocks}
    </section>`;
}

function showLogin(error) {
  const app = document.getElementById("app");
  nav(null);
  app.innerHTML = loginView(error);
  document.getElementById("login").onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password")
        })
      });
      localStorage.setItem(tokenKey, data.token);
      render();
    } catch (err) {
      showLogin(err.message);
    }
  };
}

async function render() {
  const app = document.getElementById("app");
  if (!token()) {
    showLogin();
    return;
  }

  try {
    const me = await api("/api/me");
    nav(me.user);
    if (me.user.role === "ta") {
      const section = await api("/api/section");
      app.innerHTML = sectionView(section);
    } else {
      app.innerHTML = studentView(me);
    }
  } catch (err) {
    localStorage.removeItem(tokenKey);
    showLogin(err.message);
  }
}

render();

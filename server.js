
const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");
const { Pool } = require("pg");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");

const app = express();
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL environment variable.");
}

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error("Missing SESSION_SECRET environment variable.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const PgSession = connectPgSimple(session);

if (isProduction) app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json({ limit: "100kb" }));

app.use(session({
  store: new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || "local-development-secret-change-this",
  resave: false,
  saveUninitialized: false,
  name: "portopedia.sid",
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." }
});

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Please sign in first." });
  }
  next();
}

function cleanString(value, maxLength = 500) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function validUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(24) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique
      ON users (LOWER(username));

    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
      ON users (LOWER(email));

    CREATE TABLE IF NOT EXISTS portfolios (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL UNIQUE
        REFERENCES users(id) ON DELETE CASCADE,
      slug VARCHAR(40) NOT NULL UNIQUE,
      display_name VARCHAR(80) NOT NULL DEFAULT '',
      headline VARCHAR(160) NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      category VARCHAR(60) NOT NULL DEFAULT 'Other',
      skills TEXT[] NOT NULL DEFAULT '{}',
      social_links JSONB NOT NULL DEFAULT '{}',
      published BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id BIGSERIAL PRIMARY KEY,
      portfolio_id BIGINT NOT NULL
        REFERENCES portfolios(id) ON DELETE CASCADE,
      title VARCHAR(120) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category VARCHAR(60) NOT NULL DEFAULT '',
      project_url TEXT,
      image_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS portfolios_published_idx
      ON portfolios(published);

    CREATE INDEX IF NOT EXISTS projects_portfolio_idx
      ON projects(portfolio_id);
  `);
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function getPortfolio(userId) {
  const result = await pool.query(`
    SELECT p.*, u.username
    FROM portfolios p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id = $1
  `, [userId]);

  if (!result.rows.length) return null;

  const portfolio = result.rows[0];

  const projects = await pool.query(`
    SELECT id, title, description, category,
           project_url, image_url, sort_order
    FROM projects
    WHERE portfolio_id = $1
    ORDER BY sort_order, id
  `, [portfolio.id]);

  return { ...portfolio, projects: projects.rows };
}

app.get("/api/health", async (req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    next(err);
  }
});

// Create an account
app.post("/api/register", authLimiter, async (req, res, next) => {
  const username = cleanString(req.body.username, 24);
  const email = cleanString(req.body.email, 255).toLowerCase();
  const password = req.body.password;

  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    return res.status(400).json({
      error: "Username must be 3–24 characters and use only letters, numbers or underscores."
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    return res.status(400).json({
      error: "Password must be between 8 and 128 characters."
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const passwordHash = await bcrypt.hash(password, 12);

    const created = await client.query(`
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email
    `, [username, email, passwordHash]);

    const user = created.rows[0];

    await client.query(`
      INSERT INTO portfolios (user_id, slug, display_name)
      VALUES ($1, $2, $3)
    `, [user.id, username.toLowerCase(), username]);

    await client.query("COMMIT");

    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);

    res.status(201).json({ user });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});

    if (err.code === "23505") {
      return res.status(409).json({
        error: "That username or email is already registered."
      });
    }

    next(err);
  } finally {
    client.release();
  }
});

// Sign in with username or email
app.post("/api/login", authLimiter, async (req, res, next) => {
  const identifier = cleanString(req.body.identifier, 255);
  const password = req.body.password;

  if (!identifier || typeof password !== "string") {
    return res.status(400).json({
      error: "Enter your username or email and password."
    });
  }

  try {
    const result = await pool.query(`
      SELECT id, username, email, password_hash
      FROM users
      WHERE LOWER(username) = LOWER($1)
         OR LOWER(email) = LOWER($1)
      LIMIT 1
    `, [identifier]);

    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        error: "Username/email or password is incorrect."
      });
    }

    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    next(err);
  }
});

// Current account
app.get("/api/me", async (req, res, next) => {
  if (!req.session.userId) return res.json({ user: null });

  try {
    const result = await pool.query(`
      SELECT id, username, email, created_at
      FROM users WHERE id = $1
    `, [req.session.userId]);

    if (!result.rows.length) {
      return res.json({ user: null });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Sign out
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Could not sign out." });

    res.clearCookie("portopedia.sid", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax"
    });

    res.json({ ok: true });
  });
});

// Get your own portfolio
app.get("/api/portfolio", requireAuth, async (req, res, next) => {
  try {
    const portfolio = await getPortfolio(req.session.userId);

    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found." });
    }

    res.json({ portfolio });
  } catch (err) {
    next(err);
  }
});

// Update your portfolio
app.put("/api/portfolio", requireAuth, async (req, res, next) => {
  const displayName = cleanString(req.body.display_name, 80);
  const headline = cleanString(req.body.headline, 160);
  const bio = cleanString(req.body.bio, 3000);
  const category = cleanString(req.body.category, 60) || "Other";

  const skills = Array.isArray(req.body.skills)
    ? [...new Set(req.body.skills
        .filter((s) => typeof s === "string")
        .map((s) => s.trim().slice(0, 40))
        .filter(Boolean))]
        .slice(0, 30)
    : [];

  const allowedSocials = ["website", "linkedin", "github", "instagram", "youtube"];
  const socialLinks = {};

  if (
    req.body.social_links &&
    typeof req.body.social_links === "object" &&
    !Array.isArray(req.body.social_links)
  ) {
    for (const key of allowedSocials) {
      const value = cleanString(req.body.social_links[key], 500);
      if (!value) continue;

      const safeUrl = validUrl(value);
      if (safeUrl) socialLinks[key] = safeUrl;
    }
  }

  const published = req.body.published === true;

  try {
    await pool.query(`
      UPDATE portfolios
      SET display_name = $1,
          headline = $2,
          bio = $3,
          category = $4,
          skills = $5,
          social_links = $6,
          published = $7,
          updated_at = NOW()
      WHERE user_id = $8
    `, [
      displayName || "Creator",
      headline,
      bio,
      category,
      skills,
      JSON.stringify(socialLinks),
      published,
      req.session.userId
    ]);

    const portfolio = await getPortfolio(req.session.userId);
    res.json({ portfolio });
  } catch (err) {
    next(err);
  }
});

// Add a project to your portfolio
app.post("/api/projects", requireAuth, async (req, res, next) => {
  const title = cleanString(req.body.title, 120);
  const description = cleanString(req.body.description, 2000);
  const category = cleanString(req.body.category, 60);
  const projectUrl = req.body.project_url
    ? validUrl(cleanString(req.body.project_url, 1000))
    : null;
  const imageUrl = req.body.image_url
    ? validUrl(cleanString(req.body.image_url, 1000))
    : null;

  if (!title) {
    return res.status(400).json({ error: "Project title is required." });
  }

  if (req.body.project_url && !projectUrl) {
    return res.status(400).json({
      error: "Project link must be a valid HTTPS URL."
    });
  }

  if (req.body.image_url && !imageUrl) {
    return res.status(400).json({
      error: "Project image must be a valid HTTPS URL."
    });
  }

  try {
    const portfolio = await pool.query(
      "SELECT id FROM portfolios WHERE user_id = $1",
      [req.session.userId]
    );

    if (!portfolio.rows.length) {
      return res.status(404).json({ error: "Portfolio not found." });
    }

    const count = await pool.query(
      "SELECT COUNT(*) FROM projects WHERE portfolio_id = $1",
      [portfolio.rows[0].id]
    );

    if (Number(count.rows[0].count) >= 20) {
      return res.status(400).json({
        error: "You can add up to 20 projects."
      });
    }

    const result = await pool.query(`
      INSERT INTO projects
        (portfolio_id, title, description, category, project_url, image_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      portfolio.rows[0].id,
      title,
      description,
      category,
      projectUrl,
      imageUrl
    ]);

    await pool.query(
      "UPDATE portfolios SET updated_at = NOW() WHERE id = $1",
      [portfolio.rows[0].id]
    );

    res.status(201).json({ project: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Edit one of your projects
app.put("/api/projects/:id", requireAuth, async (req, res, next) => {
  const title = cleanString(req.body.title, 120);
  if (!title) {
    return res.status(400).json({ error: "Project title is required." });
  }

  const projectUrl = req.body.project_url
    ? validUrl(cleanString(req.body.project_url, 1000))
    : null;
  const imageUrl = req.body.image_url
    ? validUrl(cleanString(req.body.image_url, 1000))
    : null;

  if ((req.body.project_url && !projectUrl) ||
      (req.body.image_url && !imageUrl)) {
    return res.status(400).json({ error: "Links must use valid HTTPS URLs." });
  }

  try {
    const result = await pool.query(`
      UPDATE projects pr
      SET title = $1,
          description = $2,
          category = $3,
          project_url = $4,
          image_url = $5
      FROM portfolios p
      WHERE pr.id = $6
        AND pr.portfolio_id = p.id
        AND p.user_id = $7
      RETURNING pr.*
    `, [
      title,
      cleanString(req.body.description, 2000),
      cleanString(req.body.category, 60),
      projectUrl,
      imageUrl,
      req.params.id,
      req.session.userId
    ]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Project not found." });
    }

    res.json({ project: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Delete one of your projects
app.delete("/api/projects/:id", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(`
      DELETE FROM projects pr
      USING portfolios p
      WHERE pr.id = $1
        AND pr.portfolio_id = p.id
        AND p.user_id = $2
      RETURNING pr.id, p.id AS portfolio_id
    `, [req.params.id, req.session.userId]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Project not found." });
    }

    await pool.query(
      "UPDATE portfolios SET updated_at = NOW() WHERE id = $1",
      [result.rows[0].portfolio_id]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Public creator directory: published portfolios only
app.get("/api/creators", async (req, res, next) => {
  const q = cleanString(req.query.q, 100);
  const category = cleanString(req.query.category, 60);

  try {
    const result = await pool.query(`
      SELECT p.slug, p.display_name, p.headline, p.bio,
             p.category, p.skills, p.social_links, p.updated_at,
             u.username
      FROM portfolios p
      JOIN users u ON u.id = p.user_id
      WHERE p.published = TRUE
        AND (
          $1 = ''
          OR p.display_name ILIKE '%' || $1 || '%'
          OR p.headline ILIKE '%' || $1 || '%'
          OR p.bio ILIKE '%' || $1 || '%'
          OR u.username ILIKE '%' || $1 || '%'
          OR EXISTS (
            SELECT 1 FROM unnest(p.skills) AS skill
            WHERE skill ILIKE '%' || $1 || '%'
          )
        )
        AND ($2 = '' OR p.category ILIKE $2)
      ORDER BY p.updated_at DESC
      LIMIT 60
    `, [q, category]);

    res.json({ creators: result.rows });
  } catch (err) {
    next(err);
  }
});

// View a published portfolio by its public slug
app.get("/api/creators/:slug", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT p.*, u.username
      FROM portfolios p
      JOIN users u ON u.id = p.user_id
      WHERE p.slug = $1 AND p.published = TRUE
    `, [req.params.slug.toLowerCase()]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Creator not found." });
    }

    const portfolio = result.rows[0];

    const projects = await pool.query(`
      SELECT id, title, description, category, project_url, image_url
      FROM projects
      WHERE portfolio_id = $1
      ORDER BY sort_order, id
    `, [portfolio.id]);

    res.json({ portfolio: { ...portfolio, projects: projects.rows } });
  } catch (err) {
    next(err);
  }
});

// Only expose the frontend files, not backend configuration
app.use((req, res, next) => {
  const blocked = [
    "/server.js",
    "/package.json",
    "/package-lock.json"
  ];

  if (
    blocked.includes(req.path) ||
    req.path.startsWith("/.git") ||
    req.path.startsWith("/.env")
  ) {
    return res.sendStatus(404);
  }

  next();
});

app.use(express.static(__dirname, {
  index: false,
  dotfiles: "deny"
}));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);

  res.status(500).json({
    error: "Something went wrong. Please try again."
  });
});

const PORT = process.env.PORT || 3000;

initializeDatabase()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Portopedia is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database initialization failed:", err.message);
    process.exit(1);
  });

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

function pathToRegex(pattern) {
  const keys = [];
  const escaped = pattern
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        keys.push(segment.slice(1));
        return "([^/]+)";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${escaped}$`), keys };
}

class Router {
  constructor() {
    this.stack = [];
  }

  _add(method, pattern, handler) {
    const { regex, keys } = pathToRegex(pattern);
    this.stack.push({ type: "route", method, regex, keys, handler });
  }

  get(pattern, handler) {
    this._add("GET", pattern, handler);
  }
  post(pattern, handler) {
    this._add("POST", pattern, handler);
  }
  patch(pattern, handler) {
    this._add("PATCH", pattern, handler);
  }
  delete(pattern, handler) {
    this._add("DELETE", pattern, handler);
  }

  use(fn) {
    this.stack.push({ type: "middleware", fn });
  }

  handle(req, res, subPath) {
    let i = 0;
    const self = this;
    return new Promise((resolve) => {
      function next(err) {
        if (err) {
          sendError(res, err);
          return resolve(true);
        }
        if (i >= self.stack.length) return resolve(false);
        const layer = self.stack[i++];
        if (layer.type === "middleware") {
          try {
            const maybe = layer.fn(req, res, next);
            if (maybe && typeof maybe.catch === "function") maybe.catch(next);
          } catch (e) {
            next(e);
          }
          return;
        }
        if (layer.method !== req.method) return next();
        const m = subPath.match(layer.regex);
        if (!m) return next();
        req.params = {};
        layer.keys.forEach((k, idx) => {
          req.params[k] = decodeURIComponent(m[idx + 1]);
        });
        try {
          const maybe = layer.handler(req, res);
          if (maybe && typeof maybe.catch === "function") maybe.catch(next);
        } catch (e) {
          next(e);
        }
        resolve(true);
      }
      next();
    });
  }
}

function sendError(res, err) {
  console.error(err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Something went wrong on the server." });
  }
}

class App {
  constructor() {
    this.middlewares = [];
    this.mounts = [];
    this.staticDir = null;
  }

  use(a, b) {
    if (typeof a === "function") {
      this.middlewares.push(a);
    } else if (typeof a === "string" && b instanceof Router) {
      this.mounts.push({ prefix: a.replace(/\/$/, ""), router: b });
    } else {
      throw new Error("Unsupported app.use() signature");
    }
  }

  serveStatic(dir) {
    this.staticDir = dir;
  }

  listen(port, cb) {
    const server = http.createServer((req, res) => this._handleRequest(req, res));
    server.listen(port, cb);
    return server;
  }

  async _handleRequest(req, res) {
    decorateResponse(res);
    const url = new URL(req.url, "http://localhost");
    req.query = Object.fromEntries(url.searchParams.entries());
    req.pathname = decodeURIComponent(url.pathname);

    try {
      for (const mw of this.middlewares) {
        await new Promise((resolve, reject) => {
          const maybe = mw(req, res, (err) => {
            if (err) return reject(err);
            resolve();
          });
          if (maybe && typeof maybe.then === "function") maybe.then(resolve, reject);
        });
        if (res.writableEnded) break;
      }
      if (res.writableEnded) return;

      for (const { prefix, router } of this.mounts) {
        if (req.pathname === prefix || req.pathname.startsWith(prefix + "/")) {
          const subPath = req.pathname.slice(prefix.length) || "/";
          const handled = await router.handle(req, res, subPath);
          if (handled || res.writableEnded) return;
        }
      }

      if (this.staticDir) {
        const served = serveStaticFile(this.staticDir, req, res);
        if (served) return;
      }

      res.status(404).json({ error: "Not found" });
    } catch (err) {
      sendError(res, err);
    }
  }
}

function decorateResponse(res) {
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (obj) {
    if (res.writableEnded) return;
    const body = JSON.stringify(obj);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(body);
  };
  res.send = function (bodyOrHtml) {
    if (res.writableEnded) return;
    if (typeof bodyOrHtml === "string") {
      if (!res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
      }
      res.end(bodyOrHtml);
    } else {
      res.end();
    }
  };
  res.cookie = function (name, value, opts = {}) {
    const parts = [`${name}=${value}`];
    parts.push("Path=/");
    parts.push("HttpOnly");
    parts.push("SameSite=Lax");
    if (opts.maxAge) parts.push(`Max-Age=${Math.floor(opts.maxAge / 1000)}`);
    const existing = res.getHeader("Set-Cookie");
    const cookieStr = parts.join("; ");
    if (existing) {
      res.setHeader("Set-Cookie", Array.isArray(existing) ? [...existing, cookieStr] : [existing, cookieStr]);
    } else {
      res.setHeader("Set-Cookie", cookieStr);
    }
  };
  res.clearCookie = function (name) {
    res.cookie(name, "", { maxAge: 0 });
  };
  res.redirect = function (url, status = 302) {
    if (res.writableEnded) return;
    res.statusCode = status;
    res.setHeader("Location", url);
    res.end();
  };
}

function json() {
  return function (req, res, next) {
    if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
      req.body = {};
      return next();
    }
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 5 * 1024 * 1024) {
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        req.body = {};
        return next();
      }
      try {
        req.body = JSON.parse(raw);
      } catch (e) {
        res.status(400).json({ error: "Invalid JSON body." });
        next();
        return;
      }
      next();
    });
    req.on("error", next);
  };
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function session({ cookieName = "sid", maxAge = 1000 * 60 * 60 * 12 } = {}) {
  const store = new Map();

  function sweep() {
    const now = Date.now();
    for (const [sid, entry] of store) {
      if (entry.expiresAt < now) store.delete(sid);
    }
  }

  return function (req, res, next) {
    if (Math.random() < 0.01) sweep();
    const cookies = parseCookies(req.headers.cookie);
    let sid = cookies[cookieName];
    let entry = sid ? store.get(sid) : null;
    if (entry && entry.expiresAt < Date.now()) {
      store.delete(sid);
      entry = null;
    }
    if (!entry) {
      sid = crypto.randomBytes(24).toString("hex");
      entry = { data: {}, expiresAt: Date.now() + maxAge };
      store.set(sid, entry);
      res.cookie(cookieName, sid, { maxAge });
    } else {
      entry.expiresAt = Date.now() + maxAge;
      res.cookie(cookieName, sid, { maxAge });
    }
    req.session = entry.data;
    req.session.destroy = (cb) => {
      store.delete(sid);
      res.clearCookie(cookieName);
      if (cb) cb();
    };
    next();
  };
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function serveStaticFile(rootDir, req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  let rel = req.pathname === "/" ? "/index.html" : req.pathname;
  const resolved = path.normalize(path.join(rootDir, rel));
  if (!resolved.startsWith(rootDir)) {
    res.status(403).end("Forbidden");
    return true;
  }
  let target = resolved;
  if (!fs.existsSync(target)) return false;
  if (fs.statSync(target).isDirectory()) {
    target = path.join(target, "index.html");
    if (!fs.existsSync(target)) return false;
  }
  const ext = path.extname(target);
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  fs.createReadStream(target).pipe(res);
  return true;
}

module.exports = { Router, App: App, createApp: () => new App(), json, session };

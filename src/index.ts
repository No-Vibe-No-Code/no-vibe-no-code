import { workspaceApi } from "./workspace";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PROFILE_IMAGES: R2Bucket;
  INITIAL_LEADER_DISPLAY_NAME?: string;
  INITIAL_LEADER_USERNAME?: string;
  INITIAL_LEADER_PASSWORD?: string;
  COMPETITION_ACTIVE?: string;
}

export const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...(init.headers || {}) },
  });

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const slugify = (value: unknown) => String(value || "").toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56);

async function hashPassword(password: string, salt = crypto.randomUUID()) {
  const bytes = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey("raw", bytes, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100000, hash: "SHA-256" },
    key,
    256,
  );
  return `${salt}.${[...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(".");
  return (await hashPassword(password, salt)).split(".")[1] === expected;
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

async function currentUser(request: Request, env: Env) {
  const sessionId = request.headers.get("Cookie")?.match(/nvnc_session=([^;]+)/)?.[1];
  if (!sessionId) return null;
  return env.DB.prepare(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ? AND u.status = 'active'",
  ).bind(sessionId, now()).first<any>();
}

function validProfile(body: any) {
  return ["displayName", "englishName", "chineseName", "wechatId", "classGrade", "password"].every(
    (field) => typeof body[field] === "string" && body[field].trim(),
  );
}

function sameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

async function ensureInitialLeader(env: Env, body: any) {
  const leaderName = env.INITIAL_LEADER_DISPLAY_NAME || env.INITIAL_LEADER_USERNAME;
  if (!leaderName || !env.INITIAL_LEADER_PASSWORD) return;
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
  if (count?.count) return;
  if (body.displayName?.trim().toLowerCase() !== leaderName.trim().toLowerCase() || body.password !== env.INITIAL_LEADER_PASSWORD) return;
  const timestamp = now();
  const userId = id();
  await env.DB.prepare(
    "INSERT INTO users (id, display_name, english_name, chinese_name, wechat_id, class_grade, role, password_hash, terms_accepted_at, is_initial_leader, public_slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'club-leader', ?, ?, 1, ?, ?, ?)",
  ).bind(userId, body.displayName, body.displayName, body.displayName, "-", "-", await hashPassword(body.password), timestamp, `${slugify(body.displayName) || "member"}-${userId.slice(0, 8)}`, timestamp, timestamp).run();
}

async function legacyApi(request: Request, env: Env) {
  const url = new URL(request.url);
  if (!sameOrigin(request)) return json({ error: "Cross-site request rejected." }, { status: 403 });
  const body = request.method === "POST" || request.method === "PUT" ? await request.json<any>() : {};

  if (url.pathname === "/api/auth/signup" && request.method === "POST") {
    if (!validProfile(body) || body.memberChoice === undefined || body.termsAccepted !== true)
      return json({ error: "Please complete every field and accept the terms." }, { status: 400 });
    if (body.password.length < 8) return json({ error: "Password must be at least 8 characters." }, { status: 400 });
    const timestamp = now();
    const userId = id();
    try {
      await env.DB.prepare(
        "INSERT INTO users (id, display_name, english_name, chinese_name, wechat_id, class_grade, role, password_hash, terms_accepted_at, public_slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(userId, body.displayName.trim(), body.englishName.trim(), body.chineseName.trim(), body.wechatId.trim(), body.classGrade.trim(), body.memberChoice === "member" ? "member" : "non-member", await hashPassword(body.password), timestamp, `${slugify(body.displayName) || "member"}-${userId.slice(0, 8)}`, timestamp, timestamp).run();
    } catch (error) {
      if (String(error).includes("UNIQUE")) return json({ error: "That display name is already taken." }, { status: 409 });
      throw error;
    }
    return json({ ok: true });
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    await ensureInitialLeader(env, body);
    const user = await env.DB.prepare("SELECT * FROM users WHERE display_name = ? COLLATE NOCASE AND status = 'active'").bind(body.displayName?.trim()).first<any>();
    if (!user || !(await verifyPassword(body.password || "", user.password_hash)))
      return json({ error: "Display name or password is incorrect." }, { status: 401 });
    const sessionId = id();
    await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").bind(sessionId, user.id, new Date(Date.now() + 2592000000).toISOString()).run();
    return json({ ok: true, user: { displayName: user.display_name, role: user.role } }, { headers: { "set-cookie": cookie("nvnc_session", sessionId, 2592000) } });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const sessionId = request.headers.get("Cookie")?.match(/nvnc_session=([^;]+)/)?.[1];
    if (sessionId) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
    return json({ ok: true }, { headers: { "set-cookie": cookie("nvnc_session", "", 0) } });
  }

  if (url.pathname === "/api/contact" && request.method === "POST") {
    if (!body.name?.trim() || !body.wechatId?.trim() || !body.message?.trim()) return json({ error: "Please complete the contact form." }, { status: 400 });
    await env.DB.prepare("INSERT INTO contacts (id, name, wechat_id, message, created_at) VALUES (?, ?, ?, ?, ?)").bind(id(), body.name.trim(), body.wechatId.trim(), body.message.trim(), now()).run();
    return json({ ok: true });
  }

  const user = await currentUser(request, env);
  if (url.pathname === "/api/profile" && request.method === "DELETE") {
    if (!user) return json({ error: "Please sign in." }, { status: 401 });
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id).run();
    return json({ ok: true }, { headers: { "set-cookie": cookie("nvnc_session", "", 0) } });
  }

  if (url.pathname.startsWith("/api/admin/users/") && url.pathname.endsWith("/password") && request.method === "PUT") {
    if (!user || !["club-leader", "teacher"].includes(user.role)) return json({ error: "Only club leaders and teachers can reset passwords." }, { status: 403 });
    if (typeof body.password !== "string" || body.password.length < 8) return json({ error: "Password must be at least 8 characters." }, { status: 400 });
    const targetId = url.pathname.split("/").at(-2);
    const timestamp = now();
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").bind(await hashPassword(body.password), timestamp, targetId),
      env.DB.prepare("INSERT INTO admin_audit_log (id,actor_user_id,action,target_type,target_id,created_at) VALUES (?,?,'user.password-reset','user',?,?)").bind(id(), user.id, targetId, timestamp),
    ]);
    return json({ ok: true });
  }

  if (url.pathname === "/api/profile-image" && request.method === "POST") {
    if (!user) return json({ error: "Please sign in." }, { status: 401 });
    const match = String(body.dataUrl || "").match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!match) return json({ error: "Please upload a PNG, JPG, or WebP image." }, { status: 400 });
    const data = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
    if (data.byteLength > 2_000_000) return json({ error: "Profile images must be under 2 MB." }, { status: 400 });
    const key = `profiles/${user.id}`;
    await env.PROFILE_IMAGES.put(key, data, { httpMetadata: { contentType: match[1] } });
    await env.DB.prepare("UPDATE users SET profile_image_key = ?, updated_at = ? WHERE id = ?").bind(key, now(), user.id).run();
    return json({ ok: true });
  }

  if (url.pathname.startsWith("/api/profile-image/") && request.method === "GET") {
    const requestedId = url.pathname.split("/").pop();
    const profile = await env.DB.prepare("SELECT profile_image_key FROM users WHERE id = ?").bind(requestedId).first<{ profile_image_key: string }>();
    if (!profile?.profile_image_key) return new Response("Not found", { status: 404 });
    const image = await env.PROFILE_IMAGES.get(profile.profile_image_key);
    if (!image) return new Response("Not found", { status: 404 });
    return new Response(image.body, { headers: { "content-type": image.httpMetadata?.contentType || "image/jpeg", "cache-control": "public, max-age=3600" } });
  }

  if (url.pathname === "/api/admin/contacts" && request.method === "GET") {
    if (!user || !["club-leader", "teacher", "maintainer"].includes(user.role)) return json({ error: "Not authorized." }, { status: 403 });
    return json({ contacts: await env.DB.prepare("SELECT id, name, wechat_id, message, created_at, status FROM contacts ORDER BY created_at DESC LIMIT 100").all() });
  }

  if (url.pathname === "/api/admin/users" && request.method === "GET") {
    if (!user || !["club-leader", "teacher", "maintainer"].includes(user.role)) return json({ error: "Not authorized." }, { status: 403 });
    return json({ users: await env.DB.prepare("SELECT id, display_name, english_name, chinese_name, class_grade, role, status, public_slug, created_at FROM users ORDER BY created_at DESC LIMIT 500").all() });
  }

  if (/^\/api\/admin\/users\/[^/]+$/.test(url.pathname) && request.method === "PUT") {
    const targetId = url.pathname.split("/").pop();
    const target = await env.DB.prepare("SELECT role,status,is_initial_leader FROM users WHERE id=?").bind(targetId).first<any>();
    if (!target) return json({ error: "Member not found." }, { status: 404 });
    const timestamp = now();
    if (body.role !== undefined) {
      if (!user?.is_initial_leader) return json({ error: "Only the initial club leader can promote roles." }, { status: 403 });
      if (!["non-member", "member", "maintainer", "club-leader", "teacher"].includes(body.role)) return json({ error: "Invalid role." }, { status: 400 });
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET role=?,updated_at=? WHERE id=?").bind(body.role,timestamp,targetId),
        env.DB.prepare("INSERT INTO admin_audit_log (id,actor_user_id,action,target_type,target_id,details_json,created_at) VALUES (?,?,'user.role','user',?,?,?)").bind(id(),user.id,targetId,JSON.stringify({before:target.role,after:body.role}),timestamp),
      ]);
    } else if (body.status !== undefined) {
      if (!user || !["club-leader", "teacher"].includes(user.role)) return json({ error: "Only club leaders and teachers can change account status." }, { status: 403 });
      if (!["active","suspended","archived"].includes(body.status)) return json({ error: "Invalid account status." }, { status: 400 });
      if (target.is_initial_leader || targetId === user.id) return json({ error: "This account cannot be suspended here." }, { status: 400 });
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET status=?,updated_at=? WHERE id=?").bind(body.status,timestamp,targetId),
        env.DB.prepare("INSERT INTO admin_audit_log (id,actor_user_id,action,target_type,target_id,details_json,created_at) VALUES (?,?,'user.status','user',?,?,?)").bind(id(),user.id,targetId,JSON.stringify({before:target.status,after:body.status}),timestamp),
      ]);
    } else return json({ error: "Role or status is required." }, { status: 400 });
    return json({ ok: true });
  }

  if (url.pathname === "/api/site-status" && request.method === "GET") {
    const setting = await env.DB.prepare("SELECT value FROM site_settings WHERE key = 'competition_active'").first<{ value: string }>();
    return json({ competitionActive: (setting?.value || env.COMPETITION_ACTIVE || "false") === "true" });
  }

  if (url.pathname === "/api/site-status" && request.method === "PUT") {
    if (!user?.is_initial_leader) return json({ error: "Only the initial club leader can activate competition actions." }, { status: 403 });
    await env.DB.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('competition_active', ?)").bind(body.competitionActive === true ? "true" : "false").run();
    return json({ ok: true });
  }

  return json({ error: "Not found." }, { status: 404 });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        const workspaceResponse = await workspaceApi(request, env);
        return workspaceResponse || await legacyApi(request, env);
      } catch (error) {
        console.error(error);
        return json({ error: "Something went wrong. Please try again." }, { status: 500 });
      }
    }
    return env.ASSETS.fetch(request);
  },
};

import type { Env } from "./index";
import { cookie, csrfValid, json, readCookie, withinRateLimit } from "./index";
import { fetchGithubSnapshot, parseGithubProfileUrl } from "./github";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const staffRoles = ["maintainer", "club-leader", "teacher"];
const leaderRoles = ["club-leader", "teacher"];
const slugify = (value: unknown) => String(value || "").toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56);
const parsed = (value: unknown, fallback: unknown) => {
  try { return JSON.parse(String(value)); } catch { return fallback; }
};
const isUrl = (value: unknown) => !value || (typeof value === "string" && value.length <= 500 && /^https?:\/\//i.test(value));
const limitOf = (url: URL) => Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
const GITHUB_REFRESH_MS = 10 * 60 * 1000;
const enabled = (value: unknown) => [true, "true", 1, "1"].includes(value as never);
const voteVariants = [
  { slug: "skyline-ribbon", name: "Skyline Ribbon", description: "A crisp diagonal sweep with a bright, welcoming club signal.", palette: "Powder blue · sky blue · royal blue" },
  { slug: "blueberry-window", name: "Blueberry Window", description: "A soft cloud window that lets the mascot peek into your next idea.", palette: "Icy blue · cobalt · white" },
  { slug: "blueprint-paws", name: "Blueprint Paws", description: "A technical sketchbook look for people who like to see how things work.", palette: "Blueprint blue · white · soft blue" },
  { slug: "cloud-cat", name: "Cloud Cat", description: "An airy, gentle card that feels like a tiny piece of the club sky.", palette: "Baby blue · sky blue · deep blue" },
  { slug: "after-school-club", name: "After-School Club", description: "Notebook doodles, laptop energy, and a little more personality.", palette: "White · light blue · royal blue" },
] as const;
const voteVariantSlugs = new Set<string>(voteVariants.map((variant) => variant.slug));

async function hashNfcToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashVoteValue(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function voteIdentity(request: Request, browserSignal = "") {
  let deviceCookie = readCookie(request, "nvnc_vote_device");
  const issued = !/^[A-Za-z0-9-]{20,100}$/.test(deviceCookie);
  if (issued) deviceCookie = crypto.randomUUID();
  const browserHeaders = [
    request.headers.get("user-agent"),
    request.headers.get("accept-language"),
    request.headers.get("sec-ch-ua"),
    request.headers.get("sec-ch-ua-platform"),
    request.headers.get("sec-ch-ua-mobile"),
  ].map((value) => String(value || "").slice(0, 240)).join("\u001f");
  const signal = String(browserSignal || "").trim().slice(0, 1200);
  return {
    cookieHash: await hashVoteValue(deviceCookie),
    fingerprintHash: await hashVoteValue(`${browserHeaders}\u001e${signal}`),
    setCookie: issued ? cookie("nvnc_vote_device", deviceCookie, 31536000) : "",
  };
}

function createNfcToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function userFor(request: Request, env: Env) {
  const sessionId = request.headers.get("Cookie")?.match(/nvnc_session=([^;]+)/)?.[1];
  if (!sessionId) return null;
  return env.DB.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ? AND u.status = 'active'")
    .bind(sessionId, now()).first<any>();
}

function sameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

function publicGithub(user: any, includeReadme = false) {
  if (!user.github_profile_url) return null;
  return {
    profileUrl: user.github_profile_url,
    username: user.github_username || parseGithubProfileUrl(user.github_profile_url)?.username || "",
    name: user.github_name || "",
    bio: user.github_bio || "",
    avatarUrl: user.github_avatar_url || null,
    enabled: Boolean(user.github_readme_enabled),
    readmeHtml: includeReadme && user.github_readme_enabled ? user.github_readme_html || "" : "",
    syncedAt: user.github_synced_at || null,
  };
}

function publicContacts(user: any) {
  const privacy = parsed(user.privacy_json, {}) as any;
  return {
    wechatId: enabled(privacy.wechatPublic) ? user.wechat_id || null : null,
    email: enabled(privacy.emailPublic) ? user.email || null : null,
  };
}

function publicUser(user: any, includeGithubReadme = false, teams: any[] = []) {
  return {
    displayName: user.display_name,
    slug: user.public_slug,
    bio: user.bio || user.github_bio || "",
    skills: parsed(user.skills_json, []),
    links: parsed(user.links_json, []),
    readme: user.readme_published,
    profileImageUrl: user.profile_image_key ? `/api/profile-image/${user.id}` : user.github_avatar_url || null,
    github: publicGithub(user, includeGithubReadme),
    contacts: publicContacts(user),
    teams: teams.map((team) => ({ slug: team.slug, name: team.name, role: team.role })),
    joinedAt: user.created_at,
  };
}

async function saveGithubError(env: Env, user: any, error: unknown) {
  const syncedAt = now();
  const message = String(error instanceof Error ? error.message : error || "GitHub sync failed.").slice(0, 240);
  await env.DB.prepare("UPDATE users SET github_synced_at=?, github_sync_error=? WHERE id=?").bind(syncedAt, message, user.id).run();
  return { ...user, github_synced_at: syncedAt, github_sync_error: message };
}

async function syncGithubProfile(env: Env, user: any) {
  const snapshot = await fetchGithubSnapshot(user.github_profile_url, {
    etag: user.github_readme_etag || "",
    html: user.github_readme_html || "",
    defaultBranch: user.github_default_branch || "",
    avatarUrl: user.github_avatar_url || "",
    name: user.github_name || "",
    bio: user.github_bio || "",
  });
  await env.DB.prepare("UPDATE users SET github_profile_url=?, github_username=?, github_default_branch=?, github_readme_etag=?, github_readme_html=?, github_avatar_url=?, github_name=?, github_bio=?, github_synced_at=?, github_sync_error='' WHERE id=?")
    .bind(snapshot.profileUrl, snapshot.username, snapshot.defaultBranch, snapshot.etag, snapshot.html, snapshot.avatarUrl || null, snapshot.name, snapshot.bio, snapshot.syncedAt, user.id).run();
  return {
    ...user,
    github_profile_url: snapshot.profileUrl,
    github_username: snapshot.username,
    github_default_branch: snapshot.defaultBranch,
    github_readme_etag: snapshot.etag,
    github_readme_html: snapshot.html,
    github_avatar_url: snapshot.avatarUrl || null,
    github_name: snapshot.name,
    github_bio: snapshot.bio,
    github_synced_at: snapshot.syncedAt,
    github_sync_error: "",
  };
}

async function refreshGithubIfStale(env: Env, user: any) {
  if (!user.github_profile_url || !user.github_readme_enabled) return user;
  const lastSync = Date.parse(user.github_synced_at || "");
  if (Number.isFinite(lastSync) && Date.now() - lastSync < GITHUB_REFRESH_MS) return user;
  try {
    return await syncGithubProfile(env, user);
  } catch (error) {
    return saveGithubError(env, user, error);
  }
}

export async function workspaceApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const handled = path === "/api/me" || path === "/api/profile" || path === "/api/profile/github/sync" || path.startsWith("/api/profile/readme/") ||
    path === "/api/members" || path.startsWith("/api/members/") || path.startsWith("/api/projects") || path.startsWith("/api/teams") ||
    path.startsWith("/api/team-invitations/") || path.startsWith("/api/notifications") ||
    path === "/api/vote" || path === "/api/vote/results" ||
    path.startsWith("/api/nfc/") || path === "/api/admin/nfc-cards" ||
    path.startsWith("/api/admin/overview") || path.startsWith("/api/admin/forms") ||
    path.startsWith("/api/forms/") || path.startsWith("/api/admin/broadcasts") ||
    path.startsWith("/api/admin/projects/");
  if (!handled) return null;
  if (!sameOrigin(request)) return json({ error: "Cross-site request rejected." }, { status: 403 });
  if (!csrfValid(request)) return json({ error: "Security check failed. Refresh the page and try again." }, { status: 403 });
  const user = await userFor(request, env);
  const body = ["POST", "PUT"].includes(request.method) ? await request.clone().json<any>() : {};

  if (path === "/api/vote/results" && request.method === "GET") {
    const identity = await voteIdentity(request, request.headers.get("x-device-fingerprint") || "");
    const [counts, existing] = await Promise.all([
      env.DB.prepare("SELECT variant_slug, COUNT(*) AS count FROM design_votes GROUP BY variant_slug").all<any>(),
      env.DB.prepare("SELECT variant_slug FROM design_votes WHERE voter_cookie_hash=? OR device_fingerprint_hash=? LIMIT 1").bind(identity.cookieHash, identity.fingerprintHash).first<any>(),
    ]);
    const countMap = new Map(counts.results.map((row: any) => [row.variant_slug, Number(row.count) || 0]));
    const variants = voteVariants.map((variant) => ({ ...variant, votes: countMap.get(variant.slug) || 0 }));
    return json({ variants, total: variants.reduce((sum, variant) => sum + variant.votes, 0), hasVoted: Boolean(existing), votedVariant: existing?.variant_slug || null }, {
      headers: identity.setCookie ? { "set-cookie": identity.setCookie } : {},
    });
  }

  if (path === "/api/vote" && request.method === "POST") {
    if (!withinRateLimit(request, "design-vote", 8, 3600000)) return json({ error: "Too many voting attempts. Please try again later." }, { status: 429, headers: { "retry-after": "3600" } });
    const variant = String(body.variant || "").trim();
    if (!voteVariantSlugs.has(variant)) return json({ error: "Choose one of the five card concepts." }, { status: 400 });
    const identity = await voteIdentity(request, typeof body.deviceFingerprint === "string" ? body.deviceFingerprint : request.headers.get("x-device-fingerprint") || "");
    try {
      await env.DB.prepare("INSERT INTO design_votes (id,variant_slug,voter_cookie_hash,device_fingerprint_hash,created_at) VALUES (?,?,?,?,?)")
        .bind(id(), variant, identity.cookieHash, identity.fingerprintHash, now()).run();
    } catch (error) {
      if (String(error).includes("UNIQUE")) return json({ error: "You have already voted from this browser or device." }, { status: 409 });
      throw error;
    }
    return json({ ok: true, variant }, { status: 201, headers: identity.setCookie ? { "set-cookie": identity.setCookie } : {} });
  }

  if (path === "/api/me" && request.method === "GET") {
    return json({ user: user ? {
      ...user,
      skills: parsed(user.skills_json, []),
      links: parsed(user.links_json, []),
      privacy: parsed(user.privacy_json, {}),
      profileImageUrl: user.profile_image_key ? `/api/profile-image/${user.id}` : null,
      github: publicGithub(user),
    } : null });
  }

  if (path === "/api/profile" && request.method === "PUT") {
    if (!user) return json({ error: "Please sign in." }, { status: 401 });
    if (!body.englishName?.trim() || !body.chineseName?.trim() || !body.wechatId?.trim() || !body.classGrade?.trim()) return json({ error: "Please complete your profile." }, { status: 400 });
    const email = body.email === undefined ? String(user.email || "") : String(body.email || "").trim();
    if (email && (email.length > 240 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return json({ error: "Enter a valid email address or leave it blank." }, { status: 400 });
    const requestedGithubUrl = body.githubProfileUrl === undefined ? String(user.github_profile_url || "") : String(body.githubProfileUrl || "").trim();
    const githubRef = requestedGithubUrl ? parseGithubProfileUrl(requestedGithubUrl) : null;
    if (requestedGithubUrl && !githubRef) return json({ error: "Use a public GitHub profile URL such as https://github.com/UnoxyRich." }, { status: 400 });
    const githubReadmeEnabled = body.githubReadmeEnabled === undefined
      ? Number(user.github_readme_enabled || 0)
      : [true, "true", 1, "1"].includes(body.githubReadmeEnabled) ? 1 : 0;
    if (githubReadmeEnabled && !githubRef) return json({ error: "Add a GitHub profile URL before using its profile README." }, { status: 400 });
    const canonicalGithubUrl = githubRef?.profileUrl || "";
    const githubChanged = canonicalGithubUrl !== String(user.github_profile_url || "");
    const skills = Array.isArray(body.skills) ? body.skills.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 30) : parsed(user.skills_json, []);
    const links = Array.isArray(body.links) ? body.links.filter((item: any) => item && typeof item.label === "string" && isUrl(item.url)).slice(0, 10) : parsed(user.links_json, []);
    const previousPrivacy = parsed(user.privacy_json, {}) as any;
    const requestedPrivacy = body.privacy && typeof body.privacy === "object" ? body.privacy : previousPrivacy;
    const privacy = { ...previousPrivacy, wechatPublic: enabled(requestedPrivacy.wechatPublic), emailPublic: enabled(requestedPrivacy.emailPublic) };
    await env.DB.prepare("UPDATE users SET english_name=?, chinese_name=?, wechat_id=?, email=?, class_grade=?, bio=?, skills_json=?, links_json=?, readme_draft=?, privacy_json=?, github_profile_url=?, github_readme_enabled=?, github_username=?, github_default_branch=?, github_readme_etag=?, github_readme_html=?, github_avatar_url=?, github_name=?, github_bio=?, github_synced_at=?, github_sync_error=?, updated_at=? WHERE id=?")
      .bind(body.englishName.trim(), body.chineseName.trim(), body.wechatId.trim(), email, body.classGrade.trim(), String(body.bio || "").trim().slice(0, 500), JSON.stringify(skills), JSON.stringify(links), String(body.readmeDraft ?? user.readme_draft).slice(0, 20000), JSON.stringify(privacy), canonicalGithubUrl || null, githubReadmeEnabled, githubChanged ? null : user.github_username || null, githubChanged ? null : user.github_default_branch || null, githubChanged ? "" : user.github_readme_etag || "", githubChanged ? "" : user.github_readme_html || "", githubChanged ? null : user.github_avatar_url || null, githubChanged ? "" : user.github_name || "", githubChanged ? "" : user.github_bio || "", githubChanged ? null : user.github_synced_at || null, githubChanged ? "" : user.github_sync_error || "", now(), user.id).run();
    return json({ ok: true });
  }

  if (path === "/api/profile/github/sync" && request.method === "POST") {
    if (!user) return json({ error: "Please sign in." }, { status: 401 });
    if (!user.github_profile_url || !user.github_readme_enabled) return json({ error: "Save a GitHub profile URL and enable the README mirror first." }, { status: 400 });
    try {
      const synced = await syncGithubProfile(env, user);
      return json({ ok: true, github: publicGithub(synced, true) });
    } catch (error) {
      await saveGithubError(env, user, error);
      return json({ error: String(error instanceof Error ? error.message : "GitHub sync failed.") }, { status: 502 });
    }
  }

  if (path === "/api/profile/readme/publish" && request.method === "POST") {
    if (!user) return json({ error: "Please sign in." }, { status: 401 });
    await env.DB.prepare("UPDATE users SET readme_published=readme_draft, updated_at=? WHERE id=?").bind(now(), user.id).run();
    return json({ ok: true });
  }

  if (path === "/api/admin/nfc-cards" && request.method === "GET") {
    if (!user || !staffRoles.includes(user.role)) return json({ error: "Not authorized." }, { status: 403 });
    const cards = await env.DB.prepare("SELECT c.label,c.status,c.claimed_at,c.scan_count,c.last_scanned_at,u.display_name,u.public_slug FROM nfc_cards c LEFT JOIN users u ON u.id=c.claimed_by_user_id ORDER BY c.created_at ASC LIMIT 500").all<any>();
    return json({ cards: cards.results.map((card: any) => ({ ...card, profileUrl: card.public_slug ? `/user/${encodeURIComponent(card.public_slug)}` : null })) });
  }

  if (path === "/api/admin/nfc-cards" && request.method === "POST") {
    if (!user || !leaderRoles.includes(user.role)) return json({ error: "Only club leaders and teachers can create NFC cards." }, { status: 403 });
    const count = Math.min(200, Math.max(1, Number(body.count) || 1));
    const timestamp = now();
    const cards: Array<{ label: string; url: string }> = [];
    const statements: D1PreparedStatement[] = [];
    for (let index = 0; index < count; index += 1) {
      const token = createNfcToken();
      const label = `NFC-${timestamp.replace(/\D/g, "").slice(-10)}-${String(index + 1).padStart(3, "0")}`;
      cards.push({ label, url: `${new URL(request.url).origin}/nfc/${token}` });
      statements.push(env.DB.prepare("INSERT INTO nfc_cards (id,label,token_hash,created_at,updated_at) VALUES (?,?,?,?,?)").bind(id(), label, await hashNfcToken(token), timestamp, timestamp));
    }
    await env.DB.batch(statements);
    return json({ ok: true, cards }, { status: 201 });
  }

  const nfcCard = path.match(/^\/api\/nfc\/cards\/([^/]+)$/);
  if (nfcCard && request.method === "GET") {
    const tokenHash = await hashNfcToken(decodeURIComponent(nfcCard[1]));
    const card = await env.DB.prepare("SELECT c.*,u.display_name,u.public_slug FROM nfc_cards c LEFT JOIN users u ON u.id=c.claimed_by_user_id WHERE c.token_hash=?").bind(tokenHash).first<any>();
    if (!card) return json({ error: "NFC card not found." }, { status: 404 });
    const timestamp = now();
    await env.DB.prepare("UPDATE nfc_cards SET scan_count=scan_count+1,last_scanned_at=?,updated_at=? WHERE id=?").bind(timestamp, timestamp, card.id).run();
    if (card.status === "disabled") return json({ status: "disabled", label: card.label });
    if (!card.claimed_by_user_id || !card.public_slug) {
      if (card.status !== "unclaimed") await env.DB.prepare("UPDATE nfc_cards SET status='unclaimed',claimed_at=NULL,updated_at=? WHERE id=? AND claimed_by_user_id IS NULL").bind(timestamp, card.id).run();
      return json({ status: "available", label: card.label });
    }
    return json({ status: "claimed", profileUrl: `/user/${encodeURIComponent(card.public_slug)}` });
  }

  const nfcClaim = path.match(/^\/api\/nfc\/cards\/([^/]+)\/claim$/);
  if (nfcClaim && request.method === "POST") {
    if (!user) return json({ error: "Please sign in before binding this card." }, { status: 401 });
    const tokenHash = await hashNfcToken(decodeURIComponent(nfcClaim[1]));
    const card = await env.DB.prepare("SELECT * FROM nfc_cards WHERE token_hash=?").bind(tokenHash).first<any>();
    if (!card) return json({ error: "NFC card not found." }, { status: 404 });
    if (card.status === "disabled") return json({ error: "This card has been disabled." }, { status: 410 });
    if (card.claimed_by_user_id === user.id) return json({ ok: true, profileUrl: `/user/${encodeURIComponent(user.public_slug)}` });
    if (card.claimed_by_user_id) return json({ error: "This card is already bound to another profile." }, { status: 409 });
    const timestamp = now();
    const updated = await env.DB.prepare("UPDATE nfc_cards SET status='claimed',claimed_by_user_id=?,claimed_at=?,updated_at=? WHERE id=? AND status IN ('unclaimed','claimed') AND claimed_by_user_id IS NULL").bind(user.id, timestamp, timestamp, card.id).run();
    if (!Number((updated as any).meta?.changes || 0)) return json({ error: "This card was just claimed by another profile." }, { status: 409 });
    return json({ ok: true, profileUrl: `/user/${encodeURIComponent(user.public_slug)}` });
  }

  if (path === "/api/members" && request.method === "GET") {
    const search = String(url.searchParams.get("q") || "").trim().slice(0, 80);
    const limit = limitOf(url);
    const result = search
      ? await env.DB.prepare("SELECT * FROM users WHERE status='active' AND (display_name LIKE ? COLLATE NOCASE OR bio LIKE ?) ORDER BY created_at ASC LIMIT ?").bind(`%${search}%`, `%${search}%`, limit).all<any>()
      : await env.DB.prepare("SELECT * FROM users WHERE status='active' ORDER BY created_at ASC LIMIT ?").bind(limit).all<any>();
    return json({ members: result.results.map(publicUser) });
  }

  if (path.startsWith("/api/members/") && request.method === "GET") {
    const slug = decodeURIComponent(path.slice(13));
    const member = await env.DB.prepare("SELECT * FROM users WHERE (public_slug=? OR display_name=? COLLATE NOCASE) AND status='active'").bind(slug, slug).first<any>();
    if (!member) return json({ error: "Member not found." }, { status: 404 });
    const freshMember = await refreshGithubIfStale(env, member);
    const projects = await env.DB.prepare("SELECT id,slug,title,summary,status,published_at FROM projects WHERE owner_user_id=? AND status='published' AND visibility='public' ORDER BY published_at DESC LIMIT 30").bind(member.id).all<any>();
    const teams = await env.DB.prepare("SELECT t.slug,t.name,tm.role FROM team_members tm JOIN teams t ON t.id=tm.team_id WHERE tm.user_id=? AND tm.status='active' AND t.status='active' ORDER BY t.updated_at DESC LIMIT 20").bind(member.id).all<any>();
    return json({ member: publicUser(freshMember, true, teams.results), projects: projects.results });
  }

  if (path === "/api/projects" && request.method === "GET") {
    const limit = limitOf(url);
    const mine = url.searchParams.get("mine") === "1";
    if (mine && !user) return json({ error: "Please sign in." }, { status: 401 });
    const where: string[] = [];
    const values: unknown[] = [];
    if (mine) { where.push("p.owner_user_id=?"); values.push(user.id); }
    else if (!user) where.push("p.status='published'", "p.visibility='public'");
    else if (!staffRoles.includes(user.role)) { where.push("(p.visibility!='private' OR p.owner_user_id=?)"); values.push(user.id); }
    else where.push("1=1");
    const status = url.searchParams.get("status");
    if (status && ["draft","submitted","changes-requested","approved","published","archived"].includes(status)) { where.push("p.status=?"); values.push(status); }
    const cursor = url.searchParams.get("cursor");
    if (cursor) { where.push("p.updated_at<?"); values.push(cursor); }
    values.push(limit + 1);
    const result = await env.DB.prepare(`SELECT p.*,u.display_name owner_name,u.public_slug owner_slug FROM projects p JOIN users u ON u.id=p.owner_user_id WHERE ${where.join(" AND ")} ORDER BY p.updated_at DESC LIMIT ?`).bind(...values).all<any>();
    const projects = result.results.slice(0, limit);
    return json({ projects, nextCursor: result.results.length > limit ? projects.at(-1)?.updated_at : null });
  }

  if (path === "/api/projects" && request.method === "POST") {
    if (!user) return json({ error: "Please sign in." }, { status: 401 });
    const title = String(body.title || "").trim().slice(0, 100);
    if (!title) return json({ error: "Project title is required." }, { status: 400 });
    const projectId = id(), timestamp = now(), slug = `${slugify(title) || "project"}-${projectId.slice(0,8)}`;
    const visibility = ["public","members","private"].includes(body.visibility) ? body.visibility : "private";
    await env.DB.prepare("INSERT INTO projects (id,owner_user_id,slug,title,summary,status,visibility,created_at,updated_at) VALUES (?,?,?,?,?,'draft',?,?,?)")
      .bind(projectId,user.id,slug,title,String(body.summary||"").trim().slice(0,300),visibility,timestamp,timestamp).run();
    return json({ ok:true, project:{ id:projectId, slug } }, { status:201 });
  }

  const project = path.match(/^\/api\/projects\/([^/]+)$/);
  if (project && request.method === "GET") {
    const item = await env.DB.prepare("SELECT p.*,u.display_name owner_name,u.public_slug owner_slug FROM projects p JOIN users u ON u.id=p.owner_user_id WHERE p.id=? OR p.slug=?").bind(project[1],project[1]).first<any>();
    if (!item || (item.visibility === "private" && item.owner_user_id !== user?.id && !staffRoles.includes(user?.role))) return json({ error:"Project not found." }, { status:404 });
    if (item.visibility === "members" && !user) return json({ error:"Please sign in." }, { status:401 });
    return json({ project:item });
  }
  if (project && request.method === "PUT") {
    if (!user) return json({ error:"Please sign in." }, { status:401 });
    const item = await env.DB.prepare("SELECT * FROM projects WHERE id=?").bind(project[1]).first<any>();
    if (!item || (item.owner_user_id !== user.id && !staffRoles.includes(user.role))) return json({ error:"Project not found." }, { status:404 });
    if (!isUrl(body.demoUrl) || !isUrl(body.sourceUrl)) return json({ error:"Project URLs must begin with http:// or https://." }, { status:400 });
    await env.DB.prepare("UPDATE projects SET title=?,summary=?,content_markdown=?,demo_url=?,source_url=?,visibility=?,updated_at=? WHERE id=?")
      .bind(String(body.title||item.title).trim().slice(0,100),String(body.summary??item.summary).slice(0,300),String(body.contentMarkdown??item.content_markdown).slice(0,50000),body.demoUrl||null,body.sourceUrl||null,["public","members","private"].includes(body.visibility)?body.visibility:item.visibility,now(),item.id).run();
    return json({ ok:true });
  }

  const submit = path.match(/^\/api\/projects\/([^/]+)\/submit$/);
  if (submit && request.method === "POST") {
    if (!user) return json({ error:"Please sign in." }, { status:401 });
    const item = await env.DB.prepare("SELECT * FROM projects WHERE id=? AND owner_user_id=?").bind(submit[1],user.id).first<any>();
    if (!item) return json({ error:"Project not found." }, { status:404 });
    if (!["draft","changes-requested"].includes(item.status)) return json({ error:"This project cannot be submitted now." }, { status:409 });
    const timestamp=now(); await env.DB.prepare("UPDATE projects SET status='submitted',submitted_at=?,updated_at=? WHERE id=?").bind(timestamp,timestamp,item.id).run();
    return json({ ok:true });
  }

  if (path === "/api/teams" && request.method === "GET") {
    if (!user) return json({ error:"Please sign in." }, { status:401 });
    const teams=await env.DB.prepare("SELECT t.id,t.slug,t.name,t.description,tm.role FROM team_members tm JOIN teams t ON t.id=tm.team_id WHERE tm.user_id=? AND tm.status='active' AND t.status='active' ORDER BY t.updated_at DESC LIMIT 50").bind(user.id).all<any>();
    const invitations=await env.DB.prepare("SELECT i.id,i.team_id,t.name team_name,u.display_name inviter_name,i.message,i.expires_at FROM team_invitations i JOIN teams t ON t.id=i.team_id JOIN users u ON u.id=i.invited_by_user_id WHERE i.invited_user_id=? AND i.status='pending' AND i.expires_at>? ORDER BY i.created_at DESC LIMIT 30").bind(user.id,now()).all<any>();
    return json({ teams:teams.results, invitations:invitations.results });
  }
  if (path === "/api/teams" && request.method === "POST") {
    if (!user) return json({ error:"Please sign in." }, { status:401 });
    const name=String(body.name||"").trim().slice(0,80); if(!name)return json({error:"Team name is required."},{status:400});
    const teamId=id(),timestamp=now(),slug=`${slugify(name)||"team"}-${teamId.slice(0,8)}`;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO teams (id,slug,name,description,owner_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(teamId,slug,name,String(body.description||"").slice(0,300),user.id,timestamp,timestamp),
      env.DB.prepare("INSERT INTO team_members (id,team_id,user_id,role,status,joined_at,updated_at) VALUES (?,?,?,'owner','active',?,?)").bind(id(),teamId,user.id,timestamp,timestamp),
    ]);
    return json({ok:true,team:{id:teamId,slug}},{status:201});
  }

  const team = path.match(/^\/api\/teams\/([^/]+)$/);
  if (team && request.method === "GET") {
    if (!user) return json({ error:"Please sign in." }, { status:401 });
    const item = await env.DB.prepare("SELECT * FROM teams WHERE id=? OR slug=?").bind(team[1],team[1]).first<any>();
    if (!item) return json({ error:"Team not found." }, { status:404 });
    const membership = await env.DB.prepare("SELECT role FROM team_members WHERE team_id=? AND user_id=? AND status='active'").bind(item.id,user.id).first<any>();
    if (!membership && !staffRoles.includes(user.role)) return json({ error:"Team not found." }, { status:404 });
    const members = await env.DB.prepare("SELECT u.id,u.display_name,u.public_slug,tm.role FROM team_members tm JOIN users u ON u.id=tm.user_id WHERE tm.team_id=? AND tm.status='active' ORDER BY tm.joined_at").bind(item.id).all<any>();
    return json({ team:item, members:members.results, viewerRole:membership?.role || "staff" });
  }

  const teamInvitations = path.match(/^\/api\/teams\/([^/]+)\/invitations$/);
  if (teamInvitations && request.method === "POST") {
    if (!user) return json({ error:"Please sign in." }, { status:401 });
    const membership = await env.DB.prepare("SELECT role FROM team_members WHERE team_id=? AND user_id=? AND status='active'").bind(teamInvitations[1],user.id).first<any>();
    if (!membership || !["owner","admin"].includes(membership.role)) return json({ error:"Only team owners and admins can invite members." }, { status:403 });
    const invited = await env.DB.prepare("SELECT id FROM users WHERE display_name=? COLLATE NOCASE AND status='active'").bind(String(body.displayName||"").trim()).first<any>();
    if (!invited || invited.id === user.id) return json({ error:"That member cannot be invited." }, { status:400 });
    const inviteId=id(),timestamp=now(),expiresAt=new Date(Date.now()+604800000).toISOString();
    const item=await env.DB.prepare("SELECT name FROM teams WHERE id=?").bind(teamInvitations[1]).first<any>();
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO team_invitations (id,team_id,invited_user_id,invited_by_user_id,role,status,message,expires_at,created_at,updated_at) VALUES (?,?,?,?,'member','pending',?,?,?,?)").bind(inviteId,teamInvitations[1],invited.id,user.id,String(body.message||"").slice(0,300),expiresAt,timestamp,timestamp),
        env.DB.prepare("INSERT INTO notifications (id,recipient_user_id,type,actor_user_id,title,body,action_url,related_type,related_id,expires_at,created_at) VALUES (?,?,'team-invitation',?,?,?,'/home.html#teams','team-invitation',?,?,?)").bind(id(),invited.id,user.id,`Invitation to ${item?.name||"a team"}`,`${user.display_name} invited you to join.`,inviteId,expiresAt,timestamp),
      ]);
    } catch (error) {
      if (String(error).includes("UNIQUE")) return json({ error:"That member already has a pending invitation." }, { status:409 });
      throw error;
    }
    return json({ ok:true }, { status:201 });
  }

  const invitation = path.match(/^\/api\/team-invitations\/([^/]+)\/respond$/);
  if (invitation && request.method === "POST") {
    if(!user)return json({error:"Please sign in."},{status:401});
    if(!["accepted","declined"].includes(body.status))return json({error:"Choose accept or decline."},{status:400});
    const invite=await env.DB.prepare("SELECT * FROM team_invitations WHERE id=? AND invited_user_id=? AND status='pending' AND expires_at>?").bind(invitation[1],user.id,now()).first<any>();
    if(!invite)return json({error:"Invitation not found or expired."},{status:404});
    const timestamp=now(); const statements=[
      env.DB.prepare("UPDATE team_invitations SET status=?,responded_at=?,updated_at=? WHERE id=?").bind(body.status,timestamp,timestamp,invite.id),
      env.DB.prepare("UPDATE notifications SET read_at=? WHERE recipient_user_id=? AND related_type='team-invitation' AND related_id=?").bind(timestamp,user.id,invite.id),
    ];
    if(body.status==="accepted")statements.push(env.DB.prepare("INSERT OR IGNORE INTO team_members (id,team_id,user_id,role,status,joined_at,updated_at) VALUES (?,?,?,?,'active',?,?)").bind(id(),invite.team_id,user.id,invite.role,timestamp,timestamp));
    await env.DB.batch(statements); return json({ok:true});
  }

  if (path === "/api/notifications" && request.method === "GET") {
    if(!user)return json({error:"Please sign in."},{status:401}); const limit=limitOf(url),cursor=url.searchParams.get("cursor");
    const result=cursor?await env.DB.prepare("SELECT * FROM notifications WHERE recipient_user_id=? AND archived_at IS NULL AND created_at<? AND (expires_at IS NULL OR expires_at>?) ORDER BY created_at DESC LIMIT ?").bind(user.id,cursor,now(),limit+1).all<any>():await env.DB.prepare("SELECT * FROM notifications WHERE recipient_user_id=? AND archived_at IS NULL AND (expires_at IS NULL OR expires_at>?) ORDER BY created_at DESC LIMIT ?").bind(user.id,now(),limit+1).all<any>();
    const notifications=result.results.slice(0,limit);return json({notifications,nextCursor:result.results.length>limit?notifications.at(-1)?.created_at:null});
  }
  if(path==="/api/notifications/unread-count"&&request.method==="GET"){if(!user)return json({error:"Please sign in."},{status:401});const result=await env.DB.prepare("SELECT COUNT(*) count FROM notifications WHERE recipient_user_id=? AND read_at IS NULL AND archived_at IS NULL AND (expires_at IS NULL OR expires_at>?)").bind(user.id,now()).first<any>();return json({count:result?.count||0});}
  const readNotification=path.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if(readNotification&&request.method==="POST"){if(!user)return json({error:"Please sign in."},{status:401});await env.DB.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND recipient_user_id=?").bind(now(),readNotification[1],user.id).run();return json({ok:true});}
  if(path==="/api/notifications/read-all"&&request.method==="POST"){if(!user)return json({error:"Please sign in."},{status:401});await env.DB.prepare("UPDATE notifications SET read_at=? WHERE recipient_user_id=? AND read_at IS NULL").bind(now(),user.id).run();return json({ok:true});}

  if(path==="/api/admin/overview"&&request.method==="GET"){if(!user||!staffRoles.includes(user.role))return json({error:"Not authorized."},{status:403});const counts=await env.DB.batch([env.DB.prepare("SELECT COUNT(*) count FROM users WHERE status='active'"),env.DB.prepare("SELECT COUNT(*) count FROM projects WHERE status='submitted'"),env.DB.prepare("SELECT COUNT(*) count FROM forms WHERE status='published'"),env.DB.prepare("SELECT COUNT(*) count FROM contacts WHERE status='new'")]);return json({counts:{members:(counts[0].results[0]as any)?.count||0,pendingProjects:(counts[1].results[0]as any)?.count||0,openForms:(counts[2].results[0]as any)?.count||0,unreadContacts:(counts[3].results[0]as any)?.count||0}});}

  if(path==="/api/admin/forms"&&request.method==="GET"){if(!user||!leaderRoles.includes(user.role))return json({error:"Not authorized."},{status:403});const forms=await env.DB.prepare("SELECT f.*,(SELECT COUNT(*) FROM form_responses r WHERE r.form_id=f.id AND r.status='submitted') response_count FROM forms f ORDER BY f.updated_at DESC LIMIT 100").all<any>();return json({forms:forms.results});}
  if(path==="/api/admin/forms"&&request.method==="POST"){if(!user||!leaderRoles.includes(user.role))return json({error:"Not authorized."},{status:403});const title=String(body.title||"").trim().slice(0,150);if(!title)return json({error:"Form title is required."},{status:400});const formId=id(),revisionId=id(),timestamp=now(),slug=`${slugify(title)||"form"}-${formId.slice(0,8)}`,schema=body.schema&&typeof body.schema==="object"?body.schema:{sections:[]};await env.DB.batch([env.DB.prepare("INSERT INTO forms (id,slug,title,description,status,access,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,'draft',?,?,?,?)").bind(formId,slug,title,String(body.description||"").slice(0,1000),["public","members","staff"].includes(body.access)?body.access:"public",user.id,timestamp,timestamp),env.DB.prepare("INSERT INTO form_revisions (id,form_id,revision_number,schema_json,created_by_user_id,created_at) VALUES (?,?,1,?,?,?)").bind(revisionId,formId,JSON.stringify(schema),user.id,timestamp)]);return json({ok:true,form:{id:formId,slug,revisionId}},{status:201});}
  const formResponses=path.match(/^\/api\/admin\/forms\/([^/]+)\/responses$/);
  if(formResponses&&request.method==="GET"){
    if(!user||!leaderRoles.includes(user.role))return json({error:"Not authorized."},{status:403});
    const form=await env.DB.prepare("SELECT f.title,r.schema_json FROM forms f LEFT JOIN form_revisions r ON r.id=f.published_revision_id WHERE f.id=?").bind(formResponses[1]).first<any>();
    if(!form)return json({error:"Form not found."},{status:404});
    const rows=await env.DB.prepare("SELECT fr.id,fr.submitted_at,u.display_name,fa.field_id,fa.value_json FROM form_responses fr LEFT JOIN users u ON u.id=fr.respondent_user_id LEFT JOIN form_answers fa ON fa.response_id=fr.id WHERE fr.form_id=? AND fr.status='submitted' ORDER BY fr.submitted_at DESC LIMIT 1000").bind(formResponses[1]).all<any>();
    const schema=parsed(form.schema_json,{sections:[]}) as any;
    const fields=(schema.sections||[]).flatMap((section:any)=>section.fields||[]);
    const responses=new Map<string,any>();
    rows.results.forEach((row:any)=>{if(!responses.has(row.id))responses.set(row.id,{id:row.id,submittedAt:row.submitted_at,respondent:row.display_name||"Anonymous",answers:{}});if(row.field_id)responses.get(row.id).answers[row.field_id]=parsed(row.value_json,null);});
    if(url.searchParams.get("format")==="csv"){
      const quote=(value:unknown)=>`"${String(value??"").replace(/"/g,'""')}"`;
      const csv=[["Submitted","Respondent",...fields.map((field:any)=>field.label)].map(quote).join(","),...[...responses.values()].map((response:any)=>[response.submittedAt,response.respondent,...fields.map((field:any)=>Array.isArray(response.answers[field.id])?response.answers[field.id].join("; "):response.answers[field.id])].map(quote).join(","))].join("\n");
      return new Response(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="${slugify(form.title)||"form"}-responses.csv`,"cache-control":"no-store"}});
    }
    return json({fields:fields.map((field:any)=>({id:field.id,label:field.label})),responses:[...responses.values()]});
  }
  const adminForm=path.match(/^\/api\/admin\/forms\/([^/]+)$/);
  if(adminForm&&request.method==="GET"){if(!user||!leaderRoles.includes(user.role))return json({error:"Not authorized."},{status:403});const form=await env.DB.prepare("SELECT * FROM forms WHERE id=?").bind(adminForm[1]).first<any>();if(!form)return json({error:"Form not found."},{status:404});const revision=await env.DB.prepare("SELECT * FROM form_revisions WHERE form_id=? ORDER BY revision_number DESC LIMIT 1").bind(form.id).first<any>();return json({form,revision:revision?{...revision,schema:parsed(revision.schema_json,{sections:[]})}:null});}
  if(adminForm&&request.method==="PUT"){if(!user||!leaderRoles.includes(user.role))return json({error:"Not authorized."},{status:403});const form=await env.DB.prepare("SELECT * FROM forms WHERE id=?").bind(adminForm[1]).first<any>();if(!form||!body.schema)return json({error:"Form and schema are required."},{status:400});const latest=await env.DB.prepare("SELECT COALESCE(MAX(revision_number),0) revision FROM form_revisions WHERE form_id=?").bind(form.id).first<any>();const revisionId=id(),timestamp=now();await env.DB.batch([env.DB.prepare("UPDATE forms SET title=?,description=?,access=?,updated_at=? WHERE id=?").bind(String(body.title||form.title).trim().slice(0,150),String(body.description??form.description).slice(0,1000),["public","members","staff"].includes(body.access)?body.access:form.access,timestamp,form.id),env.DB.prepare("INSERT INTO form_revisions (id,form_id,revision_number,schema_json,created_by_user_id,created_at) VALUES (?,?,?,?,?,?)").bind(revisionId,form.id,(latest?.revision||0)+1,JSON.stringify(body.schema),user.id,timestamp)]);return json({ok:true,revisionId});}
  const publish=path.match(/^\/api\/admin\/forms\/([^/]+)\/publish$/);
  if(publish&&request.method==="POST"){if(!user||!leaderRoles.includes(user.role))return json({error:"Not authorized."},{status:403});const revision=await env.DB.prepare("SELECT id FROM form_revisions WHERE form_id=? ORDER BY revision_number DESC LIMIT 1").bind(publish[1]).first<any>();if(!revision)return json({error:"Form not found."},{status:404});const timestamp=now();await env.DB.batch([env.DB.prepare("UPDATE form_revisions SET published_at=? WHERE id=?").bind(timestamp,revision.id),env.DB.prepare("UPDATE forms SET status='published',published_revision_id=?,updated_at=? WHERE id=?").bind(revision.id,timestamp,publish[1])]);return json({ok:true});}

  const publicForm=path.match(/^\/api\/forms\/([^/]+)$/);
  if(publicForm&&request.method==="GET"){const form=await env.DB.prepare("SELECT f.*,r.schema_json,r.revision_number FROM forms f JOIN form_revisions r ON r.id=f.published_revision_id WHERE (f.id=? OR f.slug=?) AND f.status='published' AND (f.opens_at IS NULL OR f.opens_at<=?) AND (f.closes_at IS NULL OR f.closes_at>?)").bind(publicForm[1],publicForm[1],now(),now()).first<any>();if(!form)return json({error:"Form not found or closed."},{status:404});if(form.access!=="public"&&!user)return json({error:"Please sign in."},{status:401});return json({form:{id:form.id,slug:form.slug,title:form.title,description:form.description,access:form.access,revision:form.revision_number,schema:parsed(form.schema_json,{sections:[]})}});}
  const response=path.match(/^\/api\/forms\/([^/]+)\/responses$/);
  if(response&&request.method==="POST"){const form=await env.DB.prepare("SELECT f.id,f.access,f.published_revision_id,r.schema_json FROM forms f JOIN form_revisions r ON r.id=f.published_revision_id WHERE (f.id=? OR f.slug=?) AND f.status='published'").bind(response[1],response[1]).first<any>();if(!form)return json({error:"Form not found or closed."},{status:404});if(form.access!=="public"&&!user)return json({error:"Please sign in."},{status:401});const answers=body.answers&&typeof body.answers==="object"?body.answers:{};const fields=(parsed(form.schema_json,{sections:[]})as any).sections.flatMap((section:any)=>section.fields||[]);for(const field of fields){const value=answers[field.id];if(field.required&&(value===undefined||value===null||value===""||(Array.isArray(value)&&!value.length)))return json({error:`${field.label||"A required question"} needs an answer.`},{status:400});}const responseId=id(),timestamp=now();const statements=[env.DB.prepare("INSERT INTO form_responses (id,form_id,revision_id,respondent_user_id,status,submitted_at,created_at,updated_at) VALUES (?,?,?,?,'submitted',?,?,?)").bind(responseId,form.id,form.published_revision_id,user?.id||null,timestamp,timestamp,timestamp)];Object.entries(answers).slice(0,200).forEach(([fieldId,value])=>statements.push(env.DB.prepare("INSERT INTO form_answers (id,response_id,field_id,value_json,created_at) VALUES (?,?,?,?,?)").bind(id(),responseId,fieldId.slice(0,100),JSON.stringify(value),timestamp)));await env.DB.batch(statements);return json({ok:true,responseId},{status:201});}

  if(path==="/api/admin/broadcasts"&&request.method==="POST"){if(!user||!leaderRoles.includes(user.role))return json({error:"Not authorized."},{status:403});const title=String(body.title||"").trim().slice(0,150),message=String(body.body||"").trim().slice(0,5000);if(!title||!message||!isUrl(body.actionUrl))return json({error:"Broadcast title and message are required."},{status:400});const audienceType=body.audienceType==="role"?"role":"all",audienceValue=audienceType==="role"&&["non-member","member",...staffRoles].includes(body.audienceValue)?body.audienceValue:null;const recipients=audienceType==="role"?await env.DB.prepare("SELECT id FROM users WHERE status='active' AND role=? LIMIT 1000").bind(audienceValue).all<any>():await env.DB.prepare("SELECT id FROM users WHERE status='active' LIMIT 1000").all<any>();const broadcastId=id(),timestamp=now();const statements=[env.DB.prepare("INSERT INTO broadcasts (id,created_by_user_id,title,body,action_url,audience_type,audience_value,status,sent_at,created_at) VALUES (?,?,?,?,?,?,?,'sent',?,?)").bind(broadcastId,user.id,title,message,body.actionUrl||null,audienceType,audienceValue,timestamp,timestamp)];recipients.results.forEach((recipient:any)=>{const notificationId=id();statements.push(env.DB.prepare("INSERT INTO notifications (id,recipient_user_id,type,actor_user_id,title,body,action_url,related_type,related_id,created_at) VALUES (?,?,'broadcast',?,?,?,?, 'broadcast',?,?)").bind(notificationId,recipient.id,user.id,title,message,body.actionUrl||null,broadcastId,timestamp));statements.push(env.DB.prepare("INSERT INTO broadcast_deliveries (id,broadcast_id,recipient_user_id,notification_id,status,delivered_at,created_at) VALUES (?,?,?,?,'delivered',?,?)").bind(id(),broadcastId,recipient.id,notificationId,timestamp,timestamp));});for(let offset=0;offset<statements.length;offset+=100)await env.DB.batch(statements.slice(offset,offset+100));return json({ok:true,delivered:recipients.results.length},{status:201});}

  const moderation=path.match(/^\/api\/admin\/projects\/([^/]+)\/status$/);
  if(moderation&&request.method==="PUT"){if(!user||!staffRoles.includes(user.role))return json({error:"Not authorized."},{status:403});if(!["changes-requested","approved","published","archived"].includes(body.status))return json({error:"Invalid project status."},{status:400});const item=await env.DB.prepare("SELECT id,title,status,owner_user_id FROM projects WHERE id=?").bind(moderation[1]).first<any>();if(!item)return json({error:"Project not found."},{status:404});const timestamp=now();await env.DB.batch([env.DB.prepare("UPDATE projects SET status=?,moderation_notes=?,moderated_by_user_id=?,moderated_at=?,published_at=CASE WHEN ?='published' THEN ? ELSE published_at END,updated_at=? WHERE id=?").bind(body.status,String(body.note||"").slice(0,2000),user.id,timestamp,body.status,timestamp,timestamp,item.id),env.DB.prepare("INSERT INTO admin_audit_log (id,actor_user_id,action,target_type,target_id,details_json,created_at) VALUES (?,?,'project.status','project',?,?,?)").bind(id(),user.id,item.id,JSON.stringify({before:item.status,after:body.status}),timestamp),env.DB.prepare("INSERT INTO notifications (id,recipient_user_id,type,actor_user_id,title,body,action_url,related_type,related_id,created_at) VALUES (?,?,'project-status',?,?,?,?,'project',?,?)").bind(id(),item.owner_user_id,user.id,`Project ${body.status}`,`${item.title} is now ${body.status}.`,`/project.html?project=${encodeURIComponent(item.id)}`,item.id,timestamp)]);return json({ok:true});}

  return null;
}

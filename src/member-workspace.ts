import type { Env } from './index';
import { json } from './index';
import { renderGithubReadme } from './github';

type Row = Record<string, any>;
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const staff = (user: Row | null) => ['maintainer', 'club-leader', 'teacher'].includes(user?.role);
const parse = (value: string | null | undefined, fallback: any = {}) => { try { return JSON.parse(value || ''); } catch { return fallback; } };
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 56);
class ApiError extends Error { constructor(message: string, public status = 400) { super(message); } }
const requireUser = (user: Row | null) => { if (!user) throw new ApiError('Please sign in.', 401); return user; };
const requireText = (value: any, label: string, max: number) => { const text = String(value ?? '').trim(); if (!text || text.length > max) throw new ApiError(`${label} must be between 1 and ${max} characters.`); return text; };
const text = (value: any, max: number) => String(value ?? '').trim().slice(0, max);
function link(value: any) {
  if (!value) return null;
  try { const url = new URL(String(value)); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.href.length > 500) throw new Error(); return url.href; }
  catch { throw new ApiError('Use a complete http:// or https:// link.'); }
}
const limitOf = (url: URL) => Math.max(1, Math.min(100, Math.trunc(Number(url.searchParams.get('limit'))) || 20));
function cursorOf(url: URL, sort: string) {
  const raw = url.searchParams.get('cursor');
  if (!raw) return null;
  try { const cursor = JSON.parse(decodeURIComponent(atob(raw))); if (cursor.sort !== sort || typeof cursor.key !== 'string' || typeof cursor.id !== 'string') throw new Error(); return cursor; }
  catch { throw new ApiError('This page cursor has expired. Start from the first page.'); }
}
const makeCursor = (row: Row, sort: string, field: string) => btoa(encodeURIComponent(JSON.stringify({ sort, key: row[field], id: row.id })));
function pageClause(url: URL, sort: string, column: string, alias: string, values: unknown[]) {
  const cursor = cursorOf(url, sort);
  if (!cursor) return '';
  values.push(cursor.key, cursor.key, cursor.id);
  const operator = sort === 'name' ? '>' : '<';
  return ` AND (${column}${operator}? OR (${column}=? AND ${alias}.id${operator}?))`;
}
function visibleProject(user: Row | null, values: unknown[], alias = 'p') {
  if (staff(user)) return '1=1';
  if (!user) return `${alias}.status='published' AND ${alias}.visibility='public'`;
  values.push(user.id);
  return `(${alias}.owner_user_id=? OR (${alias}.status='published' AND ${alias}.visibility IN ('public','members')))`;
}
const projectSelect = 'SELECT p.*,u.display_name owner_name,u.public_slug owner_slug,t.name team_name,t.slug team_slug FROM projects p JOIN users u ON u.id=p.owner_user_id LEFT JOIN teams t ON t.id=p.team_id';
function projectView(item: Row, user: Row | null) {
  const { cover_image_key, labels_json, ...rest } = item;
  const canEdit = Boolean(user && (item.owner_user_id === user.id || staff(user)));
  return { ...rest, moderation_notes: canEdit ? item.moderation_notes : '', labels: parse(labels_json, []), coverUrl: cover_image_key ? `/api/projects/${item.id}/cover?v=${encodeURIComponent(item.updated_at)}` : null, canEdit: canEdit && item.status !== 'archived', canManage: canEdit, canSubmit: item.owner_user_id === user?.id && ['draft', 'changes-requested'].includes(item.status) };
}
function teamView(item: Row) {
  const { avatar_image_key, ...rest } = item;
  return { ...rest, avatarUrl: avatar_image_key ? `/api/teams/${item.id}/avatar?v=${encodeURIComponent(item.updated_at)}` : null };
}
function markdown(source: string, url: URL) { return renderGithubReadme(source, { rawBase: `${url.origin}/`, webBase: `${url.origin}/` }); }
async function getProject(env: Env, key: string, user: Row | null) {
  const values: unknown[] = [key, key];
  const visibility = visibleProject(user, values);
  const item = await env.DB.prepare(`${projectSelect} WHERE (p.id=? OR p.slug=?) AND (${visibility})`).bind(...values).first<Row>();
  if (!item) throw new ApiError('Project not found.', 404);
  return item;
}
async function getTeam(env: Env, key: string, user: Row | null) {
  requireUser(user);
  const item = await env.DB.prepare('SELECT t.*,tm.role viewerRole FROM teams t LEFT JOIN team_members tm ON tm.team_id=t.id AND tm.user_id=? AND tm.status=\'active\' WHERE t.id=? OR t.slug=?').bind(user!.id, key, key).first<Row>();
  if (!item || (!item.viewerRole && !staff(user))) throw new ApiError('Team not found.', 404);
  item.viewerRole ||= 'staff';
  return item;
}
const requireManager = (team: Row, ownerOnly = false, allowArchived = false) => {
  if (!(ownerOnly ? team.viewerRole === 'owner' : ['owner', 'admin'].includes(team.viewerRole))) throw new ApiError(ownerOnly ? 'Only the team owner can do that.' : 'Only team owners and administrators can do that.', 403);
  if (!allowArchived && team.status === 'archived') throw new ApiError('Restore this team before making changes.', 409);
};
async function validTeam(env: Env, teamId: any, user: Row) {
  if (!teamId) return null;
  const team = await getTeam(env, String(teamId), user);
  if (team.status !== 'active' || !['owner', 'admin', 'member'].includes(team.viewerRole)) throw new ApiError('Choose an active team you belong to.');
  return team.id;
}
const labelsOf = (value: any) => [...new Set((Array.isArray(value) ? value : []).map(label => text(label, 32)).filter(Boolean))].slice(0, 10);
async function preferences(env: Env, userId: string) {
  const row = await env.DB.prepare('SELECT preferences_json FROM workspace_preferences WHERE user_id=?').bind(userId).first<Row>();
  return parse(row?.preferences_json);
}
function preferencePatch(body: Row) {
  const result: Row = {};
  for (const section of ['projects', 'teams', 'notifications']) {
    if (!body[section] || typeof body[section] !== 'object' || Array.isArray(body[section])) continue;
    result[section] = {};
    for (const key of ['view', 'sort', 'status', 'visibility', 'team', 'label', 'filter', 'type']) {
      if (typeof body[section][key] === 'string') result[section][key] = text(body[section][key], 100);
    }
  }
  for (const key of ['pinnedProjects', 'pinnedTeams']) if (Array.isArray(body[key])) result[key] = [...new Set(body[key].filter((value: any) => typeof value === 'string' && /^[\w-]{1,100}$/.test(value)))].slice(0, 100);
  return result;
}
async function projectList(env: Env, url: URL, user: Row | null) {
  const values: unknown[] = [], where = [visibleProject(user, values)];
  if (url.searchParams.get('mine') === '1') { requireUser(user); where.push('p.owner_user_id=?'); values.push(user!.id); }
  for (const [query, column, allowed] of [['status','p.status',['draft','submitted','changes-requested','approved','published','archived']],['visibility','p.visibility',['private','members','public']]] as const) {
    const value = url.searchParams.get(query); if (value && allowed.includes(value as never)) { where.push(`${column}=?`); values.push(value); }
  }
  if (url.searchParams.get('status') === 'active') where.push("p.status!='archived'");
  const team = url.searchParams.get('team'); if (team) { where.push('p.team_id=?'); values.push(team); }
  const label = url.searchParams.get('label'); if (label) { where.push('EXISTS(SELECT 1 FROM json_each(p.labels_json) WHERE value=? COLLATE NOCASE)'); values.push(text(label, 32)); }
  const query = text(url.searchParams.get('q'), 150); if (query) { where.push("(instr(lower(p.title||' '||p.summary||' '||u.display_name),lower(?))>0)"); values.push(query); }
  const sort = url.searchParams.get('sort') === 'name' ? 'name' : 'updated';
  const column = sort === 'name' ? 'p.title COLLATE NOCASE' : 'p.updated_at', direction = sort === 'name' ? 'ASC' : 'DESC';
  const count = await env.DB.prepare(`SELECT COUNT(*) total FROM projects p JOIN users u ON u.id=p.owner_user_id WHERE ${where.join(' AND ')}`).bind(...values).first<Row>();
  const pagination = pageClause(url, sort, column, 'p', values), limit = limitOf(url);
  const rows = await env.DB.prepare(`${projectSelect} WHERE ${where.join(' AND ')}${pagination} ORDER BY ${column} ${direction},p.id ${direction} LIMIT ?`).bind(...values, limit + 1).all<Row>();
  const items = rows.results.slice(0, limit);
  return { projects: items.map(item => projectView(item, user)), total: Number(count?.total || 0), nextCursor: rows.results.length > limit ? makeCursor(items.at(-1)!, sort, sort === 'name' ? 'title' : 'updated_at') : null };
}
async function teamList(env: Env, url: URL, user: Row) {
  const values: unknown[] = [user.id], where = ["tm.user_id=?", "tm.status='active'"];
  const state = url.searchParams.get('status') === 'archived' ? 'archived' : 'active';
  if (url.searchParams.get('status') !== 'all') { where.push('t.status=?'); values.push(state); }
  const query = text(url.searchParams.get('q'), 150); if (query) { where.push("instr(lower(t.name||' '||t.description),lower(?))>0"); values.push(query); }
  const base = 'FROM teams t JOIN team_members tm ON tm.team_id=t.id';
  const total = await env.DB.prepare(`SELECT COUNT(*) total ${base} WHERE ${where.join(' AND ')}`).bind(...values).first<Row>();
  const sort = url.searchParams.get('sort') === 'name' ? 'name' : 'updated', column = sort === 'name' ? 't.name COLLATE NOCASE' : 't.updated_at', direction = sort === 'name' ? 'ASC' : 'DESC';
  const pagination = pageClause(url, sort, column, 't', values), limit = limitOf(url);
  const rows = await env.DB.prepare(`SELECT t.*,tm.role,(SELECT COUNT(*) FROM team_members m WHERE m.team_id=t.id AND m.status='active') memberCount ${base} WHERE ${where.join(' AND ')}${pagination} ORDER BY ${column} ${direction},t.id ${direction} LIMIT ?`).bind(...values, limit + 1).all<Row>();
  const items = rows.results.slice(0, limit);
  const invitations = await env.DB.prepare("SELECT i.id,i.team_id,t.name team_name,t.slug team_slug,u.display_name inviter_name,i.message,i.expires_at FROM team_invitations i JOIN teams t ON t.id=i.team_id JOIN users u ON u.id=i.invited_by_user_id WHERE i.invited_user_id=? AND i.status='pending' AND i.expires_at>? AND t.status='active' ORDER BY i.created_at DESC,i.id DESC").bind(user.id, now()).all<Row>();
  return { teams: items.map(teamView), invitations: invitations.results, total: Number(total?.total || 0), nextCursor: rows.results.length > limit ? makeCursor(items.at(-1)!, sort, sort === 'name' ? 'name' : 'updated_at') : null };
}
function noticeUrl(value: string | null) {
  if (!value) return null;
  if (/^\/home(?:\.html)?#teams$/.test(value)) return '/teams?tab=invitations';
  if (/^\/project(?:\.html)?\?project=/.test(value)) return `/projects/${encodeURIComponent(new URL(value, 'https://example.invalid').searchParams.get('project') || '')}`;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try { return link(value); } catch { return null; }
}
async function notificationView(env: Env, row: Row) {
  const output: Row = { ...row, action_url: noticeUrl(row.action_url) };
  if (row.related_type === 'team-invitation') {
    const invitation = await env.DB.prepare('SELECT i.id,i.status,i.expires_at,i.team_id,t.name team_name,t.slug team_slug,t.status team_status FROM team_invitations i JOIN teams t ON t.id=i.team_id WHERE i.id=?').bind(row.related_id).first<Row>();
    if (invitation && invitation.status === 'pending' && invitation.expires_at <= now()) invitation.status = 'expired';
    output.invitation = invitation;
  }
  return output;
}
async function notificationList(env: Env, url: URL, user: Row) {
  const values: unknown[] = [user.id], where = ['n.recipient_user_id=?'];
  const filter = url.searchParams.get('filter') || 'inbox';
  if (filter === 'done') where.push('n.archived_at IS NOT NULL');
  else if (filter === 'saved') where.push('n.saved_at IS NOT NULL');
  else { where.push('n.archived_at IS NULL'); if (filter === 'unread') { where.push('n.read_at IS NULL', '(n.expires_at IS NULL OR n.expires_at>?)'); values.push(now()); } }
  const type = url.searchParams.get('type'); if (type && ['team-invitation','project-status','broadcast'].includes(type)) { where.push('n.type=?'); values.push(type); }
  const query = text(url.searchParams.get('q'), 150); if (query) { where.push("instr(lower(n.title||' '||n.body),lower(?))>0"); values.push(query); }
  const total = await env.DB.prepare(`SELECT COUNT(*) total FROM notifications n WHERE ${where.join(' AND ')}`).bind(...values).first<Row>();
  const pagination = pageClause(url, 'created', 'n.created_at', 'n', values), limit = limitOf(url);
  const rows = await env.DB.prepare(`SELECT n.* FROM notifications n WHERE ${where.join(' AND ')}${pagination} ORDER BY n.created_at DESC,n.id DESC LIMIT ?`).bind(...values, limit + 1).all<Row>();
  const items = rows.results.slice(0, limit);
  const counts = await env.DB.prepare("SELECT COUNT(*) FILTER(WHERE archived_at IS NULL) inbox,COUNT(*) FILTER(WHERE read_at IS NULL AND archived_at IS NULL AND (expires_at IS NULL OR expires_at>?)) unread,COUNT(*) FILTER(WHERE saved_at IS NOT NULL) saved,COUNT(*) FILTER(WHERE archived_at IS NOT NULL) done FROM notifications WHERE recipient_user_id=?").bind(now(), user.id).first<Row>();
  return { notifications: items.map(item => ({ ...item, action_url: noticeUrl(item.action_url) })), total: Number(total?.total || 0), counts, nextCursor: rows.results.length > limit ? makeCursor(items.at(-1)!, 'created', 'created_at') : null };
}
async function media(request: Request, env: Env, item: Row, kind: 'projects' | 'teams', user: Row | null, body: Row) {
  const column = kind === 'projects' ? 'cover_image_key' : 'avatar_image_key', endpoint = kind === 'projects' ? 'cover' : 'avatar';
  if (request.method === 'GET') {
    if (!item[column]) throw new ApiError('Image not found.', 404);
    const object = await env.PROFILE_IMAGES.get(item[column]);
    if (!object) throw new ApiError('Image not found.', 404);
    return new Response(object.body, { headers: { 'content-type': object.httpMetadata?.contentType || 'image/png', 'cache-control': 'private, max-age=60', 'etag': object.httpEtag } });
  }
  requireUser(user);
  if (kind === 'projects') { if (!projectView(item, user).canEdit) throw new ApiError('You cannot edit this project.', 403); }
  else requireManager(item);
  if (!['POST','DELETE'].includes(request.method)) throw new ApiError('Method not allowed.', 405);
  let key: string | null = null;
  if (request.method === 'POST') {
    const match = String(body.dataUrl || '').match(/^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/);
    if (!match || match[2].length > 2_666_672) throw new ApiError('Choose a PNG, JPG, or WebP image under 2 MB.');
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0)); } catch { throw new ApiError('This image could not be read.'); }
    if (!bytes.length || bytes.length > 2_000_000) throw new ApiError('Choose an image under 2 MB.');
    const signature = match[1] === 'image/png' ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 : match[1] === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP';
    if (!signature) throw new ApiError('The file contents do not match its image type.');
    key = `${kind}/${item.id}/${id()}`;
    await env.PROFILE_IMAGES.put(key, bytes, { httpMetadata: { contentType: match[1] } });
  }
  const timestamp = now();
  await env.DB.prepare(`UPDATE ${kind} SET ${column}=?,updated_at=? WHERE id=?`).bind(key, timestamp, item.id).run();
  if (item[column]) await env.PROFILE_IMAGES.delete(item[column]);
  return json({ ok: true, imageUrl: key ? `/api/${kind}/${item.id}/${endpoint}?v=${encodeURIComponent(timestamp)}` : null });
}

export async function memberWorkspaceApi(request: Request, env: Env, user: Row | null, body: Row): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  if (!/^\/api\/(workspace(?:\/|$)|projects(?:\/|$)|teams(?:\/|$)|team-invitations(?:\/|$)|notifications(?:\/|$))/.test(path)) return null;
  try {
    if (path === '/api/workspace/preferences') {
      requireUser(user);
      if (method === 'PUT') {
        const patch = preferencePatch(body);
        await env.DB.prepare("INSERT INTO workspace_preferences(user_id,preferences_json,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET preferences_json=json_patch(workspace_preferences.preferences_json,excluded.preferences_json),updated_at=excluded.updated_at").bind(user!.id, JSON.stringify(patch), now()).run();
      } else if (method !== 'GET') throw new ApiError('Method not allowed.', 405);
      return json({ preferences: await preferences(env, user!.id) });
    }
    if (path === '/api/workspace/preview' && method === 'POST') { requireUser(user); return json({ html: markdown(text(body.markdown, 50_000), url) }); }
    if (path === '/api/workspace/summary' && method === 'GET') {
      requireUser(user);
      const prefs = await preferences(env, user!.id);
      const [counts, projects, teams, invites] = await Promise.all([
        env.DB.prepare("SELECT (SELECT COUNT(*) FROM projects WHERE owner_user_id=? AND status!='archived') projects,(SELECT COUNT(*) FROM team_members m JOIN teams t ON t.id=m.team_id WHERE m.user_id=? AND m.status='active' AND t.status='active') teams,(SELECT COUNT(*) FROM notifications WHERE recipient_user_id=? AND archived_at IS NULL AND read_at IS NULL AND (expires_at IS NULL OR expires_at>?)) unread").bind(user!.id,user!.id,user!.id,now()).first<Row>(),
        env.DB.prepare(`${projectSelect} WHERE p.owner_user_id=? AND p.status!='archived' ORDER BY EXISTS(SELECT 1 FROM json_each(?) WHERE value=p.id) DESC,p.updated_at DESC,p.id DESC LIMIT 5`).bind(user!.id,JSON.stringify(prefs.pinnedProjects || [])).all<Row>(),
        env.DB.prepare("SELECT t.*,m.role,(SELECT COUNT(*) FROM team_members tm WHERE tm.team_id=t.id AND tm.status='active') memberCount FROM teams t JOIN team_members m ON m.team_id=t.id WHERE m.user_id=? AND m.status='active' AND t.status='active' ORDER BY EXISTS(SELECT 1 FROM json_each(?) WHERE value=t.id) DESC,t.updated_at DESC,t.id DESC LIMIT 5").bind(user!.id,JSON.stringify(prefs.pinnedTeams || [])).all<Row>(),
        env.DB.prepare("SELECT COUNT(*) count FROM team_invitations i JOIN teams t ON t.id=i.team_id WHERE i.invited_user_id=? AND i.status='pending' AND i.expires_at>? AND t.status='active'").bind(user!.id,now()).first<Row>()
      ]);
      return json({ counts: { ...counts, invitations: Number(invites?.count || 0) }, projects: projects.results.map(item => projectView(item,user)), teams: teams.results.map(teamView), preferences: prefs });
    }
    if (path === '/api/projects') {
      if (method === 'GET') return json(await projectList(env, url, user));
      if (method === 'POST') {
        requireUser(user); const title = requireText(body.title,'Title',100), projectId = id(), timestamp = now(), slug = `${slugify(title) || 'project'}-${projectId.slice(0,8)}`;
        const teamId = await validTeam(env,body.teamId,user!);
        await env.DB.prepare("INSERT INTO projects(id,owner_user_id,slug,title,summary,content_markdown,demo_url,source_url,status,visibility,team_id,labels_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'draft',?,?,?,?,?)").bind(projectId,user!.id,slug,title,text(body.summary,300),text(body.contentMarkdown,50000),link(body.demoUrl),link(body.sourceUrl),['private','members','public'].includes(body.visibility)?body.visibility:'private',teamId,JSON.stringify(labelsOf(body.labels)),timestamp,timestamp).run();
        return json({ ok:true, project:{ id:projectId, slug } },{status:201});
      }
    }
    const projectRoute = path.match(/^\/api\/projects\/([^/]+)(?:\/(cover|submit|archive|restore))?$/);
    if (projectRoute) {
      const item = await getProject(env,decodeURIComponent(projectRoute[1]),user), action = projectRoute[2];
      if (action === 'cover') return await media(request,env,item,'projects',user,body);
      if (!action && method === 'GET') return json({ project:{...projectView(item,user), contentHtml:markdown(item.content_markdown,url)} });
      requireUser(user); const view = projectView(item,user);
      if (!view.canManage) throw new ApiError('Only the project owner or club staff can change this project.',403);
      if (!action && method === 'PUT') {
        if (item.status === 'archived') throw new ApiError('Restore this project before editing it.',409);
        const teamId = body.teamId === undefined || body.teamId === item.team_id ? item.team_id : await validTeam(env,body.teamId,user!);
        await env.DB.prepare('UPDATE projects SET title=?,summary=?,content_markdown=?,demo_url=?,source_url=?,visibility=?,team_id=?,labels_json=?,updated_at=? WHERE id=?').bind(requireText(body.title??item.title,'Title',100),text(body.summary??item.summary,300),text(body.contentMarkdown??item.content_markdown,50000),link(body.demoUrl===undefined?item.demo_url:body.demoUrl),link(body.sourceUrl===undefined?item.source_url:body.sourceUrl),['private','members','public'].includes(body.visibility)?body.visibility:item.visibility,teamId,JSON.stringify(body.labels===undefined?parse(item.labels_json,[]):labelsOf(body.labels)),now(),item.id).run();
        return json({ok:true});
      }
      if (method === 'POST' && ['submit','archive','restore'].includes(action || '')) {
        if (action === 'submit' && !view.canSubmit) throw new ApiError('This project cannot be submitted now.',409);
        if (action === 'restore' && item.status !== 'archived') throw new ApiError('This project is not archived.',409);
        const state = action === 'submit' ? 'submitted' : action === 'archive' ? 'archived' : 'draft', timestamp = now();
        await env.DB.prepare("UPDATE projects SET status=?,submitted_at=CASE WHEN ?='submitted' THEN ? ELSE submitted_at END,updated_at=? WHERE id=?").bind(state,state,timestamp,timestamp,item.id).run();
        return json({ok:true,status:state});
      }
    }
    if (path === '/api/teams') {
      requireUser(user);
      if (method === 'GET') return json(await teamList(env,url,user!));
      if (method === 'POST') {
        const name = requireText(body.name,'Team name',80), teamId=id(), timestamp=now(), slug=`${slugify(name)||'team'}-${teamId.slice(0,8)}`;
        await env.DB.batch([
          env.DB.prepare('INSERT INTO teams(id,slug,name,description,owner_user_id,introduction_markdown,website_url,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(teamId,slug,name,text(body.description,300),user!.id,text(body.introductionMarkdown,50000),link(body.websiteUrl),timestamp,timestamp),
          env.DB.prepare("INSERT INTO team_members(id,team_id,user_id,role,status,joined_at,updated_at) VALUES(?,?,?,'owner','active',?,?)").bind(id(),teamId,user!.id,timestamp,timestamp)
        ]);
        return json({ok:true,team:{id:teamId,slug}},{status:201});
      }
    }
    const teamRoute = path.match(/^\/api\/teams\/([^/]+)(?:\/(avatar|archive|restore|leave|transfer|invitations|candidates|members)(?:\/([^/]+))?)?$/);
    if (teamRoute) {
      const team = await getTeam(env,decodeURIComponent(teamRoute[1]),user), action = teamRoute[2], target = teamRoute[3];
      if (action === 'avatar') return await media(request,env,team,'teams',user,body);
      if (!action && method === 'GET') {
        const members = await env.DB.prepare("SELECT u.id,u.display_name,u.public_slug,tm.role,u.github_avatar_url,CASE WHEN u.profile_image_key IS NOT NULL THEN '/api/profile-image/'||u.id ELSE NULL END profileImageUrl FROM team_members tm JOIN users u ON u.id=tm.user_id WHERE tm.team_id=? AND tm.status='active' ORDER BY CASE tm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,u.display_name COLLATE NOCASE").bind(team.id).all<Row>();
        const invitations = ['owner','admin'].includes(team.viewerRole) ? await env.DB.prepare("SELECT i.id,i.status,i.message,i.expires_at,u.display_name FROM team_invitations i JOIN users u ON u.id=i.invited_user_id WHERE i.team_id=? AND i.status='pending' AND i.expires_at>? ORDER BY i.created_at DESC").bind(team.id,now()).all<Row>() : { results: [] };
        return json({team:{...teamView(team),introductionHtml:markdown(team.introduction_markdown,url)},members:members.results,invitations:invitations.results,viewerRole:team.viewerRole});
      }
      if (!action && method === 'PUT') {
        requireManager(team);
        await env.DB.prepare('UPDATE teams SET name=?,description=?,introduction_markdown=?,website_url=?,updated_at=? WHERE id=?').bind(requireText(body.name??team.name,'Team name',80),text(body.description??team.description,300),text(body.introductionMarkdown??team.introduction_markdown,50000),link(body.websiteUrl===undefined?team.website_url:body.websiteUrl),now(),team.id).run(); return json({ok:true});
      }
      if (action === 'candidates' && method === 'GET') {
        requireManager(team); const query=text(url.searchParams.get('q'),80);
        if (query.length < 2) return json({members:[]});
        const members=await env.DB.prepare("SELECT u.id,u.display_name,u.public_slug FROM users u WHERE u.status='active' AND instr(lower(u.display_name),lower(?))>0 AND NOT EXISTS(SELECT 1 FROM team_members m WHERE m.team_id=? AND m.user_id=u.id AND m.status='active') AND NOT EXISTS(SELECT 1 FROM team_invitations i WHERE i.team_id=? AND i.invited_user_id=u.id AND i.status='pending' AND i.expires_at>?) ORDER BY u.display_name COLLATE NOCASE LIMIT 20").bind(query,team.id,team.id,now()).all<Row>(); return json({members:members.results});
      }
      if (action === 'invitations') {
        requireManager(team);
        if (target && method === 'DELETE') {
          await env.DB.batch([env.DB.prepare("UPDATE team_invitations SET status='revoked',updated_at=? WHERE id=? AND team_id=? AND status='pending'").bind(now(),target,team.id),env.DB.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE related_type='team-invitation' AND related_id=? AND related_id IN(SELECT id FROM team_invitations WHERE team_id=? AND status='revoked')").bind(now(),target,team.id)]);return json({ok:true});
        }
        if (!target && method === 'POST') {
          const invited=await env.DB.prepare('SELECT id FROM users WHERE status=\'active\' AND (id=? OR display_name=? COLLATE NOCASE)').bind(text(body.userId,100),text(body.displayName,100)).first<Row>();
          if (!invited) throw new ApiError('Choose an existing member.');
          const active=await env.DB.prepare("SELECT id FROM team_members WHERE team_id=? AND user_id=? AND status='active'").bind(team.id,invited.id).first<Row>();
          if (active) throw new ApiError('That person is already on the team.',409);
          const timestamp=now(), inviteId=id(),expiresAt=new Date(Date.now()+7*86400000).toISOString();
          try { await env.DB.batch([
            env.DB.prepare("UPDATE team_invitations SET status='expired',updated_at=? WHERE team_id=? AND invited_user_id=? AND status='pending' AND expires_at<=?").bind(timestamp,team.id,invited.id,timestamp),
            env.DB.prepare("INSERT INTO team_invitations(id,team_id,invited_user_id,invited_by_user_id,role,status,message,expires_at,created_at,updated_at) VALUES(?,?,?,?,'member','pending',?,?,?,?)").bind(inviteId,team.id,invited.id,user!.id,text(body.message,300),expiresAt,timestamp,timestamp),
            env.DB.prepare("INSERT INTO notifications(id,recipient_user_id,type,actor_user_id,title,body,action_url,related_type,related_id,expires_at,created_at) VALUES(?,?,'team-invitation',?,?,?,?, 'team-invitation',?,?,?)").bind(id(),invited.id,user!.id,`Invitation to ${team.name}`,text(body.message,300)||`${user!.display_name} invited you to join.`, '/teams?tab=invitations',inviteId,expiresAt,timestamp)
          ]); } catch (error) { if (String(error).includes('UNIQUE')) throw new ApiError('That member already has a pending invitation.',409); throw error; }
          return json({ok:true},{status:201});
        }
      }
      if (action === 'members' && target && method === 'PUT') {
        requireManager(team);
        const member=await env.DB.prepare("SELECT * FROM team_members WHERE team_id=? AND user_id=? AND status='active'").bind(team.id,target).first<Row>();
        if (!member) throw new ApiError('Member not found.',404);
        if (member.role === 'owner' || member.user_id === user!.id) throw new ApiError('Use transfer ownership or leave team for this change.');
        if (body.status === 'removed') {
          if (team.viewerRole !== 'owner' && member.role !== 'member') throw new ApiError('Only the owner can remove administrators.',403);
          await env.DB.prepare("UPDATE team_members SET status='removed',updated_at=? WHERE id=?").bind(now(),member.id).run();
        } else {
          requireManager(team,true);if (!['member','admin'].includes(body.role)) throw new ApiError('Choose member or administrator.');
          await env.DB.prepare('UPDATE team_members SET role=?,updated_at=? WHERE id=?').bind(body.role,now(),member.id).run();
        }
        return json({ok:true});
      }
      if (method === 'POST' && ['archive','restore','leave','transfer'].includes(action || '')) {
        if (action === 'leave') {
          if (team.viewerRole === 'owner') throw new ApiError('Transfer ownership before leaving.',409);
          if (team.viewerRole === 'staff') throw new ApiError('You are not a member of this team.',403);
          await env.DB.prepare("UPDATE team_members SET status='left',updated_at=? WHERE team_id=? AND user_id=? AND status='active' AND role!='owner'").bind(now(),team.id,user!.id).run();
        } else if (action === 'transfer') {
          requireManager(team,true);
          const next=await env.DB.prepare("SELECT user_id FROM team_members WHERE team_id=? AND user_id=? AND status='active' AND role!='owner'").bind(team.id,text(body.userId,100)).first<Row>();
          if (!next) throw new ApiError('Choose another active member.');
          await env.DB.batch([
            env.DB.prepare('UPDATE teams SET owner_user_id=?,updated_at=? WHERE id=? AND owner_user_id=?').bind(next.user_id,now(),team.id,user!.id),
            env.DB.prepare("UPDATE team_members SET role=CASE WHEN user_id=? THEN 'owner' ELSE 'admin' END,updated_at=? WHERE team_id=? AND user_id IN(?,?) AND EXISTS(SELECT 1 FROM teams WHERE id=? AND owner_user_id=?)").bind(next.user_id,now(),team.id,next.user_id,user!.id,team.id,next.user_id)
          ]);
        } else {
          requireManager(team,true,true);
          await env.DB.prepare('UPDATE teams SET status=?,updated_at=? WHERE id=?').bind(action==='archive'?'archived':'active',now(),team.id).run();
        }
        return json({ok:true});
      }
    }
    const invitationRoute=path.match(/^\/api\/team-invitations\/([^/]+)\/respond$/);
    if (invitationRoute && method==='POST') {
      requireUser(user); if(!['accepted','declined'].includes(body.status)) throw new ApiError('Choose accept or decline.');
      const timestamp=now(),invite=await env.DB.prepare("SELECT i.* FROM team_invitations i JOIN teams t ON t.id=i.team_id WHERE i.id=? AND i.invited_user_id=? AND i.status='pending' AND i.expires_at>? AND t.status='active'").bind(invitationRoute[1],user!.id,timestamp).first<Row>();
      if(!invite) throw new ApiError('This invitation is no longer available.',409);
      const statements=[];
      if(body.status==='accepted') statements.push(env.DB.prepare("INSERT INTO team_members(id,team_id,user_id,role,status,joined_at,updated_at) SELECT ?,team_id,invited_user_id,role,'active',?,? FROM team_invitations WHERE id=? AND status='pending' AND expires_at>? ON CONFLICT(team_id,user_id) DO UPDATE SET role=CASE WHEN team_members.status='active' THEN team_members.role ELSE excluded.role END,status='active',updated_at=excluded.updated_at").bind(id(),timestamp,timestamp,invite.id,timestamp));
      statements.push(env.DB.prepare("UPDATE team_invitations SET status=?,responded_at=?,updated_at=? WHERE id=? AND status='pending' AND expires_at>?").bind(body.status,timestamp,timestamp,invite.id,timestamp));
      statements.push(env.DB.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE recipient_user_id=? AND related_type='team-invitation' AND related_id=?").bind(timestamp,user!.id,invite.id));
      const results=await env.DB.batch(statements);
      if (!results[body.status==='accepted'?1:0].meta.changes) throw new ApiError('This invitation has already been answered.',409);
      return json({ok:true,teamId:invite.team_id});
    }
    if (path==='/api/notifications' && method==='GET') { requireUser(user); return json(await notificationList(env,url,user!)); }
    if(path==='/api/notifications/unread-count' && method==='GET') { requireUser(user); const result=await env.DB.prepare('SELECT COUNT(*) count FROM notifications WHERE recipient_user_id=? AND read_at IS NULL AND archived_at IS NULL AND (expires_at IS NULL OR expires_at>?)').bind(user!.id,now()).first<Row>();return json({count:Number(result?.count||0)}); }
    if(path==='/api/notifications/read-all' && method==='POST') {requireUser(user);await env.DB.prepare('UPDATE notifications SET read_at=? WHERE recipient_user_id=? AND read_at IS NULL AND archived_at IS NULL').bind(now(),user!.id).run();return json({ok:true});}
    const noticeRoute=path.match(/^\/api\/notifications\/([^/]+)(?:\/(read|action))?$/);
    if(noticeRoute) {
      requireUser(user);
      if(method==='GET' && noticeRoute[1]!=='bulk') {const notice=await env.DB.prepare('SELECT * FROM notifications WHERE id=? AND recipient_user_id=?').bind(noticeRoute[1],user!.id).first<Row>();if(!notice)throw new ApiError('Notification not found.',404);return json({notification:await notificationView(env,notice)});}
      if(method==='POST') {
        const ids=noticeRoute[1]==='bulk'?[...new Set(Array.isArray(body.ids)?body.ids:[])]:[noticeRoute[1]];
        if(!ids.length||ids.length>100||ids.some(value=>typeof value!=='string'))throw new ApiError('Select between 1 and 100 notifications.');
        const action=noticeRoute[2]==='read'?'read':body.action;
        const updates:Record<string,string>={read:'read_at=COALESCE(read_at,?)',unread:'read_at=NULL',save:'saved_at=COALESCE(saved_at,?)',unsave:'saved_at=NULL',done:'archived_at=?,read_at=COALESCE(read_at,?)',restore:'archived_at=NULL'};
        if(!updates[action])throw new ApiError('Choose a notification action.');
        const values=action==='done'?[now(),now()]:['read','save'].includes(action)?[now()]:[];
        await env.DB.prepare(`UPDATE notifications SET ${updates[action]} WHERE recipient_user_id=? AND id IN(${ids.map(()=>'?').join(',')})`).bind(...values,user!.id,...ids).run();return json({ok:true});
      }
    }
    throw new ApiError('Route not found.',404);
  } catch(error) { if(error instanceof ApiError)return json({error:error.message},{status:error.status});throw error; }
}

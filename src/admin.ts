import type { Env } from './index';
import { currentUser, csrfValid, sameOrigin, json } from './index';
import { renderGithubReadme } from './github';

type Row = Record<string, any>;
const stamp = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const staff = (u: Row | null) => ['maintainer','club-leader','teacher'].includes(u?.role);
const leader = (u: Row | null) => ['club-leader','teacher'].includes(u?.role);
const clean = (v: any, max = 500) => String(v ?? '').trim().slice(0,max);
const fail = (message: string, status = 400) => json({error:message},{status});
const requireRow = (row: Row | null, label: string) => { if (!row) throw new AdminError(`${label} not found.`,404); return row; };
class AdminError extends Error { constructor(message: string, public status = 400) { super(message); } }
const pageOf = (url: URL) => Math.min(100000, Math.max(1,Math.trunc(Number(url.searchParams.get('page'))) || 1));
const limitOf = (url: URL) => Math.min(100, Math.max(1,Math.trunc(Number(url.searchParams.get('limit'))) || 20));
const like = (v: string) => `%${v.replace(/[\\%_]/g, '\\$&')}%`;
const match = (column: string) => `${column} LIKE ? ESCAPE '\\' COLLATE NOCASE`;
function urlValue(value: any) {
  if (value === null || value === undefined || value === '') return null;
  try { const u = new URL(String(value)); if (!['http:','https:'].includes(u.protocol) || u.username || u.password || u.href.length > 500) throw new Error(); return u.href; }
  catch { throw new AdminError('Use a complete http:// or https:// link.'); }
}
function localDate(value: any) {
  if (!value) return null;
  const time = new Date(String(value));
  if (!Number.isFinite(time.getTime())) throw new AdminError('Choose a valid date and time.');
  return time.toISOString();
}
async function listed(env: Env, select: string, from: string, where: string[], args: any[], order: string, url: URL) {
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const count = await env.DB.prepare(`SELECT COUNT(*) total ${from}${clause}`).bind(...args).first<Row>();
  const page = pageOf(url), limit = limitOf(url);
  const rows = await env.DB.prepare(`${select} ${from}${clause} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...args,limit,(page-1)*limit).all<Row>();
  return {items:rows.results,total:Number(count?.total||0),page,limit,hasMore:page*limit<Number(count?.total||0)};
}
async function audit(env: Env, actor: Row, action: string, type: string, target: string, details: Row = {}) {
  await env.DB.prepare('INSERT INTO admin_audit_log(id,actor_user_id,action,target_type,target_id,details_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(uid(),actor.id,action,type,target,JSON.stringify(details),stamp()).run();
}
async function noteList(env: Env, type: string, target: string) {
  const rows = await env.DB.prepare('SELECT n.id,n.body,n.created_at,u.display_name author FROM staff_notes n JOIN users u ON u.id=n.author_user_id WHERE n.subject_type=? AND n.subject_id=? ORDER BY n.created_at DESC,n.id DESC LIMIT 100').bind(type,target).all<Row>();
  return rows.results;
}
async function notify(env: Env, actor: Row, recipient: string, type: string, title: string, body: string, href: string, relatedId: string) {
  if (actor.id === recipient) return;
  await env.DB.prepare('INSERT INTO notifications(id,recipient_user_id,type,actor_user_id,title,body,action_url,related_type,related_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(uid(),recipient,type,actor.id,title,body,href,type,relatedId,stamp()).run();
}
const formFields = (schema: any) => Array.isArray(schema?.sections) ? schema.sections.flatMap((s:any)=>Array.isArray(s.fields)?s.fields:[]) : [];
function validateFormSchema(schema: any) {
  if (!Array.isArray(schema?.sections) || schema.sections.length < 1 || schema.sections.length > 30) throw new AdminError('Add at least one form section.');
  const fields = formFields(schema);
  if (!fields.length || fields.length > 200) throw new AdminError('Add between 1 and 200 questions.');
  const types = ['short-text','paragraph','email','number','url','date','time','linear-scale','single-choice','checkboxes','dropdown','consent'];
  const ids = new Set<string>();
  for (const field of fields) {
    if (!types.includes(field.type) || !clean(field.label,150) || !clean(field.id,100) || ids.has(field.id)) throw new AdminError('Every question needs a unique ID, type, and label.');
    ids.add(field.id);
    if (['single-choice','checkboxes','dropdown'].includes(field.type) && (!Array.isArray(field.options) || field.options.filter((v:any)=>clean(v,150)).length < 1)) throw new AdminError('Choice questions need options.');
  }
}
async function responseRows(env: Env, formId: string, page: number, limit: number, reviewed: string | null) {
  const filter = reviewed==='yes'?' AND fr.reviewed_at IS NOT NULL':reviewed==='no'?' AND fr.reviewed_at IS NULL':'';
  return env.DB.prepare(`SELECT fr.id,fr.submitted_at,fr.reviewed_at,fr.revision_id,u.display_name respondent FROM form_responses fr LEFT JOIN users u ON u.id=fr.respondent_user_id WHERE fr.form_id=? AND fr.status='submitted'${filter} ORDER BY fr.submitted_at DESC,fr.id DESC LIMIT ? OFFSET ?`).bind(formId,limit,(page-1)*limit).all<Row>();
}
async function responseAnswers(env: Env, ids: string[]) {
  if (!ids.length) return new Map<string,Row>();
  const rows=await env.DB.prepare(`SELECT response_id,field_id,value_json FROM form_answers WHERE response_id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all<Row>();
  const result=new Map<string,Row>();
  for (const row of rows.results) { const answer=result.get(row.response_id)||{}; try { answer[row.field_id]=JSON.parse(row.value_json); } catch { answer[row.field_id]=null; } result.set(row.response_id,answer); }
  return result;
}
function broadcastInput(body: Row, existing?: Row) {
  const title=clean(body.title??existing?.title,150),message=clean(body.body??existing?.body,5000);
  if(!title||!message)throw new AdminError('Add a title and message.');
  const audienceType=body.audienceType??existing?.audience_type??'all';
  const audienceValue=audienceType==='role'?clean(body.audienceValue??existing?.audience_value,30):null;
  if(!['all','role'].includes(audienceType)|| (audienceType==='role'&&!['member','non-member','maintainer','club-leader','teacher'].includes(audienceValue)))throw new AdminError('Choose a valid audience.');
  return {title,message,audienceType,audienceValue,actionUrl:body.actionUrl===undefined?existing?.action_url||null:urlValue(body.actionUrl)};
}
async function broadcastStats(env: Env, id: string) {
  const row=await env.DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) delivered,SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed FROM broadcast_deliveries WHERE broadcast_id=?").bind(id).first<Row>();
  return {total:Number(row?.total||0),delivered:Number(row?.delivered||0),failed:Number(row?.failed||0)};
}
async function processBroadcast(env: Env, id: string, force=false) {
  let row=requireRow(await env.DB.prepare('SELECT * FROM broadcasts WHERE id=?').bind(id).first<Row>(),'Broadcast');
  if(row.status==='cancelled')throw new AdminError('Cancelled broadcasts cannot be sent.',409);
  if(!row.send_started_at){
    if(!force && (!row.scheduled_at||row.scheduled_at>stamp()))return;
    const start=stamp(),startToken=uid(),audience=row.audience_type==='role'?' AND role=?':'',args=row.audience_type==='role'?[row.audience_value]:[];
    const [claimed]=await env.DB.batch([
      env.DB.prepare("UPDATE broadcasts SET send_started_at=?,send_claim_token=?,updated_at=?,last_error=NULL WHERE id=? AND status='draft' AND send_started_at IS NULL").bind(start,startToken,start,id),
      env.DB.prepare(`INSERT OR IGNORE INTO broadcast_deliveries(id,broadcast_id,recipient_user_id,status,created_at) SELECT lower(hex(randomblob(16))),?,id,'pending',? FROM users WHERE status='active'${audience} AND EXISTS (SELECT 1 FROM broadcasts WHERE id=? AND send_claim_token=? AND status='draft')`).bind(id,start,...args,id,startToken),
    ]);
    if(Number(claimed.meta.changes||0)){
      const stats=await broadcastStats(env,id);
      await env.DB.prepare('UPDATE broadcasts SET recipient_total=? WHERE id=?').bind(stats.total,id).run();
    }
    row=requireRow(await env.DB.prepare('SELECT * FROM broadcasts WHERE id=?').bind(id).first<Row>(),'Broadcast');
    if(row.status==='cancelled')throw new AdminError('Cancelled broadcasts cannot be sent.',409);
  }
  if(row.send_completed_at)return;
  const claim=uid(),time=stamp(),stale=new Date(Date.now()-5*60000).toISOString();
  await env.DB.prepare("UPDATE broadcast_deliveries SET claim_token=?,claim_at=? WHERE id IN (SELECT id FROM broadcast_deliveries WHERE broadcast_id=? AND status='pending' AND (claim_token IS NULL OR claim_at<?) ORDER BY created_at,id LIMIT 50) AND status='pending' AND (claim_token IS NULL OR claim_at<?)").bind(claim,time,id,stale,stale).run();
  const batch=await env.DB.prepare('SELECT id,recipient_user_id FROM broadcast_deliveries WHERE broadcast_id=? AND claim_token=?').bind(id,claim).all<Row>();
  if(batch.results.length){
    const statements:D1PreparedStatement[]=[];
    for(const item of batch.results){const notificationId=uid();statements.push(env.DB.prepare("INSERT INTO notifications(id,recipient_user_id,type,actor_user_id,title,body,action_url,related_type,related_id,created_at) VALUES(?,?,'broadcast',?,?,?,?, 'broadcast',?,?)").bind(notificationId,item.recipient_user_id,row.created_by_user_id,row.title,row.body,row.action_url,id,time));statements.push(env.DB.prepare("UPDATE broadcast_deliveries SET status='delivered',notification_id=?,delivered_at=?,claim_token=NULL,claim_at=NULL WHERE id=? AND claim_token=? AND status='pending'").bind(notificationId,time,item.id,claim));}
    try{await env.DB.batch(statements);}catch(error){await env.DB.prepare("UPDATE broadcast_deliveries SET status='failed',claim_token=NULL,claim_at=NULL WHERE broadcast_id=? AND claim_token=? AND status='pending'").bind(id,claim).run();await env.DB.prepare('UPDATE broadcasts SET last_error=?,updated_at=? WHERE id=?').bind(clean(error,500),stamp(),id).run();throw error;}
  }
  const pending=await env.DB.prepare("SELECT COUNT(*) n FROM broadcast_deliveries WHERE broadcast_id=? AND status='pending'").bind(id).first<Row>();
  if(!Number(pending?.n||0))await env.DB.prepare("UPDATE broadcasts SET status='sent',sent_at=COALESCE(sent_at,?),send_completed_at=?,updated_at=? WHERE id=? AND status='draft' AND send_completed_at IS NULL").bind(stamp(),stamp(),stamp(),id).run();
}
export async function processDueBroadcasts(env: Env) {
  const due=await env.DB.prepare("SELECT id FROM broadcasts WHERE (status='draft' AND scheduled_at IS NOT NULL AND scheduled_at<=?) OR (status='draft' AND send_started_at IS NOT NULL AND send_completed_at IS NULL) ORDER BY COALESCE(scheduled_at,send_started_at),id LIMIT 20").bind(stamp()).all<Row>();
  for(const row of due.results){try{await processBroadcast(env,row.id);}catch(error){console.error('Broadcast delivery failed',row.id,error);}}
}
function csvCell(value: any) {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  const safe = /^[\s]*[=+@\-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"','""')}"`;
}

export async function adminApi(request: Request, env: Env): Promise<Response | null> {
  const url=new URL(request.url), path=url.pathname, method=request.method;
  if (!path.startsWith('/api/admin/')) return null;
  // These legacy mutation routes retain their existing public contract.
  if (/^\/api\/admin\/users\/[^/]+(?:\/password)?$/.test(path) && method==='PUT') return null;
  if (!sameOrigin(request) || !csrfValid(request)) return fail('Security check failed. Refresh and try again.',403);
  const user=await currentUser(request,env);
  if (!user) return fail('Please sign in.',401);
  if (!staff(user)) return fail('Staff access required.',403);
  let body: Row={};
  if (['POST','PUT','PATCH'].includes(method)) {
    try { body=await request.clone().json(); if (!body || typeof body!=='object' || Array.isArray(body)) throw new Error(); }
    catch { return fail('Send a valid JSON object.'); }
  }
  try {
    if (path==='/api/admin/dashboard' && method==='GET') {
      const counts=await env.DB.batch([
        env.DB.prepare("SELECT COUNT(*) n FROM users WHERE status='active'"),
        env.DB.prepare("SELECT COUNT(*) n FROM projects WHERE status='submitted'"),
        env.DB.prepare("SELECT COUNT(*) n FROM forms WHERE status='published' AND (opens_at IS NULL OR opens_at<=?) AND (closes_at IS NULL OR closes_at>?)").bind(stamp(),stamp()),
        env.DB.prepare("SELECT COUNT(*) n FROM contacts WHERE status='new'"),
        env.DB.prepare("SELECT COUNT(*) n FROM teams WHERE status='active'"),
        env.DB.prepare("SELECT COUNT(*) n FROM broadcasts WHERE status='draft' AND scheduled_at>?").bind(stamp()),
      ]);
      const previews=await env.DB.batch([
        env.DB.prepare("SELECT p.id,p.title,p.submitted_at,u.display_name owner FROM projects p JOIN users u ON u.id=p.owner_user_id WHERE p.status='submitted' ORDER BY p.submitted_at DESC,p.id DESC LIMIT 5"),
        env.DB.prepare("SELECT id,name,message,created_at FROM contacts WHERE status='new' ORDER BY created_at DESC,id DESC LIMIT 5"),
        env.DB.prepare("SELECT id,title,scheduled_at FROM broadcasts WHERE status='draft' AND scheduled_at>? ORDER BY scheduled_at ASC,id ASC LIMIT 5").bind(stamp()),
        env.DB.prepare("SELECT a.id,a.action,a.target_type,a.target_id,a.created_at,u.display_name actor FROM admin_audit_log a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC,a.id DESC LIMIT 8"),
      ]);
      return json({counts:Object.fromEntries(['members','pendingProjects','openForms','newContacts','activeTeams','scheduledBroadcasts'].map((key,i)=>[key,Number((counts[i].results[0]as Row)?.n||0)])),pendingProjects:previews[0].results,contacts:previews[1].results,broadcasts:previews[2].results,activity:previews[3].results});
    }
    if (path==='/api/admin/members' && method==='GET') {
      const where:string[]=[],args:any[]=[],q=clean(url.searchParams.get('q'),100);
      if (q) { where.push(`(${match('u.display_name')} OR ${match('u.english_name')} OR ${match('u.chinese_name')} OR ${match('u.class_grade')})`); args.push(...Array(4).fill(like(q))); }
      if (['member','non-member','maintainer','club-leader','teacher'].includes(url.searchParams.get('role')||'')) {where.push('u.role=?');args.push(url.searchParams.get('role'));}
      if (['active','suspended','archived'].includes(url.searchParams.get('status')||'')) {where.push('u.status=?');args.push(url.searchParams.get('status'));}
      if (url.searchParams.get('class')) {where.push(match('u.class_grade'));args.push(like(clean(url.searchParams.get('class'),80)));}
      return json(await listed(env,'SELECT u.id,u.display_name,u.english_name,u.chinese_name,u.class_grade,u.role,u.status,u.public_slug,u.created_at,u.is_initial_leader','FROM users u',where,args,url.searchParams.get('sort')==='name'?'u.display_name COLLATE NOCASE ASC,u.id ASC':'u.created_at DESC,u.id DESC',url));
    }
    const member=path.match(/^\/api\/admin\/members\/([^/]+)$/);
    if (member && method==='GET') {
      const key=decodeURIComponent(member[1]);
      const record=requireRow(await env.DB.prepare('SELECT id,display_name,english_name,chinese_name,class_grade,role,status,public_slug,bio,created_at,updated_at,is_initial_leader FROM users WHERE id=?').bind(key).first<Row>(),'Member');
      const [teams,projects,history]=await env.DB.batch([
        env.DB.prepare("SELECT t.id,t.name,t.slug,t.status,m.role FROM team_members m JOIN teams t ON t.id=m.team_id WHERE m.user_id=? AND m.status='active' ORDER BY t.name COLLATE NOCASE").bind(key),
        env.DB.prepare('SELECT id,title,slug,status,visibility FROM projects WHERE owner_user_id=? ORDER BY updated_at DESC,id DESC LIMIT 50').bind(key),
        env.DB.prepare("SELECT action,details_json,created_at FROM admin_audit_log WHERE target_type='user' AND target_id=? ORDER BY created_at DESC,id DESC LIMIT 50").bind(key),
      ]);
      return json({member:record,teams:teams.results,projects:projects.results,history:history.results,notes:await noteList(env,'user',key)});
    }
    if (path==='/api/admin/audit' && method==='GET') {
      if (!leader(user)) return fail('Only club leaders and teachers can view the audit log.',403);
      const where:string[]=[],args:any[]=[];
      if (url.searchParams.get('type')) {where.push('a.target_type=?');args.push(clean(url.searchParams.get('type'),40));}
      if (url.searchParams.get('actor')) {where.push('a.actor_user_id=?');args.push(clean(url.searchParams.get('actor'),100));}
      return json(await listed(env,'SELECT a.id,a.action,a.target_type,a.target_id,a.details_json,a.created_at,u.display_name actor','FROM admin_audit_log a LEFT JOIN users u ON u.id=a.actor_user_id',where,args,'a.created_at DESC,a.id DESC',url));
    }
    if(path==='/api/admin/staff' && method==='GET'){
      const rows=await env.DB.prepare("SELECT id,display_name,role FROM users WHERE status='active' AND role IN ('maintainer','club-leader','teacher') ORDER BY display_name COLLATE NOCASE,id").all<Row>();
      return json({staff:rows.results});
    }
    const notes=path.match(/^\/api\/admin\/notes\/(user|form-response|contact|team|project)\/([^/]+)$/);
    if (notes) {
      const type=notes[1],target=decodeURIComponent(notes[2]);
      if (type==='form-response' && !leader(user)) return fail('Only club leaders and teachers can view form responses.',403);
      if (method==='GET') return json({notes:await noteList(env,type,target)});
      if (method==='POST') { const content=clean(body.body,2000);if (!content) throw new AdminError('Enter a note.');await env.DB.prepare('INSERT INTO staff_notes(id,subject_type,subject_id,author_user_id,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(uid(),type,target,user.id,content,stamp(),stamp()).run();await audit(env,user,'note.add',type,target);return json({ok:true},{status:201}); }
    }
    if (path==='/api/admin/forms' && method==='GET') {
      if (!leader(user)) return fail('Only club leaders and teachers manage forms.',403);
      const where:string[]=[],args:any[]=[],q=clean(url.searchParams.get('q'),100);
      if (q) {where.push(match('f.title'));args.push(like(q));}
      if (['draft','published','closed','archived'].includes(url.searchParams.get('status')||'')) {where.push('f.status=?');args.push(url.searchParams.get('status'));}
      const result=await listed(env,'SELECT f.id,f.slug,f.title,f.description,f.status,f.access,f.opens_at,f.closes_at,f.created_at,f.updated_at,(SELECT COUNT(*) FROM form_responses r WHERE r.form_id=f.id AND r.status=\'submitted\') response_count','FROM forms f',where,args,'f.updated_at DESC,f.id DESC',url);
      return json({...result,forms:result.items});
    }
    if(path==='/api/admin/forms' && method==='POST'){
      if(!leader(user))return fail('Only club leaders and teachers manage forms.',403);
      const title=clean(body.title,150);if(!title)throw new AdminError('Form title is required.');
      const schema=body.schema&&typeof body.schema==='object'?body.schema:{sections:[{id:'main',title:'',fields:[]}]};
      if(formFields(schema).length)validateFormSchema(schema);
      const opens=localDate(body.opensAt),closes=localDate(body.closesAt);
      if(opens&&closes&&opens>=closes)throw new AdminError('Closing time must follow opening time.');
      const id=uid(),revisionId=uid(),time=stamp(),slug=title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,56)+'-'+id.slice(0,8);
      await env.DB.batch([
        env.DB.prepare("INSERT INTO forms(id,slug,title,description,status,access,created_by_user_id,opens_at,closes_at,created_at,updated_at) VALUES(?,?,?,?,'draft',?,?,?,?,?,?)").bind(id,slug,title,clean(body.description,1000),['public','members','staff'].includes(body.access)?body.access:'public',user.id,opens,closes,time,time),
        env.DB.prepare('INSERT INTO form_revisions(id,form_id,revision_number,schema_json,created_by_user_id,created_at) VALUES(?,?,1,?,?,?)').bind(revisionId,id,JSON.stringify(schema),user.id,time),
      ]);
      await audit(env,user,'form.create','form',id);return json({ok:true,form:{id,slug,revisionId}},{status:201});
    }
    const form=path.match(/^\/api\/admin\/forms\/([^/]+)$/);
    if (form && ['GET','PUT'].includes(method)) {
      if (!leader(user)) return fail('Only club leaders and teachers manage forms.',403);
      const key=decodeURIComponent(form[1]);
      const record=requireRow(await env.DB.prepare('SELECT * FROM forms WHERE id=?').bind(key).first<Row>(),'Form');
      if (method==='GET') {
        const revisions=await env.DB.prepare('SELECT id,revision_number,schema_json,created_at,published_at FROM form_revisions WHERE form_id=? ORDER BY revision_number DESC LIMIT 30').bind(key).all<Row>();
        return json({form:record,revision:revisions.results[0]?{...revisions.results[0],schema:JSON.parse(revisions.results[0].schema_json)}:null,revisions:revisions.results.map(r=>({id:r.id,revisionNumber:r.revision_number,createdAt:r.created_at,publishedAt:r.published_at})),notes:await noteList(env,'form',key)});
      }
      if (record.status==='archived') throw new AdminError('Restore this form before editing it.',409);
      if (!body.schema) throw new AdminError('The form schema is required.');
      validateFormSchema(body.schema);
      const opens=body.opensAt===undefined?record.opens_at:localDate(body.opensAt), closes=body.closesAt===undefined?record.closes_at:localDate(body.closesAt);
      if (opens&&closes&&opens>=closes) throw new AdminError('Closing time must follow opening time.');
      const title=clean(body.title??record.title,150);if (!title) throw new AdminError('Form title is required.');
      const access=['public','members','staff'].includes(body.access)?body.access:record.access;
      const latest=await env.DB.prepare('SELECT COALESCE(MAX(revision_number),0) n FROM form_revisions WHERE form_id=?').bind(key).first<Row>();
      const revisionId=uid(),time=stamp();
      await env.DB.batch([
        env.DB.prepare('UPDATE forms SET title=?,description=?,access=?,opens_at=?,closes_at=?,updated_at=? WHERE id=?').bind(title,clean(body.description??record.description,1000),access,opens,closes,time,key),
        env.DB.prepare('INSERT INTO form_revisions(id,form_id,revision_number,schema_json,created_by_user_id,created_at) VALUES(?,?,?,?,?,?)').bind(revisionId,key,Number(latest?.n||0)+1,JSON.stringify(body.schema),user.id,time),
      ]);
      await audit(env,user,'form.edit','form',key,{revisionId});return json({ok:true,revisionId});
    }
    const formRevision=path.match(/^\/api\/admin\/forms\/([^/]+)\/revisions\/([^/]+)$/);
    if(formRevision && method==='GET'){
      if(!leader(user))return fail('Only club leaders and teachers can preview form revisions.',403);
      const revision=requireRow(await env.DB.prepare('SELECT id,revision_number,schema_json,published_at FROM form_revisions WHERE form_id=? AND id=?').bind(decodeURIComponent(formRevision[1]),decodeURIComponent(formRevision[2])).first<Row>(),'Revision');
      return json({revision:{id:revision.id,revisionNumber:revision.revision_number,publishedAt:revision.published_at,schema:JSON.parse(revision.schema_json)}});
    }
    const formAction=path.match(/^\/api\/admin\/forms\/([^/]+)\/(publish|close|reopen|archive|restore)$/);
    if (formAction && method==='POST') {
      if (!leader(user)) return fail('Only club leaders and teachers manage forms.',403);
      const key=decodeURIComponent(formAction[1]),action=formAction[2];
      const record=requireRow(await env.DB.prepare('SELECT * FROM forms WHERE id=?').bind(key).first<Row>(),'Form');
      if (action==='restore') {if(record.status!=='archived')throw new AdminError('Form is not archived.',409);await env.DB.prepare("UPDATE forms SET status='draft',updated_at=? WHERE id=?").bind(stamp(),key).run();}
      else if (action==='archive') {if(record.status==='archived')throw new AdminError('Form is already archived.',409);await env.DB.prepare("UPDATE forms SET status='archived',updated_at=? WHERE id=?").bind(stamp(),key).run();}
      else if (action==='close') {if(record.status!=='published')throw new AdminError('Only a published form can be closed.',409);await env.DB.prepare("UPDATE forms SET status='closed',updated_at=? WHERE id=?").bind(stamp(),key).run();}
      else if (action==='reopen') {if(record.status!=='closed'||!record.published_revision_id)throw new AdminError('Publish a revision before reopening.',409);await env.DB.prepare("UPDATE forms SET status='published',updated_at=? WHERE id=?").bind(stamp(),key).run();}
      else {
        if(record.status==='archived')throw new AdminError('Restore this form first.',409);
        const revision=requireRow(await env.DB.prepare('SELECT id,schema_json FROM form_revisions WHERE form_id=? ORDER BY revision_number DESC LIMIT 1').bind(key).first<Row>(),'Revision');
        validateFormSchema(JSON.parse(revision.schema_json));
        const time=stamp();await env.DB.batch([
          env.DB.prepare('UPDATE form_revisions SET published_at=? WHERE id=?').bind(time,revision.id),
          env.DB.prepare("UPDATE forms SET status='published',published_revision_id=?,updated_at=? WHERE id=?").bind(revision.id,time,key),
        ]);
      }
      await audit(env,user,`form.${action}`,'form',key);return json({ok:true});
    }
    const formResponses=path.match(/^\/api\/admin\/forms\/([^/]+)\/responses$/);
    if (formResponses && method==='GET') {
      if (!leader(user)) return fail('Only club leaders and teachers can view responses.',403);
      const key=decodeURIComponent(formResponses[1]);
      const record=requireRow(await env.DB.prepare('SELECT id,title,slug FROM forms WHERE id=?').bind(key).first<Row>(),'Form');
      const reviewed=['yes','no'].includes(url.searchParams.get('reviewed')||'')?url.searchParams.get('reviewed'):null;
      const filter=reviewed==='yes'?' AND reviewed_at IS NOT NULL':reviewed==='no'?' AND reviewed_at IS NULL':'';
      const count=await env.DB.prepare(`SELECT COUNT(*) n FROM form_responses WHERE form_id=? AND status='submitted'${filter}`).bind(key).first<Row>();
      if (url.searchParams.get('format')==='csv') {
        const revisions=await env.DB.prepare('SELECT id,revision_number,schema_json FROM form_revisions WHERE form_id=? ORDER BY revision_number ASC').bind(key).all<Row>();
        const fieldMap=new Map<string,string>();for(const rev of revisions.results)for(const field of formFields(JSON.parse(rev.schema_json)))fieldMap.set(field.id,field.label);
        const fields=[...fieldMap.entries()],lines=[['Submitted','Respondent','Revision',...fields.map(f=>f[1])].map(csvCell).join(',')];
        for(let offset=0;offset<Number(count?.n||0);offset+=100) {
          const batch=await responseRows(env,key,Math.floor(offset/100)+1,100,reviewed);
          const answers=await responseAnswers(env,batch.results.map(r=>r.id));
          for(const row of batch.results) lines.push([row.submitted_at,row.respondent||'Anonymous',revisions.results.find(r=>r.id===row.revision_id)?.revision_number||'',...fields.map(f=>answers.get(row.id)?.[f[0]])].map(csvCell).join(','));
        }
        return new Response('\uFEFF'+lines.join('\r\n'),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="${record.slug}-responses.csv"`,'cache-control':'no-store'}});
      }
      const page=pageOf(url),limit=limitOf(url),rows=await responseRows(env,key,page,limit,reviewed);
      return json({items:rows.results,total:Number(count?.n||0),page,limit,hasMore:page*limit<Number(count?.n||0)});
    }
    const oneResponse=path.match(/^\/api\/admin\/forms\/([^/]+)\/responses\/([^/]+)$/);
    if (oneResponse && ['GET','PUT'].includes(method)) {
      if (!leader(user)) return fail('Only club leaders and teachers can view responses.',403);
      const formId=decodeURIComponent(oneResponse[1]),responseId=decodeURIComponent(oneResponse[2]);
      const row=requireRow(await env.DB.prepare('SELECT fr.*,u.display_name respondent,r.revision_number,r.schema_json FROM form_responses fr JOIN form_revisions r ON r.id=fr.revision_id LEFT JOIN users u ON u.id=fr.respondent_user_id WHERE fr.form_id=? AND fr.id=?').bind(formId,responseId).first<Row>(),'Response');
      if(method==='PUT') {const reviewed=body.reviewed===true?stamp():null;await env.DB.prepare('UPDATE form_responses SET reviewed_at=?,reviewed_by_user_id=?,updated_at=? WHERE id=?').bind(reviewed,reviewed?user.id:null,stamp(),responseId).run();await audit(env,user,reviewed?'response.review':'response.unreview','form-response',responseId);return json({ok:true});}
      return json({response:{...row,schema:JSON.parse(row.schema_json),answers:(await responseAnswers(env,[responseId])).get(responseId)||{}},notes:await noteList(env,'form-response',responseId)});
    }
    if (path==='/api/admin/projects' && method==='GET') {
      const where:string[]=[],args:any[]=[],q=clean(url.searchParams.get('q'),100);
      if (q) {where.push(`(${match('p.title')} OR ${match('u.display_name')})`);args.push(like(q),like(q));}
      if (['draft','submitted','changes-requested','approved','published','archived'].includes(url.searchParams.get('status')||'')) {where.push('p.status=?');args.push(url.searchParams.get('status'));}
      if (url.searchParams.get('team')) {where.push('p.team_id=?');args.push(clean(url.searchParams.get('team'),100));}
      return json(await listed(env,'SELECT p.id,p.slug,p.title,p.summary,p.status,p.visibility,p.submitted_at,p.updated_at,u.display_name owner_name,t.name team_name','FROM projects p JOIN users u ON u.id=p.owner_user_id LEFT JOIN teams t ON t.id=p.team_id',where,args,'p.updated_at DESC,p.id DESC',url));
    }
    const project=path.match(/^\/api\/admin\/projects\/([^/]+)$/);
    if (project && method==='GET') {
      const key=decodeURIComponent(project[1]);
      const row=requireRow(await env.DB.prepare('SELECT p.*,u.display_name owner_name,u.public_slug owner_slug,t.name team_name FROM projects p JOIN users u ON u.id=p.owner_user_id LEFT JOIN teams t ON t.id=p.team_id WHERE p.id=? OR p.slug=?').bind(key,key).first<Row>(),'Project');
      const history=await env.DB.prepare("SELECT a.action,a.details_json,a.created_at,u.display_name actor FROM admin_audit_log a LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.target_type='project' AND a.target_id=? ORDER BY a.created_at DESC,a.id DESC LIMIT 50").bind(row.id).all<Row>();
      return json({project:{...row,coverUrl:row.cover_image_key?`/api/projects/${row.id}/cover`:null,contentHtml:renderGithubReadme(row.content_markdown,{rawBase:`${url.origin}/`,webBase:`${url.origin}/`})},history:history.results,notes:await noteList(env,'project',row.id)});
    }
    const moderation=path.match(/^\/api\/admin\/projects\/([^/]+)\/status$/);
    if (moderation && method==='PUT') {
      const key=decodeURIComponent(moderation[1]);
      const row=requireRow(await env.DB.prepare('SELECT id,title,status,owner_user_id FROM projects WHERE id=?').bind(key).first<Row>(),'Project');
      const next=clean(body.status,30),note=clean(body.note,2000);
      const allowed:Row={submitted:['changes-requested','approved','published'],approved:['changes-requested','published'],published:['archived'], 'changes-requested':['approved','published','archived']};
      if (!allowed[row.status]?.includes(next)) throw new AdminError('This project cannot move to that status.',409);
      if (next==='changes-requested'&&!note) throw new AdminError('Explain the requested changes.');
      const time=stamp();await env.DB.batch([
        env.DB.prepare("UPDATE projects SET status=?,moderation_notes=?,moderated_by_user_id=?,moderated_at=?,published_at=CASE WHEN ?='published' THEN ? ELSE published_at END,updated_at=? WHERE id=?").bind(next,note,user.id,time,next,time,time,row.id),
        env.DB.prepare('INSERT INTO admin_audit_log(id,actor_user_id,action,target_type,target_id,details_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(uid(),user.id,'project.status','project',row.id,JSON.stringify({before:row.status,after:next,note}),time),
        env.DB.prepare("INSERT INTO notifications(id,recipient_user_id,type,actor_user_id,title,body,action_url,related_type,related_id,created_at) VALUES(?,?,'project-status',?,?,?,?, 'project',?,?)").bind(uid(),row.owner_user_id,user.id,`Project ${next}`,note||`${row.title} is now ${next}.`,`/projects/${encodeURIComponent(row.id)}`,row.id,time),
      ]);return json({ok:true});
    }
    if (path==='/api/admin/teams' && method==='GET') {
      const where:string[]=[],args:any[]=[],q=clean(url.searchParams.get('q'),100);
      if(q){where.push(`(${match('t.name')} OR ${match('u.display_name')})`);args.push(like(q),like(q));}
      if(['active','archived'].includes(url.searchParams.get('status')||'')){where.push('t.status=?');args.push(url.searchParams.get('status'));}
      return json(await listed(env,'SELECT t.id,t.slug,t.name,t.description,t.status,t.updated_at,u.display_name owner_name,(SELECT COUNT(*) FROM team_members m WHERE m.team_id=t.id AND m.status=\'active\') member_count,(SELECT COUNT(*) FROM projects p WHERE p.team_id=t.id AND p.status!=\'archived\') project_count','FROM teams t JOIN users u ON u.id=t.owner_user_id',where,args,'t.updated_at DESC,t.id DESC',url));
    }
    const team=path.match(/^\/api\/admin\/teams\/([^/]+)$/);
    if(team && ['GET','PUT'].includes(method)) {
      const key=decodeURIComponent(team[1]);
      const record=requireRow(await env.DB.prepare('SELECT t.*,u.display_name owner_name FROM teams t JOIN users u ON u.id=t.owner_user_id WHERE t.id=? OR t.slug=?').bind(key,key).first<Row>(),'Team');
      if(method==='GET'){
        const [members,invitations,projects,history]=await env.DB.batch([
          env.DB.prepare("SELECT m.user_id,m.role,m.joined_at,u.display_name,u.public_slug FROM team_members m JOIN users u ON u.id=m.user_id WHERE m.team_id=? AND m.status='active' ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,u.display_name COLLATE NOCASE").bind(record.id),
          env.DB.prepare("SELECT i.id,i.status,i.role,i.message,i.expires_at,u.display_name invited_name FROM team_invitations i JOIN users u ON u.id=i.invited_user_id WHERE i.team_id=? ORDER BY i.created_at DESC LIMIT 50").bind(record.id),
          env.DB.prepare('SELECT id,slug,title,status,visibility,owner_user_id FROM projects WHERE team_id=? ORDER BY updated_at DESC,id DESC LIMIT 50').bind(record.id),
          env.DB.prepare("SELECT a.action,a.details_json,a.created_at,u.display_name actor FROM admin_audit_log a LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.target_type='team' AND a.target_id=? ORDER BY a.created_at DESC LIMIT 50").bind(record.id),
        ]);
        return json({team:{...record,avatarUrl:record.avatar_image_key?`/api/teams/${record.id}/avatar`:null,introductionHtml:renderGithubReadme(record.introduction_markdown,{rawBase:`${url.origin}/`,webBase:`${url.origin}/`})},members:members.results,invitations:invitations.results,projects:projects.results,history:history.results,notes:await noteList(env,'team',record.id)});
      }
      if(!leader(user)) return fail('Only club leaders and teachers manage teams.',403);
      if(record.status==='archived') throw new AdminError('Restore this team before editing it.',409);
      const name=clean(body.name??record.name,80);if(!name)throw new AdminError('Team name is required.');
      const site=body.websiteUrl===undefined?record.website_url:urlValue(body.websiteUrl);
      await env.DB.prepare('UPDATE teams SET name=?,description=?,introduction_markdown=?,website_url=?,updated_at=? WHERE id=?').bind(name,clean(body.description??record.description,300),clean(body.introductionMarkdown??record.introduction_markdown,50000),site,stamp(),record.id).run();
      await audit(env,user,'team.edit','team',record.id,{name});await notify(env,user,record.owner_user_id,'team-update','Team details updated',`${user.display_name} updated ${name}.`,`/teams/${record.slug}`,record.id);return json({ok:true});
    }
    const teamAvatar=path.match(/^\/api\/admin\/teams\/([^/]+)\/avatar$/);
    if(teamAvatar && ['POST','DELETE'].includes(method)) {
      if(!leader(user)) return fail('Only club leaders and teachers manage teams.',403);
      const record=requireRow(await env.DB.prepare('SELECT id,owner_user_id,slug,status FROM teams WHERE id=?').bind(decodeURIComponent(teamAvatar[1])).first<Row>(),'Team');
      if(record.status==='archived')throw new AdminError('Restore this team first.',409);
      const key=`teams/${record.id}/avatar`;
      if(method==='POST'){
        const found=String(body.dataUrl||'').match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
        if(!found)throw new AdminError('Upload a PNG, JPEG, or WebP image.');
        const bytes=Uint8Array.from(atob(found[2]),c=>c.charCodeAt(0));
        if(bytes.length>2_000_000||bytes.length<16)throw new AdminError('Image must be under 2 MB.');
        if((found[1]==='image/png' && !(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)) || (found[1]==='image/jpeg'&&!(bytes[0]===255&&bytes[1]===216)) || (found[1]==='image/webp'&&String.fromCharCode(...bytes.slice(0,4))!=='RIFF'))throw new AdminError('Image data does not match its type.');
        await env.PROFILE_IMAGES.put(key,bytes,{httpMetadata:{contentType:found[1]}});
        await env.DB.prepare('UPDATE teams SET avatar_image_key=?,updated_at=? WHERE id=?').bind(key,stamp(),record.id).run();
      }else{await env.PROFILE_IMAGES.delete(key);await env.DB.prepare('UPDATE teams SET avatar_image_key=NULL,updated_at=? WHERE id=?').bind(stamp(),record.id).run();}
      await audit(env,user,method==='POST'?'team.avatar-upload':'team.avatar-remove','team',record.id);return json({ok:true});
    }
    const teamAction=path.match(/^\/api\/admin\/teams\/([^/]+)\/(archive|restore|transfer)$/);
    if(teamAction && method==='POST') {
      if(!leader(user))return fail('Only club leaders and teachers manage teams.',403);
      const key=decodeURIComponent(teamAction[1]),action=teamAction[2];
      const record=requireRow(await env.DB.prepare('SELECT id,name,slug,status,owner_user_id FROM teams WHERE id=?').bind(key).first<Row>(),'Team');
      const reason=clean(body.reason,500);
      if(action==='transfer'){
        if(record.status!=='active')throw new AdminError('Restore this team first.',409);
        const target=requireRow(await env.DB.prepare("SELECT m.user_id FROM team_members m JOIN users u ON u.id=m.user_id WHERE m.team_id=? AND m.user_id=? AND m.status='active' AND u.status='active'").bind(key,clean(body.userId,100)).first<Row>(),'Active team member');
        if(target.user_id===record.owner_user_id)throw new AdminError('That member already owns the team.',409);
        await env.DB.batch([
          env.DB.prepare('UPDATE teams SET owner_user_id=?,updated_at=? WHERE id=?').bind(target.user_id,stamp(),key),
          env.DB.prepare("UPDATE team_members SET role='admin',updated_at=? WHERE team_id=? AND user_id=? AND role='owner'").bind(stamp(),key,record.owner_user_id),
          env.DB.prepare("UPDATE team_members SET role='owner',updated_at=? WHERE team_id=? AND user_id=?").bind(stamp(),key,target.user_id),
        ]);
        await notify(env,user,target.user_id,'team-update','You now own a team',`You are now the owner of ${record.name}.`,`/teams/${record.slug}`,key);
      } else {
        if((action==='archive'&&record.status==='archived')||(action==='restore'&&record.status==='active'))throw new AdminError('Team is already in that state.',409);
        await env.DB.prepare('UPDATE teams SET status=?,updated_at=? WHERE id=?').bind(action==='archive'?'archived':'active',stamp(),key).run();
      }
      await audit(env,user,`team.${action}`,'team',key,{reason,...(action==='transfer'?{newOwner:body.userId}:{})});
      await notify(env,user,record.owner_user_id,'team-update',`Team ${action}`,reason||`${record.name} was ${action==='archive'?'archived':action==='restore'?'restored':'transferred'}.`,`/teams/${record.slug}`,key);
      return json({ok:true});
    }
    const teamMember=path.match(/^\/api\/admin\/teams\/([^/]+)\/members\/([^/]+)$/);
    if(teamMember && method==='PUT') {
      if(!leader(user))return fail('Only club leaders and teachers manage teams.',403);
      const key=decodeURIComponent(teamMember[1]),target=decodeURIComponent(teamMember[2]);
      const teamRow=requireRow(await env.DB.prepare('SELECT id,name,slug,status,owner_user_id FROM teams WHERE id=?').bind(key).first<Row>(),'Team');
      if(teamRow.status!=='active')throw new AdminError('Restore this team first.',409);
      const membership=requireRow(await env.DB.prepare("SELECT * FROM team_members WHERE team_id=? AND user_id=? AND status='active'").bind(key,target).first<Row>(),'Membership');
      if(membership.role==='owner')throw new AdminError('Transfer ownership before changing the owner.',409);
      let action:string;
      if(body.status==='removed'){action='remove';await env.DB.prepare("UPDATE team_members SET status='removed',updated_at=? WHERE id=?").bind(stamp(),membership.id).run();}
      else if(['member','admin'].includes(body.role)){action='role';await env.DB.prepare('UPDATE team_members SET role=?,updated_at=? WHERE id=?').bind(body.role,stamp(),membership.id).run();}
      else throw new AdminError('Choose a team role or remove the member.');
      await audit(env,user,`team.member-${action}`,'team',key,{memberId:target,role:body.role||null});await notify(env,user,target,'team-update','Team membership changed',`Your membership in ${teamRow.name} was updated.`,`/teams/${teamRow.slug}`,key);return json({ok:true});
    }
    const teamInvitations=path.match(/^\/api\/admin\/teams\/([^/]+)\/invitations(?:\/([^/]+))?$/);
    if(teamInvitations && ['POST','DELETE'].includes(method)) {
      if(!leader(user))return fail('Only club leaders and teachers manage teams.',403);
      const key=decodeURIComponent(teamInvitations[1]);
      const teamRow=requireRow(await env.DB.prepare('SELECT id,name,slug,status,owner_user_id FROM teams WHERE id=?').bind(key).first<Row>(),'Team');
      if(teamRow.status!=='active')throw new AdminError('Restore this team first.',409);
      if(method==='DELETE'){
        const target=decodeURIComponent(teamInvitations[2]||'');
        const invitation=requireRow(await env.DB.prepare("SELECT id,invited_user_id FROM team_invitations WHERE id=? AND team_id=? AND status='pending'").bind(target,key).first<Row>(),'Pending invitation');
        await env.DB.batch([
          env.DB.prepare("UPDATE team_invitations SET status='revoked',updated_at=? WHERE id=?").bind(stamp(),target),
          env.DB.prepare("UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE related_type='team-invitation' AND related_id=?").bind(stamp(),target),
        ]);
        await audit(env,user,'team.invitation-cancel','team',key,{invitationId:target});return json({ok:true});
      }
      const invited=requireRow(await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active'").bind(clean(body.userId,100)).first<Row>(),'Active member');
      const exists=await env.DB.prepare("SELECT id FROM team_members WHERE team_id=? AND user_id=? AND status='active'").bind(key,invited.id).first<Row>();
      if(exists)throw new AdminError('That person already belongs to the team.',409);
      const time=stamp(),inviteId=uid(),expires=new Date(Date.now()+7*86400000).toISOString();
      try{await env.DB.batch([
        env.DB.prepare("UPDATE team_invitations SET status='expired',updated_at=? WHERE team_id=? AND invited_user_id=? AND status='pending' AND expires_at<=?").bind(time,key,invited.id,time),
        env.DB.prepare("INSERT INTO team_invitations(id,team_id,invited_user_id,invited_by_user_id,role,status,message,expires_at,created_at,updated_at) VALUES(?,?,?,?,'member','pending',?,?,?,?)").bind(inviteId,key,invited.id,user.id,clean(body.message,300),expires,time,time),
        env.DB.prepare("INSERT INTO notifications(id,recipient_user_id,type,actor_user_id,title,body,action_url,related_type,related_id,expires_at,created_at) VALUES(?,?,'team-invitation',?,?,?,?, 'team-invitation',?,?,?)").bind(uid(),invited.id,user.id,`Invitation to ${teamRow.name}`,clean(body.message,300)||`${user.display_name} invited you to join.`,`/teams?tab=invitations`,inviteId,expires,time),
      ]);}catch(error){if(String(error).includes('UNIQUE'))throw new AdminError('A pending invitation already exists.',409);throw error;}
      await audit(env,user,'team.invite','team',key,{invitedUserId:invited.id});return json({ok:true},{status:201});
    }
    if(path==='/api/admin/broadcasts' && method==='GET') {
      if(!leader(user))return fail('Only club leaders and teachers manage broadcasts.',403);
      const where:string[]=[],args:any[]=[],q=clean(url.searchParams.get('q'),100);
      if(q){where.push(match('b.title'));args.push(like(q));}
      const state=url.searchParams.get('status');
      if(state==='scheduled')where.push("b.status='draft' AND b.scheduled_at IS NOT NULL AND b.send_started_at IS NULL");
      else if(state==='draft')where.push("b.status='draft' AND b.scheduled_at IS NULL AND b.send_started_at IS NULL");
      else if(state==='sending')where.push("b.send_started_at IS NOT NULL AND b.send_completed_at IS NULL");
      else if(['sent','cancelled'].includes(state||'')){where.push('b.status=?');args.push(state);}
      return json(await listed(env,'SELECT b.id,b.title,b.body,b.status,b.audience_type,b.audience_value,b.scheduled_at,b.send_started_at,b.send_completed_at,b.recipient_total,b.created_at,b.updated_at,(SELECT COUNT(*) FROM broadcast_deliveries d WHERE d.broadcast_id=b.id AND d.status=\'delivered\') delivered_count,(SELECT COUNT(*) FROM broadcast_deliveries d WHERE d.broadcast_id=b.id AND d.status=\'failed\') failed_count','FROM broadcasts b',where,args,'b.created_at DESC,b.id DESC',url));
    }
    if(path==='/api/admin/broadcasts/preview' && method==='POST'){
      if(!leader(user))return fail('Only club leaders and teachers manage broadcasts.',403);
      const input=broadcastInput(body);
      const result=await env.DB.prepare(`SELECT COUNT(*) n FROM users WHERE status='active'${input.audienceType==='role'?' AND role=?':''}`).bind(...(input.audienceType==='role'?[input.audienceValue]:[])).first<Row>();
      return json({count:Number(result?.n||0),title:input.title,body:input.message,audienceType:input.audienceType,audienceValue:input.audienceValue,actionUrl:input.actionUrl});
    }
    if((path==='/api/admin/broadcasts/drafts' || path==='/api/admin/broadcasts') && method==='POST') {
      if(!leader(user))return fail('Only club leaders and teachers manage broadcasts.',403);
      const input=broadcastInput(body),id=uid(),time=stamp();
      await env.DB.prepare("INSERT INTO broadcasts(id,created_by_user_id,title,body,action_url,audience_type,audience_value,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'draft',?,?)").bind(id,user.id,input.title,input.message,input.actionUrl,input.audienceType,input.audienceValue,time,time).run();
      await audit(env,user,'broadcast.draft','broadcast',id);
      if(path==='/api/admin/broadcasts') {await processBroadcast(env,id,true);const stats=await broadcastStats(env,id);return json({ok:true,id,delivered:stats.delivered,status:stats.delivered===stats.total?'sent':'sending'},{status:201});}
      return json({ok:true,id},{status:201});
    }
    const broadcast=path.match(/^\/api\/admin\/broadcasts\/([^/]+)$/);
    if(broadcast && ['GET','PUT'].includes(method)) {
      if(!leader(user))return fail('Only club leaders and teachers manage broadcasts.',403);
      const key=decodeURIComponent(broadcast[1]);
      const record=requireRow(await env.DB.prepare('SELECT b.*,u.display_name creator FROM broadcasts b JOIN users u ON u.id=b.created_by_user_id WHERE b.id=?').bind(key).first<Row>(),'Broadcast');
      if(method==='GET')return json({broadcast:record,deliveries:await broadcastStats(env,key)});
      if(record.status!=='draft'||record.send_started_at)throw new AdminError('This broadcast can no longer be edited.',409);
      const input=broadcastInput(body,record);
      await env.DB.prepare('UPDATE broadcasts SET title=?,body=?,action_url=?,audience_type=?,audience_value=?,updated_at=? WHERE id=?').bind(input.title,input.message,input.actionUrl,input.audienceType,input.audienceValue,stamp(),key).run();
      await audit(env,user,'broadcast.edit','broadcast',key);return json({ok:true});
    }
    const broadcastAction=path.match(/^\/api\/admin\/broadcasts\/([^/]+)\/(schedule|send|cancel|retry)$/);
    if(broadcastAction && method==='POST') {
      if(!leader(user))return fail('Only club leaders and teachers manage broadcasts.',403);
      const key=decodeURIComponent(broadcastAction[1]),action=broadcastAction[2];
      const record=requireRow(await env.DB.prepare('SELECT * FROM broadcasts WHERE id=?').bind(key).first<Row>(),'Broadcast');
      if(action==='schedule'){
        if(record.status!=='draft'||record.send_started_at)throw new AdminError('This broadcast cannot be scheduled.',409);
        const when=localDate(body.scheduledAt);if(!when||Date.parse(when)<Date.now()+60000)throw new AdminError('Choose a time at least one minute from now.');
        await env.DB.prepare('UPDATE broadcasts SET scheduled_at=?,updated_at=? WHERE id=?').bind(when,stamp(),key).run();
        await audit(env,user,'broadcast.schedule','broadcast',key,{scheduledAt:when});return json({ok:true});
      }
      if(action==='cancel'){
        if(record.status!=='draft'||record.send_started_at)throw new AdminError('Sending has already begun.',409);
        await env.DB.prepare("UPDATE broadcasts SET status='cancelled',updated_at=? WHERE id=?").bind(stamp(),key).run();await audit(env,user,'broadcast.cancel','broadcast',key);return json({ok:true});
      }
      if(action==='retry'){
        if(!record.send_started_at)throw new AdminError('This broadcast has not started.',409);
        const failed=await env.DB.prepare("UPDATE broadcast_deliveries SET status='pending',claim_token=NULL,claim_at=NULL WHERE broadcast_id=? AND status='failed'").bind(key).run();
        if(!Number(failed.meta.changes||0))throw new AdminError('There are no failed deliveries to retry.',409);
        await env.DB.prepare("UPDATE broadcasts SET status='draft',send_completed_at=NULL,last_error=NULL,updated_at=? WHERE id=?").bind(stamp(),key).run();
        await audit(env,user,'broadcast.retry','broadcast',key,{count:failed.meta.changes});await processBroadcast(env,key,true);return json({ok:true,deliveries:await broadcastStats(env,key)});
      }
      if(record.status!=='draft'||record.send_started_at)throw new AdminError('This broadcast has already started.',409);
      await audit(env,user,'broadcast.send','broadcast',key);await processBroadcast(env,key,true);return json({ok:true,deliveries:await broadcastStats(env,key)});
    }
    const deliveries=path.match(/^\/api\/admin\/broadcasts\/([^/]+)\/deliveries$/);
    if(deliveries && method==='GET') {
      if(!leader(user))return fail('Only club leaders and teachers manage broadcasts.',403);
      const key=decodeURIComponent(deliveries[1]);requireRow(await env.DB.prepare('SELECT id FROM broadcasts WHERE id=?').bind(key).first<Row>(),'Broadcast');
      const where=['d.broadcast_id=?'],args:any[]=[key],state=url.searchParams.get('status');
      if(['pending','delivered','failed'].includes(state||'')){where.push('d.status=?');args.push(state);}
      return json(await listed(env,'SELECT d.id,d.status,d.delivered_at,u.display_name recipient','FROM broadcast_deliveries d JOIN users u ON u.id=d.recipient_user_id',where,args,'d.created_at DESC,d.id DESC',url));
    }
    if(path==='/api/admin/contacts' && method==='GET') {
      const where:string[]=[],args:any[]=[],q=clean(url.searchParams.get('q'),100);
      if(q){where.push(`(${match('c.name')} OR ${match('c.message')})`);args.push(like(q),like(q));}
      if(['new','in-progress','resolved'].includes(url.searchParams.get('status')||'')){where.push('c.status=?');args.push(url.searchParams.get('status'));}
      if(url.searchParams.get('assignee')){where.push('c.assigned_to_user_id=?');args.push(clean(url.searchParams.get('assignee'),100));}
      return json(await listed(env,'SELECT c.id,c.name,c.message,c.status,c.created_at,c.updated_at,c.resolved_at,c.assigned_to_user_id,u.display_name assignee','FROM contacts c LEFT JOIN users u ON u.id=c.assigned_to_user_id',where,args,'c.created_at DESC,c.id DESC',url));
    }
    const contact=path.match(/^\/api\/admin\/contacts\/([^/]+)$/);
    if(contact && ['GET','PUT'].includes(method)) {
      const key=decodeURIComponent(contact[1]);
      const record=requireRow(await env.DB.prepare('SELECT c.*,u.display_name assignee FROM contacts c LEFT JOIN users u ON u.id=c.assigned_to_user_id WHERE c.id=?').bind(key).first<Row>(),'Contact');
      if(method==='GET')return json({contact:record,notes:await noteList(env,'contact',key),history:(await env.DB.prepare("SELECT a.action,a.details_json,a.created_at,u.display_name actor FROM admin_audit_log a LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.target_type='contact' AND a.target_id=? ORDER BY a.created_at DESC,a.id DESC LIMIT 50").bind(key).all<Row>()).results});
      const status=body.status===undefined?record.status:clean(body.status,30);
      if(!['new','in-progress','resolved'].includes(status))throw new AdminError('Choose New, In progress, or Resolved.');
      const assignee=body.assignedTo===undefined?record.assigned_to_user_id:(body.assignedTo?clean(body.assignedTo,100):null);
      if(assignee){const valid=await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active' AND role IN ('maintainer','club-leader','teacher')").bind(assignee).first<Row>();if(!valid)throw new AdminError('Assign an active staff member.');}
      if(!leader(user) && assignee && assignee!==user.id && assignee!==record.assigned_to_user_id)throw new AdminError('Only leaders and teachers can assign another staff member.',403);
      await env.DB.prepare('UPDATE contacts SET status=?,assigned_to_user_id=?,resolved_at=?,updated_at=? WHERE id=?').bind(status,assignee,status==='resolved'?(record.resolved_at||stamp()):null,stamp(),key).run();
      await audit(env,user,'contact.update','contact',key,{before:record.status,after:status,assignee});
      if(assignee&&assignee!==record.assigned_to_user_id)await notify(env,user,assignee,'contact-assigned','A contact was assigned to you',record.name,`/admin/contacts/${key}`,key);
      return json({ok:true});
    }
    if(path==='/api/admin/settings' && method==='GET') {
      const current=await env.DB.prepare("SELECT value FROM site_settings WHERE key='competition_active'").first<Row>();
      const cards=await env.DB.prepare("SELECT status,COUNT(*) count FROM nfc_cards GROUP BY status").all<Row>();
      return json({competitionActive:(current?.value||env.COMPETITION_ACTIVE||'false')==='true',cards:Object.fromEntries(cards.results.map(r=>[r.status,Number(r.count)])),canChangeCompetition:Boolean(user.is_initial_leader)});
    }
    if(path==='/api/admin/settings' && method==='PUT') {
      if(!user.is_initial_leader)return fail('Only the initial club leader can change competition settings.',403);
      if(typeof body.competitionActive!=='boolean')throw new AdminError('Choose a competition state.');
      await env.DB.prepare("INSERT OR REPLACE INTO site_settings(key,value) VALUES('competition_active',?)").bind(body.competitionActive?'true':'false').run();
      await audit(env,user,'settings.competition','site','competition_active',{active:body.competitionActive});return json({ok:true});
    }
    if(path==='/api/admin/nfc-cards' && method==='GET') {
      const where:string[]=[],args:any[]=[],q=clean(url.searchParams.get('q'),80);
      if(q){where.push(`(${match('c.label')} OR ${match('u.display_name')})`);args.push(like(q),like(q));}
      if(['unclaimed','claimed','disabled'].includes(url.searchParams.get('status')||'')){where.push('c.status=?');args.push(url.searchParams.get('status'));}
      return json(await listed(env,'SELECT c.id,c.label,c.status,c.claimed_at,c.scan_count,c.last_scanned_at,c.created_at,u.display_name owner_name,u.public_slug owner_slug','FROM nfc_cards c LEFT JOIN users u ON u.id=c.claimed_by_user_id',where,args,'c.created_at DESC,c.id DESC',url));
    }
    if(path==='/api/admin/nfc-cards' && method==='POST') {
      if(!leader(user))return fail('Only club leaders and teachers can issue NFC cards.',403);
      const count=Math.min(200,Math.max(1,Math.trunc(Number(body.count))||1));
      const cards:{label:string,url:string}[]=[],queries:D1PreparedStatement[]=[],time=stamp();
      for(let index=0;index<count;index++){
        const bytes=crypto.getRandomValues(new Uint8Array(18));
        const token=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');
        const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
        const hash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
        const label=`NFC-${time.replace(/\D/g,'').slice(-10)}-${uid().slice(0,6).toUpperCase()}`;
        cards.push({label,url:`${url.origin}/nfc/${token}`});
        queries.push(env.DB.prepare('INSERT INTO nfc_cards(id,label,token_hash,created_at,updated_at) VALUES(?,?,?,?,?)').bind(uid(),label,hash,time,time));
      }
      for(let offset=0;offset<queries.length;offset+=50)await env.DB.batch(queries.slice(offset,offset+50));
      await audit(env,user,'nfc.issue','nfc','batch',{count});return json({ok:true,cards},{status:201});
    }
    const nfc=path.match(/^\/api\/admin\/nfc-cards\/([^/]+)$/);
    if(nfc && method==='PUT') {
      if(!leader(user))return fail('Only club leaders and teachers can change NFC cards.',403);
      const key=decodeURIComponent(nfc[1]);
      const record=requireRow(await env.DB.prepare('SELECT id,status,claimed_by_user_id,label FROM nfc_cards WHERE id=?').bind(key).first<Row>(),'NFC card');
      if(!['disable','enable'].includes(body.action))throw new AdminError('Choose disable or enable.');
      if(body.action==='disable'&&record.status==='disabled')throw new AdminError('Card is already disabled.',409);
      if(body.action==='enable'&&record.status!=='disabled')throw new AdminError('Card is already enabled.',409);
      const next=body.action==='disable'?'disabled':record.claimed_by_user_id?'claimed':'unclaimed';
      await env.DB.prepare('UPDATE nfc_cards SET status=?,updated_at=? WHERE id=?').bind(next,stamp(),key).run();
      await audit(env,user,`nfc.${body.action}`,'nfc',key,{label:record.label,before:record.status,after:next});return json({ok:true,status:next});
    }
    return null;
  } catch(error) {
    if(error instanceof AdminError)return fail(error.message,error.status);
    console.error('Admin API error',error);
    return fail('Something went wrong. Please try again.',500);
  }
}

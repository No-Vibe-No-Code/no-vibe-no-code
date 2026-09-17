// Isolated, local-only integration tests. Never touches the configured remote D1/R2.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {pbkdf2Sync} from 'node:crypto';

const directory=await mkdtemp(join(tmpdir(),'nvnc-workspace-'));
const wrangler=resolve('node_modules/wrangler/bin/wrangler.js');
const cli=args=>execFileSync(process.execPath,[wrangler,...args],{stdio:'pipe',encoding:'utf8'});
const state=join(directory,'state'),port=Number(process.env.NVNC_WORKSPACE_PORT||8791),base=`http://localhost:${port}`;
assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535,'Choose an unprivileged local test port.');
const password='Workspace-Local-Only-2026!',salt='local-workspace-fixture';
const hash=salt+'.'+pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex');
const roles=['owner','admin','member','outsider','staff'],stamp='2026-09-01T12:00:00.000Z';
const sqlValue=value=>`'${String(value).replaceAll("'","''")}'`;
console.log('Preparing isolated D1 and R2:',directory);
cli(['d1','migrations','apply','no-vibe-no-code','--local','--persist-to',state]);
const seed=[];
for(const role of roles){seed.push(`INSERT INTO users(id,display_name,english_name,chinese_name,wechat_id,class_grade,role,password_hash,public_slug,bio,readme_published,terms_accepted_at,created_at,updated_at) VALUES('qa-${role}','QA ${role}','QA','测试','qa-local','Test',${sqlValue(role==='staff'?'maintainer':'member')},${sqlValue(hash)},'qa-${role}','Local browser fixture','## Building together\n\nA profile for local workspace testing.',${sqlValue(stamp)},${sqlValue(stamp)},${sqlValue(stamp)});`);seed.push(`INSERT INTO sessions VALUES('qa-session-${role}','qa-${role}','2099-01-01T00:00:00.000Z');`);}
seed.push(`INSERT INTO teams(id,slug,name,description,owner_user_id,created_at,updated_at,introduction_markdown) VALUES('qa-team','cloud-builders','Cloud Builders','Small experiments. Shared curiosity.','qa-owner',${sqlValue(stamp)},${sqlValue(stamp)},'# Cloud Builders\n\nWe make useful things for our school.');`);
for(const role of ['owner','admin','member'])seed.push(`INSERT INTO team_members VALUES('qa-membership-${role}','qa-team','qa-${role}','${role}','active',${sqlValue(stamp)},${sqlValue(stamp)});`);
for(let i=0;i<23;i++){const teamId='qa-archived-'+String(i).padStart(2,'0');seed.push(`INSERT INTO teams(id,slug,name,owner_user_id,status,created_at,updated_at) VALUES('${teamId}','${teamId}','Previous team ${i}','qa-owner','archived',${sqlValue(stamp)},${sqlValue(stamp)});`);seed.push(`INSERT INTO team_members VALUES('${teamId}-owner','${teamId}','qa-owner','owner','active',${sqlValue(stamp)},${sqlValue(stamp)});`);}
for(let i=0;i<27;i++){const num=String(i).padStart(2,'0');seed.push(`INSERT INTO projects(id,slug,title,summary,owner_user_id,team_id,content_markdown,status,visibility,labels_json,created_at,updated_at) VALUES('qa-project-${num}','qa-project-${num}','Build ${num}','A student-built experiment in making everyday things better.','qa-owner','qa-team','# Build ${num}\n\n## The idea\n\nA helpful experiment, built together.\n\n- Accessible by design\n- Made with curiosity','${i<3?'published':'draft'}','${i===0?'public':i===1?'members':'private'}','["web","school"]',${sqlValue(stamp)},${sqlValue(stamp)});`);}
for(let i=0;i<27;i++){seed.push(`INSERT INTO notifications(id,recipient_user_id,type,title,body,created_at) VALUES('qa-notice-${String(i).padStart(2,'0')}','qa-owner','broadcast','Club update ${i+1}','Our next building session is coming up. Bring an idea and a little curiosity.',${sqlValue(stamp)});`);}
seed.push(`INSERT INTO team_invitations(id,team_id,invited_user_id,invited_by_user_id,status,expires_at,created_at,updated_at) VALUES('qa-expired','qa-team','qa-outsider','qa-owner','pending','2020-01-01T00:00:00.000Z',${sqlValue(stamp)},${sqlValue(stamp)});`);
seed.push(`INSERT INTO notifications(id,recipient_user_id,type,title,body,related_type,related_id,action_url,created_at,expires_at) VALUES('qa-expired-notice','qa-outsider','team-invitation','An older invitation','This invitation has expired.','team-invitation','qa-expired','/home.html#teams',${sqlValue(stamp)},'2020-01-01T00:00:00.000Z');`);
const seedFile=join(directory,'seed.sql');await writeFile(seedFile,seed.join('\n'));cli(['d1','execute','no-vibe-no-code','--local','--persist-to',state,'--file',seedFile]);
const server=spawn(process.execPath,[wrangler,'dev','--local','--port',String(port),'--persist-to',state],{stdio:['ignore','pipe','pipe']});
let serverLog='';server.stdout.on('data',data=>serverLog+=data);server.stderr.on('data',data=>serverLog+=data);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let available=false;for(let i=0;i<80;i++){try{const response=await fetch(base+'/api/me');if(response.ok){available=true;break;}}catch{}await delay(250);}
if(!available){server.kill();throw new Error('Local worker did not start:\n'+serverLog);}
let assertions=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);assertions++;};
const ok=(value,label)=>{assert.ok(value,label);assertions++;};
async function api(path,role='owner',method='GET',data,expected=200){
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,'x-csrf-token':'qa-csrf',Cookie:`nvnc_csrf=qa-csrf${role?'; nvnc_session=qa-session-'+role:''}`},body:data===undefined?undefined:JSON.stringify(data)});
  const payload=await response.json();eq(response.status,expected,`${method} ${path}: ${JSON.stringify(payload).slice(0,240)}`);return payload;
}
try{
  for(const route of ['/projects','/projects/new','/projects/qa-project-00','/teams','/teams/new','/teams/cloud-builders','/notifications']){const response=await fetch(base+route);eq(response.status,200,route);ok((await response.text()).includes('workspace.js'),route+' shell');}
  eq((await api('/api/workspace/summary')).counts,{projects:27,teams:1,unread:27,invitations:0},'summary counts exceed a page');
  for(const sort of ['name','updated']){let next=null,ids=[];do{const result=await api(`/api/projects?mine=1&limit=7&sort=${sort}${next?'&cursor='+encodeURIComponent(next):''}`);eq(result.total,27);ids.push(...result.projects.map(p=>p.id));next=result.nextCursor;}while(next);eq(ids.length,27);eq(new Set(ids).size,27,'stable pagination tie-break');}
  for(const sort of ['name','updated']){let next=null,ids=[];do{const result=await api(`/api/teams?status=archived&limit=6&sort=${sort}${next?'&cursor='+encodeURIComponent(next):''}`);eq(result.total,23);ids.push(...result.teams.map(t=>t.id));next=result.nextCursor;}while(next);eq(ids.length,23);eq(new Set(ids).size,23,'stable team pagination');}
  {let next=null,ids=[];do{const result=await api(`/api/notifications?limit=8${next?'&cursor='+encodeURIComponent(next):''}`);eq(result.total,27);ids.push(...result.notifications.map(n=>n.id));next=result.nextCursor;}while(next);eq(new Set(ids).size,27,'stable notification pagination');}
  await api('/api/projects?cursor=invalid','owner','GET',undefined,400);
  eq((await api('/api/projects?mine=1&q=Build%200&label=web&team=qa-team')).total,10);
  eq((await api('/api/projects',null)).total,1);eq((await api('/api/projects','outsider')).total,2);
  await api('/api/projects/qa-project-03','member','GET',undefined,404);await api('/api/projects/qa-project-00','member','PUT',{title:'No'},403);
  await api('/api/projects/qa-project-03','staff');await api('/api/teams/qa-team','outsider','GET',undefined,404);await api('/api/teams/qa-team','staff');
  await api('/api/workspace/preferences','owner','PUT',{projects:{view:'grid',status:'draft'},pinnedProjects:['qa-project-03']});
  await api('/api/workspace/preferences','owner','PUT',{teams:{view:'list'}});const prefs=(await api('/api/workspace/preferences')).preferences;
  await Promise.all([api('/api/workspace/preferences','owner','PUT',{projects:{sort:'name'}}),api('/api/workspace/preferences','owner','PUT',{notifications:{filter:'unread'}})]);
  const concurrent=(await api('/api/workspace/preferences')).preferences;eq(concurrent.projects.sort,'name');eq(concurrent.projects.view,'grid');eq(concurrent.notifications.filter,'unread');
  eq(prefs.projects.view,'grid');eq(prefs.teams.view,'list');eq((await api('/api/workspace/summary')).projects[0].id,'qa-project-03');
  const created=(await api('/api/projects','owner','POST',{title:'Browser-ready project',summary:'A fresh draft',contentMarkdown:'# A new idea\n\n**Hello**, builders.',teamId:'qa-team',labels:['web','web','club'],visibility:'public'},201)).project;
  const project='/api/projects/'+created.id;eq((await api(project)).project.labels,['web','club']);ok((await api(project)).project.contentHtml.includes('<strong>Hello</strong>'));
  await api(project,'owner','PUT',{title:'Browser-ready project',demoUrl:'https://example.com/demo',sourceUrl:'https://github.com/example/demo'});
  await api(project,'owner','PUT',{demoUrl:'javascript:alert(1)'},400);
  const preview=await api('/api/workspace/preview','owner','POST',{markdown:'# Preview\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))'});ok(!preview.html.includes('<script>'));ok(!preview.html.includes('href="javascript:'));
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  await api(project+'/cover','owner','POST',{dataUrl:png});let image=await fetch(base+project+'/cover',{headers:{Cookie:'nvnc_session=qa-session-owner'}});eq(image.status,200);eq(image.headers.get('content-type'),'image/png');
  eq((await fetch(base+project+'/cover')).status,404);await api(project+'/cover','owner','POST',{dataUrl:'data:image/png;base64,YmFk'},400);
  await api(project+'/cover','owner','DELETE',{});await api(project+'/cover','owner','GET',undefined,404);
  await api(project+'/submit','owner','POST',{});eq((await api(project)).project.status,'submitted');await api(project+'/submit','owner','POST',{},409);
  await api('/api/admin/projects/'+created.id+'/status','staff','PUT',{status:'changes-requested',note:'Add a screenshot.'});eq((await api(project)).project.moderation_notes,'Add a screenshot.');
  await api(project+'/submit','owner','POST',{});await api('/api/admin/projects/'+created.id+'/status','staff','PUT',{status:'published'});await api(project,null);
  await api(project+'/archive','owner','POST',{});await api(project,null,'GET',undefined,404);await api(project,'owner','PUT',{title:'Blocked'},409);await api(project+'/restore','owner','POST',{});eq((await api(project)).project.status,'draft');
  await api('/api/teams/qa-team','member','PUT',{name:'No'},403);await api('/api/teams/qa-team','admin','PUT',{introductionMarkdown:'# A good team',websiteUrl:'https://example.com'});
  await api('/api/teams/qa-team/avatar','admin','POST',{dataUrl:png});await api('/api/teams/qa-team/avatar','admin','DELETE',{});
  await api('/api/teams/qa-team/archive','admin','POST',{},403);
  const expired=(await api('/api/notifications/qa-expired-notice','outsider')).notification;eq(expired.invitation.status,'expired');eq(expired.action_url,'/teams?tab=invitations');
  await api('/api/team-invitations/qa-expired/respond','outsider','POST',{status:'accepted'},409);
  await api('/api/teams/qa-team/invitations','admin','POST',{userId:'qa-outsider',message:'Come build with us!'},201);
  await api('/api/teams/qa-team/invitations','admin','POST',{userId:'qa-outsider'},409);
  let invite=(await api('/api/teams','outsider')).invitations[0];await api('/api/team-invitations/'+invite.id+'/respond','owner','POST',{status:'accepted'},409);
  await api('/api/team-invitations/'+invite.id+'/respond','outsider','POST',{status:'accepted'});await api('/api/team-invitations/'+invite.id+'/respond','outsider','POST',{status:'accepted'},409);
  await api('/api/teams/qa-team/leave','outsider','POST',{});await api('/api/teams/qa-team/invitations','owner','POST',{userId:'qa-outsider'},201);invite=(await api('/api/teams','outsider')).invitations[0];await api('/api/team-invitations/'+invite.id+'/respond','outsider','POST',{status:'accepted'});
  await api('/api/teams/qa-team/members/qa-outsider','admin','PUT',{role:'admin'},403);await api('/api/teams/qa-team/members/qa-outsider','owner','PUT',{role:'admin'});await api('/api/teams/qa-team/members/qa-outsider','admin','PUT',{status:'removed'},403);
  await api('/api/teams/qa-team/members/qa-outsider','owner','PUT',{status:'removed'});await api('/api/teams/qa-team/invitations','owner','POST',{userId:'qa-outsider'},201);invite=(await api('/api/teams','outsider')).invitations[0];await api('/api/teams/qa-team/invitations/'+invite.id,'admin','DELETE',{});eq((await api('/api/teams','outsider')).invitations.length,0);
  await api('/api/teams/qa-team/leave','owner','POST',{},409);await api('/api/teams/qa-team/transfer','owner','POST',{userId:'qa-member'});eq((await api('/api/teams/qa-team','member')).viewerRole,'owner');await api('/api/teams/qa-team/transfer','member','POST',{userId:'qa-owner'});
  await api('/api/teams/qa-team/archive','owner','POST',{});await api('/api/teams/qa-team','admin','PUT',{name:'No'},409);await api('/api/teams/qa-team/invitations','admin','POST',{userId:'qa-outsider'},409);
  await api(project,'owner','PUT',{teamId:'qa-team',summary:'Existing association retained while archived'});await api('/api/projects','owner','POST',{title:'No',teamId:'qa-team'},400);
  await api('/api/teams/qa-team/restore','owner','POST',{});
  const concurrentTeam=(await api('/api/teams','owner','POST',{name:'Concurrent acceptance fixture'},201)).team;
  await api(`/api/teams/${concurrentTeam.id}/invitations`,'owner','POST',{userId:'qa-outsider'},201);
  const concurrentInvite=(await api('/api/teams','outsider')).invitations.find(i=>i.team_id===concurrentTeam.id);
  const responses=await Promise.all([1,2].map(()=>fetch(base+`/api/team-invitations/${concurrentInvite.id}/respond`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,'x-csrf-token':'qa-csrf',Cookie:'nvnc_csrf=qa-csrf; nvnc_session=qa-session-outsider'},body:JSON.stringify({status:'accepted'})})));
  eq(responses.map(r=>r.status).sort(),[200,409],'invitation response race accepts exactly once');
  eq((await api('/api/teams/'+concurrentTeam.id)).members.filter(m=>m.id==='qa-outsider').length,1);
  await api(`/api/teams/${concurrentTeam.id}/archive`,'owner','POST',{});
  for(const action of ['save','done','restore','unread','unsave','read'])await api('/api/notifications/qa-notice-00/action','owner','POST',{action});
  await api('/api/notifications/bulk','owner','POST',{ids:['qa-notice-01','qa-notice-02'],action:'save'});eq((await api('/api/notifications?filter=saved')).total,2);
  await api('/api/notifications/bulk','owner','POST',{ids:['qa-notice-01','qa-notice-02'],action:'done'});eq((await api('/api/notifications?filter=done')).total,2);
  await api('/api/notifications/qa-notice-01','outsider','GET',undefined,404);await api('/api/notifications/qa-notice-03/read','owner','POST',{});ok((await api('/api/notifications/qa-notice-03')).notification.read_at);
  const normalized=(await api('/api/notifications?type=project-status')).notifications[0];ok(normalized.action_url.startsWith('/projects/'));
  await api('/api/notifications/read-all','owner','POST',{});eq((await api('/api/notifications/unread-count')).count,0);
  await api('/api/notifications/bulk','owner','POST',{ids:['qa-notice-01','qa-notice-02'],action:'restore'});await api('/api/notifications/bulk','owner','POST',{ids:['qa-notice-01','qa-notice-02'],action:'unread'});eq((await api('/api/notifications/unread-count')).count,2);
  await api('/api/teams/qa-team/invitations','owner','POST',{userId:'qa-outsider',message:'Join us for the next building session.'},201);
  const team=(await api('/api/teams','owner','POST',{name:'Design Lab',description:'A place for thoughtful interfaces',introductionMarkdown:'# Design Lab\n\nSmall details matter.',websiteUrl:'https://example.com'},201)).team;ok(team.slug.startsWith('design-lab-'));
  await api('/api/workspace/preferences','owner','PUT',{projects:{view:'list',status:'active'},teams:{view:'grid'}});
  console.log(`PASS: ${assertions} assertions. Local fixture site: ${base}`);
  console.log('Browser fixtures: QA owner, QA admin, QA member, QA outsider, QA staff. Password is documented in tests/workspace.mjs (local only).');
  if(process.argv.includes('--serve')){console.log('Keeping isolated fixture server running for interactive browser checks.');await new Promise(resolve=>process.once('SIGINT',resolve));}
}catch(error){console.error(serverLog.slice(-7000));throw error;}
finally{server.kill();}

// Isolated admin integration test. The test database is created under the OS temp directory.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {pbkdf2Sync} from 'node:crypto';

const directory=await mkdtemp(join(tmpdir(),'nvnc-admin-'));
const state=join(directory,'state'),port=Number(process.env.NVNC_ADMIN_PORT||8793),base='http://localhost:'+port;
const wrangler=resolve('node_modules/wrangler/bin/wrangler.js');
const cli=args=>execFileSync(process.execPath,[wrangler,...args],{stdio:'pipe',encoding:'utf8'});
const sql=v=>"'"+String(v).replaceAll("'","''")+"'";
const stamp='2026-09-01T12:00:00.000Z',password='Admin-Local-Only-2026!',salt='local-admin-fixture';
const hash=salt+'.'+pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex');
assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535);
console.log('Preparing isolated admin fixture:',directory);
cli(['d1','migrations','apply','no-vibe-no-code','--local','--persist-to',state]);
const users=[['leader','club-leader',1],['teacher','teacher',0],['staff','maintainer',0],['member','member',0],['owner','member',0],['nonmember','non-member',0]];
const seeds=[];
for(const [key,role,initial] of users){
  seeds.push("INSERT INTO users(id,display_name,english_name,chinese_name,wechat_id,class_grade,role,password_hash,public_slug,terms_accepted_at,is_initial_leader,created_at,updated_at) VALUES('qa-"+key+"','QA "+key+"','QA','测试','local','G10',"+sql(role)+","+sql(hash)+",'qa-"+key+"',"+sql(stamp)+","+initial+","+sql(stamp)+","+sql(stamp)+");");
  seeds.push("INSERT INTO sessions VALUES('qa-session-"+key+"','qa-"+key+"','2099-01-01T00:00:00.000Z');");
}
for(let i=0;i<65;i++)seeds.push("INSERT INTO users(id,display_name,english_name,chinese_name,wechat_id,class_grade,role,password_hash,public_slug,terms_accepted_at,created_at,updated_at) VALUES('qa-extra-"+i+"','QA Extra "+i+"','QA','测试','local','G10','member',"+sql(hash)+",'qa-extra-"+i+"',"+sql(stamp)+","+sql(stamp)+","+sql(stamp)+");");
seeds.push("INSERT INTO teams(id,slug,name,owner_user_id,status,created_at,updated_at) VALUES('qa-team','admin-fixture-team','Admin Fixture Team','qa-owner','active',"+sql(stamp)+","+sql(stamp)+");");
for(const who of ['owner','member'])seeds.push("INSERT INTO team_members(id,team_id,user_id,role,status,joined_at,updated_at) VALUES('qa-team-"+who+"','qa-team','qa-"+who+"','"+(who==='owner'?'owner':'member')+"','active',"+sql(stamp)+","+sql(stamp)+");");
for(let i=0;i<26;i++)seeds.push("INSERT INTO projects(id,owner_user_id,slug,title,status,visibility,created_at,updated_at,submitted_at) VALUES('qa-project-"+i+"','qa-owner','qa-project-"+i+"','Fixture "+i+"','submitted','private',"+sql(stamp)+","+sql(stamp)+","+sql(stamp)+");");
seeds.push("INSERT INTO contacts(id,name,wechat_id,message,created_at,status) VALUES('qa-contact','Visitor','wechat-fixture','How can I join?',"+sql(stamp)+",'new');");
const seedFile=join(directory,'seed.sql');await writeFile(seedFile,seeds.join('\n'));
cli(['d1','execute','no-vibe-no-code','--local','--persist-to',state,'--file',seedFile]);
const server=spawn(process.execPath,[wrangler,'dev','--local','--port',String(port),'--persist-to',state,'--test-scheduled'],{stdio:['ignore','pipe','pipe']});
let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/me')).ok){ready=true;break;}}catch{}await sleep(250);}
if(!ready){server.kill();throw new Error('Local Worker did not start:\n'+serverLog);}
let count=0;
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);count++;};
const ok=(value,message)=>{assert.ok(value,message);count++;};
async function api(path,who='leader',method='GET',data,expected=200){
  const response=await fetch(base+path,{method,headers:{'content-type':'application/json',origin:base,'x-csrf-token':'local-csrf',cookie:'nvnc_csrf=local-csrf'+(who?'; nvnc_session=qa-session-'+who:'')},body:data===undefined?undefined:JSON.stringify(data)});
  const payload=await response.json();eq(response.status,expected,method+' '+path+' '+JSON.stringify(payload).slice(0,250));return payload;
}
try{
  for(const path of ['/admin','/admin/members','/admin/members/qa-owner','/admin/forms','/admin/forms/new','/admin/projects/qa-project-0','/admin/teams/qa-team','/admin/broadcasts','/admin/contacts','/admin/settings']){
    const response=await fetch(base+path);eq(response.status,200,path);ok((await response.text()).includes('admin-workspace.css'),path+' shell');
  }
  const overview=await api('/api/admin/dashboard');eq(overview.counts.pendingProjects,26);eq(overview.counts.newContacts,1);
  await api('/api/admin/dashboard','member','GET',undefined,403);
  eq((await api('/api/admin/members?limit=10')).total,71);
  eq((await api('/api/admin/projects?status=submitted&limit=10')).total,26);
  await api('/api/admin/forms','staff','GET',undefined,403);
  await api('/api/admin/broadcasts','staff','GET',undefined,403);
  await api('/api/admin/projects/qa-project-0/status','staff','PUT',{status:'changes-requested',note:'Please add a demo.'});
  eq((await api('/api/admin/projects/qa-project-0')).project.status,'changes-requested');
  await api('/api/admin/projects/qa-project-1/status','staff','PUT',{status:'changes-requested'},400);
  await api('/api/admin/projects/qa-project-0/status','member','PUT',{status:'published'},403);
  const formSchema={sections:[{id:'first',title:'Registration',fields:[{id:'email',type:'email',label:'Email',required:true,options:[]}]}]};
  const created=(await api('/api/admin/forms','leader','POST',{title:'Admin fixture form',access:'staff',schema:formSchema},201)).form;
  await api('/api/admin/forms/'+created.id+'/publish','leader','POST',{});
  const publishedRevision=(await api('/api/admin/forms/'+created.id)).revision.id;
  await api('/api/forms/'+created.slug,'member','GET',undefined,403);
  await api('/api/forms/'+created.slug,'teacher');
  await api('/api/forms/'+created.slug+'/responses','member','POST',{answers:{email:'member@example.com'}},403);
  const submitted=await api('/api/forms/'+created.slug+'/responses','teacher','POST',{answers:{email:'teacher@example.com'}},201);
  eq((await api('/api/admin/forms/'+created.id+'/responses')).total,1);
  await api('/api/admin/forms/'+created.id+'/responses/'+submitted.responseId,'teacher','PUT',{reviewed:true});
  ok((await api('/api/admin/forms/'+created.id+'/responses/'+submitted.responseId)).response.reviewed_at);
  const csv=await fetch(base+'/api/admin/forms/'+created.id+'/responses?format=csv',{headers:{cookie:'nvnc_session=qa-session-leader'}});
  eq(csv.status,200);ok((await csv.text()).includes('teacher@example.com'));
  await api('/api/admin/forms/'+created.id+'/close','leader','POST',{});
  await api('/api/forms/'+created.slug+'/responses','teacher','POST',{answers:{email:'teacher@example.com'}},404);
  await api('/api/admin/forms/'+created.id+'/reopen','leader','POST',{});
  const changedSchema={sections:[{...formSchema.sections[0],fields:[...formSchema.sections[0].fields,{id:'name',type:'short-text',label:'Name',required:false,options:[]}]}]};
  await api('/api/admin/forms/'+created.id,'leader','PUT',{title:'Admin fixture form',access:'public',schema:changedSchema,closesAt:'2020-01-01T00:00:00.000Z'});
  const savedForm=await api('/api/admin/forms/'+created.id);eq(savedForm.revisions.length,2);
  eq((await api('/api/admin/forms/'+created.id+'/revisions/'+publishedRevision)).revision.schema.sections[0].fields.length,1);
  eq(savedForm.revision.schema.sections[0].fields.length,2);
  await api('/api/admin/forms/'+created.id+'/revisions/'+publishedRevision,'staff','GET',undefined,403);
  await api('/api/forms/'+created.slug+'/responses',null,'POST',{answers:{email:'public@example.com'}},404);
  await api('/api/admin/teams/qa-team','staff');
  await api('/api/admin/teams/qa-team','staff','PUT',{name:'Forbidden'},403);
  await api('/api/admin/teams/qa-team','teacher','PUT',{name:'Updated team'});
  await api('/api/admin/teams/qa-team/members/qa-member','teacher','PUT',{role:'admin'});
  await api('/api/admin/teams/qa-team/transfer','teacher','POST',{userId:'qa-member',reason:'Handoff'});
  eq((await api('/api/admin/teams/qa-team')).team.owner_user_id,'qa-member');
  await api('/api/admin/teams/qa-team/archive','teacher','POST',{reason:'Season ended'});
  await api('/api/admin/teams/qa-team/restore','teacher','POST',{reason:'New season'});
  await api('/api/admin/teams/qa-team/invitations','teacher','POST',{userId:'qa-leader',message:'Join the team.'},201);
  const invitation=(await api('/api/admin/teams/qa-team')).invitations.find(i=>i.invited_name==='QA leader');ok(invitation);
  await api('/api/admin/teams/qa-team/invitations/'+invitation.id,'teacher','DELETE',{});
  await api('/api/admin/contacts/qa-contact','staff','PUT',{status:'in-progress',assignedTo:'qa-staff'});
  await api('/api/admin/notes/contact/qa-contact','staff','POST',{body:'Follow up at the fair.'},201);
  eq((await api('/api/admin/contacts/qa-contact')).notes.length,1);
  await api('/api/admin/settings','teacher','PUT',{competitionActive:true},403);
  await api('/api/admin/settings','leader','PUT',{competitionActive:true});
  const issued=(await api('/api/admin/nfc-cards','teacher','POST',{count:1},201)).cards[0];
  ok(new URL(issued.url).pathname.startsWith('/nfc/'));
  const inventory=(await api('/api/admin/nfc-cards')).items;eq(inventory.length,1);
  ok(!JSON.stringify(inventory).includes(issued.url));
  await api('/api/admin/nfc-cards/'+inventory[0].id,'teacher','PUT',{action:'disable'});
  eq((await (await fetch(base+'/api/nfc/cards/'+new URL(issued.url).pathname.split('/').at(-1))).json()).status,'disabled');
  await api('/api/admin/nfc-cards/'+inventory[0].id,'teacher','PUT',{action:'enable'});
  const draft=(await api('/api/admin/broadcasts/drafts','leader','POST',{title:'Fixture announcement',body:'Build with us.',audienceType:'all'},201)).id;
  await api('/api/admin/broadcasts/'+draft+'/schedule','leader','POST',{scheduledAt:new Date(Date.now()+120000).toISOString()});
  await api('/api/admin/broadcasts/'+draft+'/cancel','leader','POST',{});
  const large=(await api('/api/admin/broadcasts/drafts','leader','POST',{title:'Large fixture',body:'One message per recipient.',audienceType:'all'},201)).id;
  await api('/api/admin/broadcasts/'+large+'/send','leader','POST',{});
  let detail=await api('/api/admin/broadcasts/'+large);eq(detail.deliveries.total,71);ok(detail.deliveries.delivered<=50);
  const tick=await fetch(base+'/cdn-cgi/local/scheduled?cron=*+*+*+*+*');eq(tick.status,200);
  detail=await api('/api/admin/broadcasts/'+large);eq(detail.deliveries.delivered,71);eq(detail.broadcast.status,'sent');
  await fetch(base+'/cdn-cgi/local/scheduled?cron=*+*+*+*+*');
  eq((await api('/api/admin/broadcasts/'+large)).deliveries.delivered,71);
  const due=(await api('/api/admin/broadcasts/drafts','leader','POST',{title:'Scheduled fixture',body:'Delivery after trigger.',audienceType:'role',audienceValue:'teacher'},201)).id;
  await api('/api/admin/broadcasts/'+due+'/schedule','leader','POST',{scheduledAt:new Date(Date.now()+120000).toISOString()});
  cli(['d1','execute','no-vibe-no-code','--local','--persist-to',state,'--command',"UPDATE broadcasts SET scheduled_at='2020-01-01T00:00:00.000Z' WHERE id="+sql(due)]);
  eq((await fetch(base+'/cdn-cgi/local/scheduled?cron=*+*+*+*+*')).status,200);
  eq((await api('/api/admin/broadcasts/'+due)).deliveries.delivered,1);
  eq((await api('/api/admin/broadcasts/'+due)).broadcast.status,'sent');
  await api('/api/admin/audit','teacher');
  await api('/api/admin/audit','staff','GET',undefined,403);
  console.log('PASS: '+count+' admin assertions. Local fixture site: '+base);
  console.log('Browser fixtures: QA leader, teacher, staff, member, owner, nonmember. Local-only password is in tests/admin.mjs.');
  if(process.argv.includes('--serve')){console.log('Keeping isolated fixture site running for browser checks.');await new Promise(resolve=>process.once('SIGINT',resolve));}
}catch(error){console.error(serverLog.slice(-6000));throw error;}
finally{server.kill();}

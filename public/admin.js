(() => {
  const { requestJson: api, jsonOptions: json, escapeHtml: e, currentUser } = window.NVNC;
  const root = document.getElementById('adminPage');
  const nav = document.getElementById('adminNavigation');
  const toastNode = document.getElementById('adminToast');
  const roles = ['non-member','member','maintainer','club-leader','teacher'];
  const sections = ['overview','members','forms','projects','teams','broadcasts','contacts','settings'];
  const names = {overview:'Overview',members:'Members',forms:'Forms',projects:'Projects',teams:'Teams',broadcasts:'Broadcasts',contacts:'Contacts',settings:'Settings'};
  let user, toastTimer;
  const path = location.pathname.replace(/\/+$/,'') || '/admin';
  const parts = path.replace(/^\/admin(?:\.html)?\/?/,'').split('/').filter(Boolean);
  const section = parts[0] || 'overview';
  const detail = parts[1] || '';
  const qp = new URLSearchParams(location.search);
  const date = value => value ? new Date(value).toLocaleString() : '—';
  const badge = value => '<span class="aw-badge" data-tone="' + (['new','submitted','scheduled','pending','in-progress'].includes(value)?'warning':['suspended','archived','failed','changes-requested','disabled'].includes(value)?'danger':['published','active','resolved','delivered','claimed'].includes(value)?'success':'') + '">' + e(value||'—') + '</span>';
  const heading = (title,desc,actions='') => '<header class="aw-heading"><div>' + (detail?'<a class="aw-back" href="/admin/'+e(section)+'">← Back to '+e(names[section])+'</a>':'') + '<div class="aw-eyebrow">CLUB ADMINISTRATION / ' + e(section) + '</div><h1>' + e(title) + '</h1><p>' + e(desc) + '</p></div><div class="aw-actions">' + actions + '</div></header>';
  const btn = (text,attrs='',kind='') => '<button type="button" class="aw-btn ' + kind + '" ' + attrs + '>' + e(text) + '</button>';
  const linkBtn = (text,href,kind='') => '<a class="aw-btn ' + kind + '" href="' + e(href) + '">' + e(text) + '</a>';
  const empty = (title,desc) => '<div class="aw-empty"><h2>' + e(title) + '</h2><p>' + e(desc) + '</p></div>';
  const row = (title,meta,href,extra='') => '<article class="aw-row"><div class="aw-row-copy"><a href="' + e(href) + '">' + e(title) + '</a><span>' + meta + '</span></div>' + extra + '</article>';
  const field = (label,id,value='',type='text',extra='') => '<div class="aw-field"><label for="' + e(id) + '">' + e(label) + '</label><input id="' + e(id) + '" type="' + e(type) + '" value="' + e(value??'') + '" ' + extra + '></div>';
  const textField = (label,id,value='',rows=5) => '<div class="aw-field full"><label for="' + e(id) + '">' + e(label) + '</label><textarea id="' + e(id) + '" rows="' + rows + '">' + e(value??'') + '</textarea></div>';
  const select = (id,values,chosen,first='All') => '<select id="' + e(id) + '" name="' + e(id) + '" aria-label="' + e(id.replace(/([A-Z])/g,' $1')) + '">' + (first!==null?'<option value="">' + e(first) + '</option>':'') + values.map(v=>'<option value="' + e(v) + '"' + (v===chosen?' selected':'') + '>' + e(v) + '</option>').join('') + '</select>';
  const card = (title,body,href='') => '<section class="aw-card"><header><h2>' + e(title) + '</h2>' + (href?'<a href="' + e(href) + '">View all →</a>':'') + '</header><div class="aw-card-body">' + body + '</div></section>';
  const tabs = (items,active) => '<nav class="aw-tabs" aria-label="Detail sections">' + items.map(x=>'<a href="' + e(x[1]) + '"' + (x[0]===active?' aria-current="page"':'') + '>' + e(x[0]) + '</a>').join('') + '</nav>';
  const noteHtml = notes => notes?.length ? notes.map(n=>'<div class="aw-note"><p>' + e(n.body) + '</p><small>' + e(n.author||'Staff') + ' · ' + e(date(n.created_at)) + '</small></div>').join('') : '<p class="aw-muted">No staff notes yet.</p>';
  const toast = (message,error=false) => {clearTimeout(toastTimer);toastNode.textContent=message;toastNode.classList.toggle('is-error',error);toastNode.hidden=false;toastTimer=setTimeout(()=>toastNode.hidden=true,5000);};
  async function mutate(url,method,data){return api(url,json(method,data));}
  async function run(action){try{await action();}catch(err){toast(err.message,true);}}
  function confirmAction(title,message) {
    const dialog=document.getElementById('adminConfirm');
    document.getElementById('confirmTitle').textContent=title;
    document.getElementById('confirmText').textContent=message;
    return new Promise(resolve=>{
      const accept=document.getElementById('confirmAccept'),cancel=document.getElementById('confirmCancel');
      const done=value=>{accept.onclick=null;cancel.onclick=null;dialog.oncancel=null;dialog.close();resolve(value);};
      accept.onclick=()=>done(true);cancel.onclick=()=>done(false);dialog.oncancel=event=>{event.preventDefault();done(false);};
      dialog.showModal();cancel.focus();
    });
  }
  function pageNav(result){
    const total=result.total||0,page=result.page||1,limit=result.limit||20;
    const urlFor=p=>{const search=new URLSearchParams(location.search);search.set('page',String(p));return location.pathname+'?'+search;};
    return '<div class="aw-pages" data-total="' + total + '"><span>' + (total?(1+(page-1)*limit)+'–'+Math.min(page*limit,total):'0') + ' of ' + total + ' records</span><div class="aw-actions">' + (page>1?linkBtn('Previous',urlFor(page-1)):'') + (result.hasMore?linkBtn('Next',urlFor(page+1)):'') + '</div></div>';
  }
  function toolbar(filters){
    const fields=filters.map(f=>f.type==='search'?'<input type="search" name="q" value="' + e(qp.get('q')||'') + '" placeholder="' + e(f.placeholder||'Search') + '" aria-label="Search">':select(f.name,f.options,qp.get(f.name)||'',f.label));
    const search=filters[0]?.type==='search'?fields.shift():'';
    return '<form class="aw-toolbar" id="adminFilters">' + search + '<details class="aw-filter-details" '+(matchMedia('(min-width: 821px)').matches?'open':'')+'><summary>Filters</summary><div class="aw-filter-fields">' + fields.join('') + '<button class="aw-btn" type="submit">Apply filters</button><button class="aw-btn aw-filter-clear" type="button" data-admin-clear>Clear</button></div></details></form>';
  }
  function bindToolbar(){
    const form=document.getElementById('adminFilters');if(!form)return;
    const total=root.querySelector('.aw-pages[data-total]')?.dataset.total;
    const list=form.nextElementSibling;
    if(total!==undefined&&list?.classList.contains('aw-list')){
      const count=document.createElement('p');count.className='collection-result-count';count.textContent=total+' '+(Number(total)===1?'result':'results');list.before(count);
    }
    form.onsubmit=event=>{event.preventDefault();const next=new URLSearchParams();if(qp.get('tab'))next.set('tab',qp.get('tab'));for(const [key,value] of new FormData(form))if(String(value).trim())next.set(key,String(value).trim());location.href=location.pathname+(next.size?'?'+next:'');};
    form.querySelector('[data-admin-clear]').onclick=()=>{const next=new URLSearchParams();if(qp.get('tab'))next.set('tab',qp.get('tab'));location.href=location.pathname+(next.size?'?'+next:'');};
  }
  function value(id){return document.getElementById(id)?.value??'';}
  function check(id){return Boolean(document.getElementById(id)?.checked);}
  async function addNote(type,id) {
    const textarea=document.getElementById('newNote');const body=textarea?.value.trim();if(!body){toast('Enter a note.',true);return;}
    await mutate('/api/admin/notes/'+type+'/'+encodeURIComponent(id),'POST',{body});location.reload();
  }
  const noteEditor=(type,id,notes)=>card('Private staff notes','<div>' + noteHtml(notes) + '</div><div class="aw-field" style="margin-top:15px"><label for="newNote">Add a note</label><textarea id="newNote" maxlength="2000"></textarea></div><div class="aw-actions" style="margin-top:10px">' + btn('Save note','data-action="note" data-type="'+e(type)+'" data-id="'+e(id)+'"','aw-primary') + '</div>');
  const detailSide=(entries,extra='')=>'<aside class="aw-side">' + card('At a glance','<dl>'+entries.map(x=>'<dt>'+e(x[0])+'</dt><dd>'+x[1]+'</dd>').join('')+'</dl>')+extra+'</aside>';
  async function loadOverview(){
    const data=await api('/api/admin/dashboard');
    const count=data.counts;
    root.innerHTML=heading('Club overview','The work that needs attention today.',linkBtn('Review projects','/admin/projects?status=submitted','aw-primary'))+
      '<div class="aw-metrics">'+[
        ['Active members',count.members,'/admin/members?status=active'],['Pending projects',count.pendingProjects,'/admin/projects?status=submitted'],['Open forms',count.openForms,'/admin/forms?status=published'],['New contacts',count.newContacts,'/admin/contacts?status=new'],['Active teams',count.activeTeams,'/admin/teams?status=active'],['Scheduled broadcasts',count.scheduledBroadcasts,'/admin/broadcasts?status=scheduled']
      ].map(x=>'<a class="aw-metric" href="'+x[2]+'"><span>'+e(x[0])+'</span><strong>'+x[1]+'</strong><small>Open section →</small></a>').join('')+'</div>'+
      '<div class="aw-grid">'+
      card('Projects awaiting review',data.pendingProjects.length?data.pendingProjects.map(p=>row(p.title,e(p.owner)+' · '+e(date(p.submitted_at)),'/admin/projects/'+p.id)).join(''):empty('Queue clear','Submitted projects will appear here.'),'/admin/projects?status=submitted')+
      card('New contact messages',data.contacts.length?data.contacts.map(c=>row(c.name,e(c.message.slice(0,90))+' · '+e(date(c.created_at)),'/admin/contacts/'+c.id)).join(''):empty('Inbox clear','New contact messages will appear here.'),'/admin/contacts?status=new')+
      card('Upcoming broadcasts',data.broadcasts.length?data.broadcasts.map(b=>row(b.title,e(date(b.scheduled_at)),'/admin/broadcasts/'+b.id)).join(''):empty('Nothing scheduled','Draft an in-app announcement when you need one.'),'/admin/broadcasts')+
      card('Recent staff activity',data.activity.length?data.activity.map(a=>'<div class="aw-note"><p>'+e(a.action)+' · '+e(a.actor||'Staff')+'</p><small>'+e(date(a.created_at))+'</small></div>').join(''):empty('No activity','Staff actions will be recorded here.'),'/admin/settings?tab=audit')+'</div>';
  }
  async function loadMembers(){
    if(detail)return loadMemberDetail(detail);
    const data=await api('/api/admin/members'+location.search);
    root.innerHTML=heading('Members','Search the club directory and open a record for its teams, projects, and staff history.')+
      toolbar([{type:'search',placeholder:'Search name or class'},{name:'role',label:'All roles',options:roles},{name:'status',label:'All statuses',options:['active','suspended','archived']}])+
      '<div class="aw-list">'+(data.items.length?data.items.map(m=>row(m.display_name,e(m.english_name)+' / '+e(m.chinese_name)+' · '+e(m.class_grade),'\/admin/members/'+m.id,badge(m.role)+' '+badge(m.status))).join(''):empty('No members match','Try another search or filter.'))+'</div>'+pageNav(data);
    bindToolbar();
  }
  async function loadMemberDetail(id){
    const {member:m,teams,projects,history,notes}=await api('/api/admin/members/'+encodeURIComponent(id));
    const canStatus=['club-leader','teacher'].includes(user.role)&&!m.is_initial_leader&&m.id!==user.id;
    const canRole=Boolean(user.is_initial_leader);
    root.innerHTML=heading(m.display_name,'Member record · joined '+date(m.created_at),linkBtn('Public profile','/user/'+encodeURIComponent(m.public_slug)))+
      '<div class="aw-detail"><div class="aw-detail-main">'+
      card('Member profile','<div class="aw-fields">'+field('English name','memberEnglish',m.english_name,'text','disabled')+field('Chinese name','memberChinese',m.chinese_name,'text','disabled')+field('Class / grade','memberClass',m.class_grade,'text','disabled')+'</div><p class="aw-muted">'+e(m.bio||'No bio added.')+'</p>')+
      '<div class="aw-grid" style="margin-top:17px">'+card('Teams',teams.length?teams.map(t=>row(t.name,e(t.role)+' · '+e(t.status),'/admin/teams/'+t.id)).join(''):empty('No teams','This member has no active memberships.'))+
      card('Projects',projects.length?projects.map(p=>row(p.title,e(p.status)+' · '+e(p.visibility),'/admin/projects/'+p.id)).join(''):empty('No projects','No projects yet.'))+'</div>'+
      '<section class="aw-section" style="margin-top:18px">'+noteEditor('user',m.id,notes)+'</section>'+
      card('Account history',history.length?history.map(h=>'<div class="aw-note"><p>'+e(h.action)+'</p><small>'+e(date(h.created_at))+'</small></div>').join(''):empty('No changes','Account actions will appear here.'))+
      '</div>'+detailSide([['Role',badge(m.role)],['Status',badge(m.status)],['Joined',e(date(m.created_at))]],card('Account actions',
        '<div class="aw-field"><label for="memberRole">Global role</label>'+select('memberRole',roles,m.role,null)+'</div><div class="aw-actions" style="margin:10px 0 18px">'+btn('Change role','data-action="member-role" data-id="'+e(m.id)+'"'+(canRole?'':' disabled'))+'</div>'+
        '<div class="aw-field"><label for="memberStatus">Account status</label>'+select('memberStatus',['active','suspended','archived'],m.status,null)+'</div><div class="aw-actions" style="margin:10px 0 18px">'+btn('Change status','data-action="member-status" data-id="'+e(m.id)+'"'+(canStatus?'':' disabled'))+'</div>'+
        '<div class="aw-field"><label for="memberPassword">Temporary password</label><input id="memberPassword" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters"></div><div class="aw-actions" style="margin-top:10px">'+btn('Reset password','data-action="member-password" data-id="'+e(m.id)+'"'+(['club-leader','teacher'].includes(user.role)?'':' disabled'))+'</div><p class="aw-help">Share the new password directly with the member. Existing sessions will end.</p>'))+'</div>';
  }
  async function loadProjects(){
    if(detail)return loadProjectDetail(detail);
    const data=await api('/api/admin/projects'+(location.search||'?status=submitted'));
    root.innerHTML=heading('Project review','Read a complete submission before recording a decision.')+
      toolbar([{type:'search',placeholder:'Search project or owner'},{name:'status',label:'All statuses',options:['draft','submitted','changes-requested','approved','published','archived']}])+
      '<div class="aw-list">'+(data.items.length?data.items.map(p=>row(p.title,'By '+e(p.owner_name)+' · '+e(p.team_name||'Independent')+' · '+e(date(p.updated_at)),'/admin/projects/'+p.id,badge(p.status))).join(''):empty('Nothing in this queue','Try another filter or wait for submissions.'))+'</div>'+pageNav(data);bindToolbar();
  }
  async function loadProjectDetail(id){
    const {project:p,history,notes}=await api('/api/admin/projects/'+encodeURIComponent(id));
    const allowed={submitted:['changes-requested','approved','published'],approved:['changes-requested','published'],published:['archived'],'changes-requested':['approved','published','archived']};
    root.innerHTML=heading(p.title,'Project review · '+p.owner_name,linkBtn('Member project page','/projects/'+encodeURIComponent(p.slug)))+
      '<div class="aw-detail"><div class="aw-detail-main">'+
      (p.coverUrl?'<img class="aw-cover" src="'+e(p.coverUrl)+'" alt="Project cover">':'')+
      card('Overview','<p>'+e(p.summary||'No summary provided.')+'</p><div class="aw-preview">'+p.contentHtml+'</div>')+
      card('Review decision','<p class="aw-help">Review the current project before changing its status. A decision is sent to the owner.</p><div class="aw-field"><label for="reviewNote">Feedback for owner</label><textarea id="reviewNote" maxlength="2000" placeholder="Explain requested changes or your decision.">'+e(p.moderation_notes||'')+'</textarea></div><div class="aw-actions" style="margin-top:14px">'+(allowed[p.status]||[]).map(s=>btn(s==='changes-requested'?'Request changes':s==='published'?'Publish':s==='approved'?'Approve':'Archive','data-action="project-status" data-id="'+e(p.id)+'" data-status="'+e(s)+'"',s==='published'?'aw-primary':s==='archived'?'aw-danger':'')).join('')+'</div>')+
      '<section class="aw-section" style="margin-top:18px">'+noteEditor('project',p.id,notes)+'</section>'+
      card('Review history',history.length?history.map(h=>'<div class="aw-note"><p>'+e(h.action)+' · '+e(h.actor||'Staff')+'</p><small>'+e(date(h.created_at))+' · '+e(h.details_json||'')+'</small></div>').join(''):empty('No decisions yet','Review decisions will appear here.'))+
      '</div>'+detailSide([['Status',badge(p.status)],['Visibility',badge(p.visibility)],['Owner',e(p.owner_name)],['Team',e(p.team_name||'—')],['Submitted',e(date(p.submitted_at))],['Demo',p.demo_url?'<a href="'+e(p.demo_url)+'" target="_blank" rel="noopener noreferrer">Open demo</a>':'—'],['Source',p.source_url?'<a href="'+e(p.source_url)+'" target="_blank" rel="noopener noreferrer">Open source</a>':'—']])+'</div>';
  }
  let draftSchema;
  const expandedQuestions=new Set();
  const questionTypes=['short-text','paragraph','email','number','url','date','time','linear-scale','single-choice','checkboxes','dropdown','consent'];
  const formBase=id=>'/admin/forms/'+encodeURIComponent(id);
  const datetimeInput=value=>{if(!value)return '';const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
  const toIso=value=>value?new Date(value).toISOString():null;
  function readEditor(){
    if(!document.getElementById('formBuilder'))return;
    draftSchema={sections:[...document.querySelectorAll('.aw-builder-section')].map(s=>({
      id:s.dataset.id,title:s.querySelector('.aw-section-title').value.trim(),
      fields:[...s.querySelectorAll('.aw-builder-question')].map(q=>({
        id:q.dataset.id,type:q.querySelector('.aw-question-type').value,
        label:q.querySelector('.aw-question-label').value.trim(),
        help:q.querySelector('.aw-question-help').value.trim(),
        placeholder:q.querySelector('.aw-question-placeholder').value.trim(),
        required:q.querySelector('.aw-question-required').checked,
        options:q.querySelector('.aw-question-options').value.split('\n').map(x=>x.trim()).filter(Boolean)
      }))
    }))};
  }
  function renderBuilder(){
    const host=document.getElementById('formBuilder');if(!host)return;
    if(!expandedQuestions.size)draftSchema.sections.forEach(section=>{if(section.fields[0])expandedQuestions.add(section.fields[0].id);});
    host.innerHTML=draftSchema.sections.map((s,si)=>'<div class="aw-form-section aw-builder-section" data-id="'+e(s.id)+'">'+
      '<div class="aw-question-head"><h2>Section '+(si+1)+'</h2>'+btn('Remove section','data-action="section-remove" data-index="'+si+'"','aw-danger')+'</div>'+
      field('Section title','sectionTitle'+si,s.title,'text','class="aw-section-title" maxlength="150"')+
      s.fields.map((q,qi)=>'<div class="aw-question aw-builder-question" data-id="'+e(q.id)+'">'+
        '<div class="aw-question-head"><button type="button" class="aw-question-toggle" data-action="question-toggle" aria-expanded="'+expandedQuestions.has(q.id)+'">Question '+(qi+1)+' · '+e(q.label||'Untitled')+'</button><div class="aw-actions">'+btn('↑','data-action="question-up" data-section="'+si+'" data-index="'+qi+'" aria-label="Move question up"')+btn('↓','data-action="question-down" data-section="'+si+'" data-index="'+qi+'" aria-label="Move question down"')+btn('Remove','data-action="question-remove" data-section="'+si+'" data-index="'+qi+'"','aw-danger')+'</div></div>'+
        '<div class="aw-question-content" '+(expandedQuestions.has(q.id)?'':'hidden')+'><div class="aw-fields">'+field('Question label','label'+si+'-'+qi,q.label,'text','class="aw-question-label" maxlength="150"')+
        '<div class="aw-field"><label>Question type<select class="aw-question-type">'+questionTypes.map(t=>'<option value="'+e(t)+'"'+(t===q.type?' selected':'')+'>'+e(t)+'</option>').join('')+'</select></label></div></div>'+
        '<label class="aw-checkbox"><input type="checkbox" class="aw-question-required"'+(q.required?' checked':'')+'> Required</label>'+
        '<details class="aw-question-advanced" '+(['single-choice','checkboxes','dropdown'].includes(q.type)?'open':'')+'><summary>Helper text, placeholder and options</summary><div class="aw-fields">'+
        field('Helper text','help'+si+'-'+qi,q.help,'text','class="aw-question-help" maxlength="250"')+
        field('Placeholder','placeholder'+si+'-'+qi,q.placeholder,'text','class="aw-question-placeholder" maxlength="150"')+
        '<div class="aw-field full"><label>Options (one per line, for choice questions)<textarea class="aw-question-options" rows="3">'+e((q.options||[]).join('\n'))+'</textarea></label></div></div></details></div></div>').join('')+
      '<div class="aw-actions"><select class="aw-add-type" aria-label="New question type">'+questionTypes.map(t=>'<option value="'+e(t)+'">'+e(t)+'</option>').join('')+'</select>'+btn('Add question','data-action="question-add" data-section="'+si+'"')+'</div></div>').join('');
  }
  async function loadForms(){
    if(detail)return loadFormDetail(detail);
    const data=await api('/api/admin/forms'+location.search);
    root.innerHTML=heading('Forms and signups','Build, publish, review responses, and keep previous revisions intact.',linkBtn('New form','/admin/forms/new','aw-primary'))+
      toolbar([{type:'search',placeholder:'Search forms'},{name:'status',label:'All statuses',options:['draft','published','closed','archived']}])+
      '<div class="aw-list">'+(data.items.length?data.items.map(f=>row(f.title,e(f.access)+' · '+f.response_count+' responses · '+e(date(f.updated_at)),formBase(f.id),badge(f.status))).join(''):empty('No forms found','Build a signup, survey, or feedback form.'))+'</div>'+pageNav(data);bindToolbar();
  }
  async function loadFormDetail(id){
    const isNew=id==='new';
    const data=isNew?{form:{id:null,title:'',description:'',status:'draft',access:'public',opens_at:null,closes_at:null},revision:{schema:{sections:[{id:crypto.randomUUID(),title:'',fields:[]}]}}}:await api('/api/admin/forms/'+encodeURIComponent(id));
    const f=data.form,tab=qp.get('tab')||'builder';
    draftSchema=structuredClone(data.revision?.schema||{sections:[{id:crypto.randomUUID(),title:'',fields:[]}]});
    if(!draftSchema.sections?.length)draftSchema.sections=[{id:crypto.randomUUID(),title:'',fields:[]}];
    const base=isNew?'/admin/forms/new':formBase(f.id);
    const revisions=data.revisions||[],chosen=revisions.find(r=>r.id===qp.get('revision'))||revisions[0];
    const previewSchema=tab==='preview'&&chosen&&chosen.id!==data.revision?.id?(await api('/api/admin/forms/'+encodeURIComponent(f.id)+'/revisions/'+encodeURIComponent(chosen.id))).revision.schema:draftSchema;
    root.innerHTML=heading(isNew?'New form':f.title,isNew?'Create a draft, preview it, then publish.':f.status+' · '+(data.revisions?.length||1)+' revision(s)',isNew?'':linkBtn('Open public form','/form.html?form='+encodeURIComponent(f.slug)))+
      (isNew?'':tabs([['Builder',base+'?tab=builder'],['Preview',base+'?tab=preview'],['Responses',base+'?tab=responses'],['Settings',base+'?tab=settings']],tab[0].toUpperCase()+tab.slice(1)))+
      (tab==='responses'&&!isNew?await renderResponses(f):tab==='preview'&&!isNew?renderFormPreview(previewSchema,f,revisions,chosen):tab==='settings'&&!isNew?renderFormSettings(f,revisions):renderFormEditor(f,isNew));
    if(tab==='builder'||isNew)renderBuilder();
    if(tab==='responses'&&qp.get('response'))await renderResponseDetail(f.id,qp.get('response'));
    bindToolbar();
  }
  function renderFormEditor(f,isNew){
    return '<div class="aw-detail"><div class="aw-detail-main"><div class="aw-form">'+
      card('Form details','<div class="aw-fields">'+field('Title','formTitle',f.title,'text','required maxlength="150"')+
        '<div class="aw-field"><label for="formAccess">Who may respond</label>'+select('formAccess',['public','members','staff'],f.access,null)+'</div>'+
        textField('Description','formDescription',f.description,3)+
        field('Opens at (local time)','formOpens',datetimeInput(f.opens_at),'datetime-local')+
        field('Closes at (local time)','formCloses',datetimeInput(f.closes_at),'datetime-local')+'</div>')+
      '<div id="formBuilder"></div><div class="aw-actions aw-builder-actions">'+btn('Add section','data-action="section-add"')+
      btn(isNew?'Create draft':'Save new revision','data-action="form-save" data-id="'+e(f.id||'')+'"','aw-primary')+
      (isNew?'':btn('Save and publish','data-action="form-publish" data-id="'+e(f.id)+'"'))+'</div></div></div>'+
      detailSide([['Status',badge(f.status)],['Access',e(f.access)],['Opens',e(date(f.opens_at))],['Closes',e(date(f.closes_at))]])+'</div>';
  }
  function renderFormPreview(schema,form,revisions,chosen){
    return '<div class="aw-detail"><div class="aw-detail-main">'+
      '<div class="aw-inline-notice">Previewing revision '+e(String(chosen?.revisionNumber||1))+(chosen?.id===form.published_revision_id?' · currently published':' · not currently published')+'. Responses are not submitted from this page.</div>'+
      '<div class="aw-actions aw-revision-links">'+revisions.map(r=>'<a class="aw-btn'+(r.id===chosen?.id?' aw-primary':'')+'" href="'+formBase(form.id)+'?tab=preview&revision='+encodeURIComponent(r.id)+'">Revision '+e(String(r.revisionNumber))+(r.id===form.published_revision_id?' · Live':'')+'</a>').join('')+'</div>'+
      schema.sections.map((s,i)=>'<section class="aw-card aw-section" style="margin-top:17px"><header><h2>'+e(s.title||'Section '+(i+1))+'</h2></header><div class="aw-card-body">'+
        (s.fields||[]).map(q=>'<div class="aw-field" style="margin-bottom:15px"><label>'+e(q.label)+(q.required?' *':'')+'</label>'+
          (['single-choice','checkboxes','dropdown'].includes(q.type)?'<div class="aw-muted">'+e((q.options||[]).join(' · '))+'</div>':q.type==='paragraph'?'<textarea disabled placeholder="'+e(q.placeholder||'Your answer')+'"></textarea>':'<input disabled placeholder="'+e(q.placeholder||'Your answer')+'">')+
          (q.help?'<small>'+e(q.help)+'</small>':'')+'</div>').join('')+'</div></section>').join('')+'</div></div>';
  }
  function renderFormSettings(f,revisions){
    const actions=f.status==='published'?[['Close','close'],['Archive','archive']]:f.status==='closed'?[['Reopen','reopen'],['Archive','archive']]:f.status==='archived'?[['Restore as draft','restore']]:[['Publish latest revision','publish'],['Archive','archive']];
    return '<div class="aw-detail"><div class="aw-detail-main">'+
      card('Publication','<p>Public forms accept responses only while published and within their opening and closing times.</p><div class="aw-actions">'+actions.map(a=>btn(a[0],'data-action="form-action" data-id="'+e(f.id)+'" data-operation="'+a[1]+'"',a[1]==='archive'?'aw-danger':a[1]==='publish'?'aw-primary':'')).join('')+'</div>')+
      card('Revision history',revisions.map(r=>'<div class="aw-note"><p>Revision '+r.revisionNumber+(r.publishedAt?' · published':' · draft')+'</p><small>'+e(date(r.createdAt))+'</small></div>').join(''))+
      '</div>'+detailSide([['Status',badge(f.status)],['Access',e(f.access)],['Responses',e(String(f.response_count||'See Responses'))]])+'</div>';
  }
  async function renderResponses(f){
    const params=new URLSearchParams(location.search);params.delete('tab');params.delete('response');
    const result=await api('/api/admin/forms/'+encodeURIComponent(f.id)+'/responses?'+params);
    const base=formBase(f.id)+'?tab=responses';
    return '<div class="aw-heading"><div><h2>Responses</h2><p>'+result.total+' submitted responses</p></div><div class="aw-actions">'+linkBtn('Export CSV','/api/admin/forms/'+encodeURIComponent(f.id)+'/responses?format=csv')+'</div></div>'+
      toolbar([{name:'reviewed',label:'All responses',options:['yes','no']}])+
      '<div id="responsesMain"><div class="aw-list">'+(result.items.length?result.items.map(r=>row(r.respondent||'Anonymous',e(date(r.submitted_at))+' · Revision '+e(String(r.revision_id)),base+'&response='+encodeURIComponent(r.id),r.reviewed_at?badge('reviewed'):badge('pending'))).join(''):empty('No responses yet','Submissions will appear when the form is open.'))+'</div>'+pageNav(result)+'</div>';
  }
  async function renderResponseDetail(formId,responseId){
    const {response:r,notes}=await api('/api/admin/forms/'+encodeURIComponent(formId)+'/responses/'+encodeURIComponent(responseId));
    const fields=r.schema.sections.flatMap(s=>s.fields||[]);
    document.getElementById('responsesMain').innerHTML=
      linkBtn('← All responses',formBase(formId)+'?tab=responses')+
      '<div class="aw-detail" style="margin-top:16px"><div class="aw-detail-main">'+
      card('Response by '+(r.respondent||'Anonymous'),'<div class="aw-answers">'+fields.map(q=>'<div class="aw-answer"><strong>'+e(q.label)+'</strong><span>'+e(Array.isArray(r.answers[q.id])?r.answers[q.id].join(', '):r.answers[q.id]??'—')+'</span></div>').join('')+'</div>')+
      noteEditor('form-response',r.id,notes)+'</div>'+
      '<aside class="aw-side">'+card('Review','<p>'+e(date(r.submitted_at))+' · Revision '+e(String(r.revision_number))+'</p><p>'+badge(r.reviewed_at?'reviewed':'pending')+'</p>'+btn(r.reviewed_at?'Mark unreviewed':'Mark reviewed','data-action="response-review" data-form="'+e(formId)+'" data-id="'+e(r.id)+'" data-reviewed="'+(r.reviewed_at?'false':'true')+'"','aw-primary'))+'</aside></div>';
  }
  async function loadTeams(){
    if(detail)return loadTeamDetail(detail);
    const data=await api('/api/admin/teams'+location.search);
    root.innerHTML=heading('Teams','See every team and its members, invitations, and projects.')+
      toolbar([{type:'search',placeholder:'Search team or owner'},{name:'status',label:'All statuses',options:['active','archived']}])+
      '<div class="aw-list">'+(data.items.length?data.items.map(t=>row(t.name,'Owned by '+e(t.owner_name)+' · '+t.member_count+' members · '+t.project_count+' projects','/admin/teams/'+t.id,badge(t.status))).join(''):empty('No teams found','Try another search or filter.'))+'</div>'+pageNav(data);bindToolbar();
  }
  async function loadTeamDetail(id){
    const data=await api('/api/admin/teams/'+encodeURIComponent(id));
    const t=data.team,tab=qp.get('tab')||'overview',base='/admin/teams/'+encodeURIComponent(t.id);
    const canManage=['club-leader','teacher'].includes(user.role);
    root.innerHTML=heading(t.name,'Team oversight · owned by '+t.owner_name,linkBtn('Member team page','/teams/'+encodeURIComponent(t.slug)))+
      tabs([['Overview',base+'?tab=overview'],['Members',base+'?tab=members'],['Invitations',base+'?tab=invitations'],['Projects',base+'?tab=projects'],['Settings',base+'?tab=settings']],tab[0].toUpperCase()+tab.slice(1))+
      (tab==='members'?'<div class="aw-list">'+(data.members.length?data.members.map(m=>'<article class="aw-row"><div class="aw-row-copy"><a href="/admin/members/'+e(m.user_id)+'">'+e(m.display_name)+'</a><span>Joined '+e(date(m.joined_at))+'</span></div>'+badge(m.role)+(canManage&&m.role!=='owner'?'<div class="aw-actions">'+select('teamRole-'+m.user_id,['member','admin'],m.role,null)+btn('Save','data-action="team-member-role" data-team="'+e(t.id)+'" data-id="'+e(m.user_id)+'"')+btn('Remove','data-action="team-member-remove" data-team="'+e(t.id)+'" data-id="'+e(m.user_id)+'"','aw-danger')+'</div>':'')+'</article>').join(''):empty('No members','This team has no active members.'))+'</div>':
      tab==='invitations'?'<div class="aw-detail"><div class="aw-detail-main">'+card('Invitations',data.invitations.length?data.invitations.map(i=>'<div class="aw-row"><div class="aw-row-copy"><strong>'+e(i.invited_name)+'</strong><span>'+e(i.status)+' · expires '+e(date(i.expires_at))+'</span></div>'+badge(i.status)+(canManage&&i.status==='pending'?btn('Cancel','data-action="team-invite-cancel" data-team="'+e(t.id)+'" data-id="'+e(i.id)+'"','aw-danger'):'')+'</div>').join(''):empty('No invitations','Search for a member to invite them.'))+'</div><aside class="aw-side">'+(canManage?card('Invite a member','<div class="aw-field"><label for="inviteSearch">Find member</label><input id="inviteSearch" type="search" placeholder="Search display name"></div>'+btn('Search','data-action="invite-search" data-team="'+e(t.id)+'"')+'<div id="inviteResults"></div>'+textField('Invitation message','inviteMessage','',3)):'')+'</aside></div>':
      tab==='projects'?'<div class="aw-list">'+(data.projects.length?data.projects.map(p=>row(p.title,e(p.status)+' · '+e(p.visibility),'/admin/projects/'+p.id,badge(p.status))).join(''):empty('No projects','No projects are associated with this team.'))+'</div>':
      tab==='settings'?'<div class="aw-detail"><div class="aw-detail-main">'+card('Team details','<form class="aw-form" id="teamEditForm"><div class="aw-fields">'+field('Name','teamName',t.name,'text','required maxlength="80"')+field('Website','teamWebsite',t.website_url||'','url')+textField('Description','teamDescription',t.description,3)+textField('Markdown introduction','teamIntro',t.introduction_markdown,12)+'</div><div class="aw-actions"><button class="aw-btn aw-primary" type="submit"'+(canManage?'':' disabled')+'>Save team details</button></div></form>')+
      (canManage?card('Team avatar','<div class="aw-field"><label for="teamAvatar">PNG, JPEG or WebP, under 2 MB</label><input id="teamAvatar" type="file" accept="image/png,image/jpeg,image/webp"></div><div class="aw-actions" style="margin-top:12px">'+btn('Upload avatar','data-action="team-avatar-upload" data-id="'+e(t.id)+'"')+btn('Remove avatar','data-action="team-avatar-remove" data-id="'+e(t.id)+'"')+'</div>')+
      card('Ownership and archive','<div class="aw-field"><label for="teamNewOwner">Transfer to active member</label>'+select('teamNewOwner',data.members.filter(m=>m.user_id!==t.owner_user_id).map(m=>m.user_id),'','Choose member')+'</div><p class="aw-help">Select a member by ID from the roster above.</p><div class="aw-field"><label for="teamReason">Reason for staff action</label><input id="teamReason" maxlength="500"></div><div class="aw-actions" style="margin-top:12px">'+btn('Transfer ownership','data-action="team-transfer" data-id="'+e(t.id)+'"')+btn(t.status==='archived'?'Restore team':'Archive team','data-action="team-archive" data-id="'+e(t.id)+'" data-operation="'+(t.status==='archived'?'restore':'archive')+'"',t.status==='archived'?'':'aw-danger')+'</div>'):'')+
      '</div>'+detailSide([['Status',badge(t.status)],['Owner',e(t.owner_name)],['Members',String(data.members.length)],['Projects',String(data.projects.length)]])+'</div>':
      '<div class="aw-detail"><div class="aw-detail-main">'+(t.avatarUrl?'<img src="'+e(t.avatarUrl)+'" width="76" height="76" alt="Team avatar" style="object-fit:cover;border-radius:8px">':'')+
      card('Introduction','<p>'+e(t.description||'No description yet.')+'</p><div class="aw-preview">'+t.introductionHtml+'</div>')+
      noteEditor('team',t.id,data.notes)+
      card('Staff history',data.history.length?data.history.map(h=>'<div class="aw-note"><p>'+e(h.action)+' · '+e(h.actor||'Staff')+'</p><small>'+e(date(h.created_at))+'</small></div>').join(''):empty('No staff actions','Team changes by staff will appear here.'))+
      '</div>'+detailSide([['Status',badge(t.status)],['Owner',e(t.owner_name)],['Members',String(data.members.length)],['Projects',String(data.projects.length)],['Website',t.website_url?'<a href="'+e(t.website_url)+'" target="_blank" rel="noopener noreferrer">Open site</a>':'—']])+'</div>');
    document.getElementById('teamEditForm')?.addEventListener('submit',ev=>{ev.preventDefault();run(async()=>{await mutate('/api/admin/teams/'+t.id,'PUT',{name:value('teamName'),description:value('teamDescription'),introductionMarkdown:value('teamIntro'),websiteUrl:value('teamWebsite')});toast('Team updated.');location.reload();});});
  }
  async function loadBroadcasts(){
    if(detail)return loadBroadcastDetail(detail);
    const data=await api('/api/admin/broadcasts'+location.search);
    root.innerHTML=heading('Broadcasts','In-app announcements with drafts, scheduling, and tracked delivery.',linkBtn('New broadcast','/admin/broadcasts/new','aw-primary'))+
      toolbar([{type:'search',placeholder:'Search broadcasts'},{name:'status',label:'All states',options:['draft','scheduled','sending','sent','cancelled']}])+
      '<div class="aw-list">'+(data.items.length?data.items.map(b=>row(b.title,e(b.audience_type==='all'?'All active users':b.audience_value)+' · '+e(b.scheduled_at?'Scheduled '+date(b.scheduled_at):date(b.created_at)),'/admin/broadcasts/'+b.id,badge(b.status==='draft'&&b.scheduled_at?'scheduled':b.status)+' <span class="aw-muted">'+b.delivered_count+'/'+b.recipient_total+'</span>')).join(''):empty('No broadcasts found','Draft an announcement to update the club.'))+'</div>'+pageNav(data);bindToolbar();
  }
  function broadcastBody(){
    return {title:value('broadcastTitle'),body:value('broadcastBody'),audienceType:value('broadcastAudience'),audienceValue:value('broadcastRole'),actionUrl:value('broadcastUrl')};
  }
  async function loadBroadcastDetail(id){
    const isNew=id==='new',data=isNew?{broadcast:{title:'',body:'',audience_type:'all',audience_value:'member',action_url:'',status:'draft',recipient_total:0}}:await api('/api/admin/broadcasts/'+encodeURIComponent(id));
    const b=data.broadcast,tab=qp.get('tab')||'compose',editable=b.status==='draft'&&!b.send_started_at;
    root.innerHTML=heading(isNew?'New broadcast':b.title,isNew?'Create and preview a draft before it reaches members.':'Created '+date(b.created_at),isNew?'':linkBtn('Back to broadcasts','/admin/broadcasts'))+
      (isNew?'':tabs([['Compose','/admin/broadcasts/'+b.id+'?tab=compose'],['Delivery','/admin/broadcasts/'+b.id+'?tab=delivery']],tab[0].toUpperCase()+tab.slice(1)))+
      (tab==='delivery'&&!isNew?await renderDeliveries(b,data.deliveries):'<div class="aw-detail"><div class="aw-detail-main">'+
      card('Message','<div class="aw-form">'+field('Title','broadcastTitle',b.title,'text','required maxlength="150"'+(editable?'':' disabled'))+
      textField('Message','broadcastBody',b.body,9)+
      '<div class="aw-fields"><div class="aw-field"><label for="broadcastAudience">Audience</label>'+select('broadcastAudience',['all','role'],b.audience_type,null)+'</div>'+
      '<div class="aw-field"><label for="broadcastRole">Role when audience is one role</label>'+select('broadcastRole',roles,b.audience_value||'member',null)+'</div>'+
      field('Action link (optional)','broadcastUrl',b.action_url||'','url')+
      field('Schedule for (local time)','broadcastTime',datetimeInput(b.scheduled_at),'datetime-local')+'</div>'+
      '<p class="aw-help">The audience is counted again when sending starts. Scheduled times are stored in UTC.</p><div class="aw-actions">'+
      btn('Preview audience','data-action="broadcast-preview"')+
      (editable?btn(isNew?'Save draft':'Save changes','data-action="broadcast-save" data-id="'+e(b.id||'')+'"','aw-primary')+
      btn('Send now','data-action="broadcast-send" data-id="'+e(b.id||'')+'"')+
      btn('Schedule','data-action="broadcast-schedule" data-id="'+e(b.id||'')+'"'):'')+
      (editable&&!isNew?btn('Cancel draft','data-action="broadcast-cancel" data-id="'+e(b.id)+'"','aw-danger'):'')+
      (data.deliveries?.failed?btn('Retry failed deliveries','data-action="broadcast-retry" data-id="'+e(b.id)+'"'):'')+
      '</div><div id="broadcastPreview"></div></div>')+
      '</div>'+detailSide([['State',badge(b.status==='draft'&&b.scheduled_at&&!b.send_started_at?'scheduled':b.status)],['Scheduled',e(date(b.scheduled_at))],['Started',e(date(b.send_started_at))],['Delivered',String(data.deliveries?.delivered||0)],['Failed',String(data.deliveries?.failed||0)]])+'</div>');
    if(!editable){['broadcastBody','broadcastAudience','broadcastRole','broadcastUrl','broadcastTime'].forEach(x=>{const node=document.getElementById(x);if(node)node.disabled=true;});}
  }
  async function renderDeliveries(b,stats){
    const params=new URLSearchParams(location.search);params.delete('tab');
    const data=await api('/api/admin/broadcasts/'+b.id+'/deliveries?'+params);
    return '<div class="aw-metrics">'+[['Recipients',stats.total],['Delivered',stats.delivered],['Failed',stats.failed]].map(x=>'<div class="aw-metric"><span>'+e(x[0])+'</span><strong>'+x[1]+'</strong></div>').join('')+'</div>'+
      toolbar([{name:'status',label:'All deliveries',options:['pending','delivered','failed']}])+
      '<div class="aw-list">'+(data.items.length?data.items.map(d=>'<div class="aw-row"><div class="aw-row-copy"><strong>'+e(d.recipient)+'</strong><span>'+e(date(d.delivered_at))+'</span></div>'+badge(d.status)+'</div>').join(''):empty('No deliveries','Recipients are selected when sending begins.'))+'</div>'+pageNav(data);
  }
  async function loadContacts(){
    if(detail)return loadContactDetail(detail);
    const data=await api('/api/admin/contacts'+location.search);
    root.innerHTML=heading('Contact inbox','Assign, discuss, and resolve messages from the public site.')+
      toolbar([{type:'search',placeholder:'Search sender or message'},{name:'status',label:'All states',options:['new','in-progress','resolved']}])+
      '<div class="aw-list">'+(data.items.length?data.items.map(c=>row(c.name,e(c.message.slice(0,120))+' · '+e(date(c.created_at)),'/admin/contacts/'+c.id,badge(c.status))).join(''):empty('No messages found','New public contact messages will appear here.'))+'</div>'+pageNav(data);bindToolbar();
  }
  async function loadContactDetail(id){
    const [{contact:c,notes,history},{staff}]=await Promise.all([api('/api/admin/contacts/'+encodeURIComponent(id)),api('/api/admin/staff')]);
    root.innerHTML=heading('Message from '+c.name,'Received '+date(c.created_at),linkBtn('Back to inbox','/admin/contacts'))+
      '<div class="aw-detail"><div class="aw-detail-main">'+
      card('Message','<p style="white-space:pre-wrap">'+e(c.message)+'</p>')+
      noteEditor('contact',c.id,notes)+
      card('Contact history',history.length?history.map(h=>'<div class="aw-note"><p>'+e(h.action)+' · '+e(h.actor||'Staff')+'</p><small>'+e(date(h.created_at))+'</small></div>').join(''):empty('No actions','Updates will appear here.'))+
      '</div><aside class="aw-side">'+card('Triage',
      '<div class="aw-field"><label for="contactStatus">Status</label>'+select('contactStatus',['new','in-progress','resolved'],c.status,null)+'</div>'+
      '<div class="aw-field" style="margin-top:12px"><label for="contactAssignee">Assigned staff member</label><select id="contactAssignee"><option value="">Unassigned</option>'+staff.map(s=>'<option value="'+e(s.id)+'"'+(s.id===c.assigned_to_user_id?' selected':'')+'>'+e(s.display_name)+'</option>').join('')+'</select></div>'+
      '<div class="aw-actions" style="margin-top:14px">'+btn('Save triage','data-action="contact-save" data-id="'+e(c.id)+'"','aw-primary')+'</div>')+
      card('Sender','<dl><dt>Name</dt><dd>'+e(c.name)+'</dd><dt>WeChat</dt><dd>'+e(c.wechat_id)+'</dd><dt>Received</dt><dd>'+e(date(c.created_at))+'</dd></dl>')+'</aside></div>';
  }
  async function loadSettings(){
    const tab=qp.get('tab')||'general',base='/admin/settings';
    root.innerHTML=heading('Settings','Club controls, NFC card inventory, and staff accountability.')+
      tabs([['General',base+'?tab=general'],['NFC cards',base+'?tab=nfc'],['Audit log',base+'?tab=audit']],tab==='nfc'?'NFC cards':tab==='audit'?'Audit log':'General')+
      (tab==='nfc'?await renderNfcSettings():tab==='audit'?await renderAuditSettings():await renderGeneralSettings());
    bindToolbar();
  }
  async function renderGeneralSettings(){
    const data=await api('/api/admin/settings');
    return '<div class="aw-detail"><div class="aw-detail-main">'+card('Competition controls','<p>Controls competition actions across the site.</p><label class="aw-checkbox"><input id="competitionActive" type="checkbox"'+(data.competitionActive?' checked':'')+(data.canChangeCompetition?'':' disabled')+'> Allow competition actions</label><div class="aw-actions" style="margin-top:15px">'+btn('Save setting','data-action="setting-competition"'+(data.canChangeCompetition?'':' disabled'),'aw-primary')+'</div>')+
      card('NFC card stock','<div class="aw-metrics">'+[['Unclaimed',data.cards.unclaimed||0],['Claimed',data.cards.claimed||0],['Disabled',data.cards.disabled||0]].map(x=>'<div class="aw-metric"><span>'+e(x[0])+'</span><strong>'+x[1]+'</strong></div>').join('')+'</div>'+linkBtn('Open NFC inventory','/admin/settings?tab=nfc'))+'</div></div>';
  }
  async function renderNfcSettings(){
    const data=await api('/api/admin/nfc-cards'+(qp.get('tab')?('?'+new URLSearchParams([...qp].filter(x=>x[0]!=='tab'))):''));
    const canManage=['club-leader','teacher'].includes(user.role);
    return '<div class="aw-detail"><div class="aw-detail-main">'+
      toolbar([{type:'search',placeholder:'Search card label or owner'},{name:'status',label:'All cards',options:['unclaimed','claimed','disabled']}])+
      '<div class="aw-list">'+(data.items.length?data.items.map(c=>'<div class="aw-row"><div class="aw-row-copy"><strong>'+e(c.label)+'</strong><span>'+e(c.owner_name||'Unclaimed')+' · '+c.scan_count+' scans · Last scan '+e(date(c.last_scanned_at))+'</span></div>'+badge(c.status)+(canManage?btn(c.status==='disabled'?'Enable':'Disable','data-action="nfc-status" data-id="'+e(c.id)+'" data-operation="'+(c.status==='disabled'?'enable':'disable')+'"',c.status==='disabled'?'':'aw-danger'):'')+'</div>').join(''):empty('No cards match','Issue cards or change the filter.'))+'</div>'+pageNav(data)+'</div>'+
      '<aside class="aw-side">'+(canManage?card('Issue new cards','<p class="aw-help">Generated card URLs are returned once. Save the download before leaving this page.</p>'+field('Number of cards','newCardCount','1','number','min="1" max="200"')+'<div class="aw-actions" style="margin-top:12px">'+btn('Issue and download CSV','data-action="nfc-issue"','aw-primary')+'</div>'):'')+
      card('Card handling','<p>Disabling a card blocks claiming and profile redirects without erasing its claim. Scan attempts remain counted. Re-enabling restores its claimed or unclaimed state.</p>')+'</aside></div>';
  }
  async function renderAuditSettings(){
    if(!['club-leader','teacher'].includes(user.role))return '<div class="aw-error">Only club leaders and teachers can view the audit log.</div>';
    const params=new URLSearchParams(location.search);params.delete('tab');
    const data=await api('/api/admin/audit?'+params);
    return '<div class="aw-list">'+(data.items.length?data.items.map(a=>'<div class="aw-row"><div class="aw-row-copy"><strong>'+e(a.action)+'</strong><span>'+e(a.actor||'Staff')+' · '+e(a.target_type||'')+' · '+e(date(a.created_at))+'</span></div></div>').join(''):empty('No changes recorded','Staff actions will appear here.'))+'</div>'+pageNav(data);
  }
  async function saveForm(id,publish=false){
    readEditor();
    const body={title:value('formTitle'),description:value('formDescription'),access:value('formAccess'),opensAt:toIso(value('formOpens')),closesAt:toIso(value('formCloses')),schema:draftSchema};
    if(!body.title.trim())throw new Error('Form title is required.');
    if(!draftSchema.sections.some(s=>s.fields.length))throw new Error('Add at least one question.');
    let formId=id;
    if(!formId){const created=await mutate('/api/admin/forms','POST',body);formId=created.form.id;}
    else await mutate('/api/admin/forms/'+formId,'PUT',body);
    if(publish)await mutate('/api/admin/forms/'+formId+'/publish','POST',{});
    location.href=formBase(formId)+'?tab='+(publish?'settings':'builder');
  }
  async function saveBroadcast(id){
    const body=broadcastBody();
    if(!body.title.trim()||!body.body.trim())throw new Error('Add a title and message.');
    if(!id){const result=await mutate('/api/admin/broadcasts/drafts','POST',body);return result.id;}
    await mutate('/api/admin/broadcasts/'+id,'PUT',body);return id;
  }
  root.addEventListener('change',event=>{
    if(event.target.matches('.aw-question-type')&&['single-choice','checkboxes','dropdown'].includes(event.target.value))event.target.closest('.aw-builder-question').querySelector('.aw-question-advanced').open=true;
  });
  root.addEventListener('input',event=>{
    if(event.target.matches('.aw-question-label'))event.target.closest('.aw-builder-question').querySelector('.aw-question-toggle').textContent='Question '+(1+[...event.target.closest('.aw-builder-section').querySelectorAll('.aw-builder-question')].indexOf(event.target.closest('.aw-builder-question')))+' · '+(event.target.value||'Untitled');
  });
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-action]');
    if(!target)return;
    const action=target.dataset.action,id=target.dataset.id;
    run(async()=>{
      if(action==='note')return addNote(target.dataset.type,id);
      if(action==='member-role'){
        const role=value('memberRole');
        if(!(await confirmAction('Change global role?','This changes what the member can do across the club.')))return;
        await mutate('/api/admin/users/'+id,'PUT',{role});location.reload();
      }
      if(action==='member-status'){
        const status=value('memberStatus');
        if(!(await confirmAction('Change account status?','Suspending or archiving an account ends access to the workspace.')))return;
        await mutate('/api/admin/users/'+id,'PUT',{status});location.reload();
      }
      if(action==='member-password'){
        const password=value('memberPassword');
        if(password.length<8)throw new Error('Use at least 8 characters.');
        if(!(await confirmAction('Reset this password?','The member must use the new password to sign in again.')))return;
        await mutate('/api/admin/users/'+id+'/password','PUT',{password});
        document.getElementById('memberPassword').value='';toast('Password reset. Share it directly with the member.');
      }
      if(action==='project-status'){
        const status=target.dataset.status,note=value('reviewNote');
        if(status==='changes-requested'&&!note.trim())throw new Error('Explain the requested changes first.');
        if(!(await confirmAction('Change project status?','The owner will receive your decision and feedback.')))return;
        await mutate('/api/admin/projects/'+id+'/status','PUT',{status,note});location.reload();
      }
      if(action==='section-add'){readEditor();draftSchema.sections.push({id:crypto.randomUUID(),title:'',fields:[]});renderBuilder();return;}
      if(action==='section-remove'){readEditor();if(draftSchema.sections.length===1)throw new Error('Keep at least one section.');draftSchema.sections.splice(Number(target.dataset.index),1);renderBuilder();return;}
      if(action==='question-toggle'){const question=target.closest('.aw-builder-question'),content=question.querySelector('.aw-question-content'),open=content.hidden;content.hidden=!open;target.setAttribute('aria-expanded',String(open));if(open)expandedQuestions.add(question.dataset.id);else expandedQuestions.delete(question.dataset.id);return;}
      if(['question-add','question-remove','question-up','question-down'].includes(action)){
        readEditor();const si=Number(target.dataset.section),qi=Number(target.dataset.index),fields=draftSchema.sections[si].fields;
        if(action==='question-add'){const type=target.parentElement.querySelector('.aw-add-type').value,item={id:crypto.randomUUID(),type,label:'Untitled question',help:'',placeholder:'',required:false,options:['single-choice','checkboxes','dropdown'].includes(type)?['Option 1']:[]};fields.push(item);expandedQuestions.add(item.id);}
        if(action==='question-remove'){expandedQuestions.delete(fields[qi].id);fields.splice(qi,1);}
        if(action==='question-up'&&qi>0)[fields[qi-1],fields[qi]]=[fields[qi],fields[qi-1]];
        if(action==='question-down'&&qi<fields.length-1)[fields[qi+1],fields[qi]]=[fields[qi],fields[qi+1]];
        renderBuilder();return;
      }
      if(action==='form-save'||action==='form-publish')return saveForm(id,action==='form-publish');
      if(action==='form-action'){
        const operation=target.dataset.operation;
        if(!(await confirmAction(operation[0].toUpperCase()+operation.slice(1)+' form?','This changes when members can access and respond to the form.')))return;
        await mutate('/api/admin/forms/'+id+'/'+operation,'POST',{});location.reload();
      }
      if(action==='response-review'){await mutate('/api/admin/forms/'+target.dataset.form+'/responses/'+id,'PUT',{reviewed:target.dataset.reviewed==='true'});location.reload();}
      if(action==='team-member-role'){await mutate('/api/admin/teams/'+target.dataset.team+'/members/'+id,'PUT',{role:value('teamRole-'+id)});location.reload();}
      if(action==='team-member-remove'){
        if(!(await confirmAction('Remove team member?','The member will lose access to this team.')))return;
        await mutate('/api/admin/teams/'+target.dataset.team+'/members/'+id,'PUT',{status:'removed'});location.reload();
      }
      if(action==='team-invite-cancel'){if(!(await confirmAction('Cancel invitation?','This pending invitation will no longer be usable.')))return;await mutate('/api/admin/teams/'+target.dataset.team+'/invitations/'+id,'DELETE',{});location.reload();}
      if(action==='invite-search'){
        const q=value('inviteSearch').trim();if(q.length<2)throw new Error('Enter at least two characters.');
        const data=await api('/api/admin/members?q='+encodeURIComponent(q)+'&status=active&limit=20');
        document.getElementById('inviteResults').innerHTML=data.items.length?data.items.map(m=>'<div class="aw-row"><div class="aw-row-copy"><strong>'+e(m.display_name)+'</strong><span>'+e(m.class_grade)+'</span></div>'+btn('Invite','data-action="invite-send" data-team="'+e(target.dataset.team)+'" data-id="'+e(m.id)+'"')+'</div>').join(''):empty('No matches','Try another name.');return;
      }
      if(action==='invite-send'){await mutate('/api/admin/teams/'+target.dataset.team+'/invitations','POST',{userId:id,message:value('inviteMessage')});location.reload();}
      if(action==='team-transfer'){
        const userId=value('teamNewOwner');if(!userId)throw new Error('Choose an active member.');
        if(!(await confirmAction('Transfer team ownership?','The selected member becomes the new owner.')))return;
        await mutate('/api/admin/teams/'+id+'/transfer','POST',{userId,reason:value('teamReason')});location.reload();
      }
      if(action==='team-archive'){
        const operation=target.dataset.operation;
        if(!(await confirmAction(operation==='archive'?'Archive team?':'Restore team?','Members will see the team state change.')))return;
        await mutate('/api/admin/teams/'+id+'/'+operation,'POST',{reason:value('teamReason')});location.reload();
      }
      if(action==='team-avatar-upload'){
        const file=document.getElementById('teamAvatar').files[0];if(!file)throw new Error('Choose an image.');
        if(file.size>2_000_000)throw new Error('Image must be under 2 MB.');
        const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read the image.'));reader.readAsDataURL(file);});
        await mutate('/api/admin/teams/'+id+'/avatar','POST',{dataUrl});location.reload();
      }
      if(action==='team-avatar-remove'){if(!(await confirmAction('Remove avatar?','The team avatar will be removed.')))return;await mutate('/api/admin/teams/'+id+'/avatar','DELETE',{});location.reload();}
      if(action==='broadcast-preview'){const preview=await mutate('/api/admin/broadcasts/preview','POST',broadcastBody());document.getElementById('broadcastPreview').innerHTML='<div class="aw-inline-notice" style="margin-top:17px"><strong>'+e(preview.title)+'</strong><p>'+e(preview.body)+'</p><small>Estimated recipients: '+preview.count+'. The final audience is selected when sending starts.</small></div>';return;}
      if(action==='broadcast-save'){const saved=await saveBroadcast(id);location.href='/admin/broadcasts/'+saved;}
      if(action==='broadcast-send'){
        if(!(await confirmAction('Send broadcast now?','This creates in-app notifications for the selected active audience.')))return;
        const saved=await saveBroadcast(id);await mutate('/api/admin/broadcasts/'+saved+'/send','POST',{});location.href='/admin/broadcasts/'+saved+'?tab=delivery';
      }
      if(action==='broadcast-schedule'){
        const scheduledAt=toIso(value('broadcastTime'));if(!scheduledAt)throw new Error('Choose a scheduled time.');
        const saved=await saveBroadcast(id);await mutate('/api/admin/broadcasts/'+saved+'/schedule','POST',{scheduledAt});location.href='/admin/broadcasts/'+saved;
      }
      if(action==='broadcast-cancel'){if(!(await confirmAction('Cancel broadcast?','A cancelled draft cannot be sent.')))return;await mutate('/api/admin/broadcasts/'+id+'/cancel','POST',{});location.reload();}
      if(action==='broadcast-retry'){await mutate('/api/admin/broadcasts/'+id+'/retry','POST',{});location.reload();}
      if(action==='contact-save'){await mutate('/api/admin/contacts/'+id,'PUT',{status:value('contactStatus'),assignedTo:value('contactAssignee')||null});location.reload();}
      if(action==='setting-competition'){await mutate('/api/admin/settings','PUT',{competitionActive:check('competitionActive')});toast('Setting saved.');}
      if(action==='nfc-status'){
        if(!(await confirmAction(target.dataset.operation==='disable'?'Disable NFC card?':'Enable NFC card?','The next scan will use the new card state.')))return;
        await mutate('/api/admin/nfc-cards/'+id,'PUT',{action:target.dataset.operation});location.reload();
      }
      if(action==='nfc-issue'){
        const count=Number(value('newCardCount'));if(!Number.isInteger(count)||count<1||count>200)throw new Error('Choose 1 to 200 cards.');
        if(!(await confirmAction('Issue '+count+' cards?','Save the CSV now. NFC token URLs cannot be recovered later.')))return;
        const issued=await mutate('/api/admin/nfc-cards','POST',{count});
        const csv=['Label,URL',...issued.cards.map(c=>'"'+c.label.replaceAll('"','""')+'","'+c.url.replaceAll('"','""')+'"')].join('\r\n');
        const download=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
        const anchor=document.createElement('a');anchor.href=download;anchor.download='novibenocode-nfc-cards-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(download),60000);
        toast(count+' card URLs issued and downloaded.');
      }
    });
  });
  const menu=document.getElementById('adminMenu'),scrim=document.getElementById('adminScrim');
  const sidebar=document.getElementById('adminSidebar'),main=document.querySelector('.aw-main');
  function setMenu(open){
    document.body.classList.toggle('aw-menu-open',open);
    menu.setAttribute('aria-expanded',String(open));scrim.hidden=!open;main.inert=open;
    document.body.style.overflow=open?'hidden':'';
    if(open){sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-modal','true');sidebar.setAttribute('aria-label','Administration menu');nav.querySelector('a')?.focus();}
    else{sidebar.removeAttribute('role');sidebar.removeAttribute('aria-modal');sidebar.removeAttribute('aria-label');menu.focus();}
  }
  menu.onclick=()=>setMenu(!document.body.classList.contains('aw-menu-open'));scrim.onclick=()=>setMenu(false);
  document.getElementById('adminSidebarClose').onclick=()=>setMenu(false);
  sidebar.addEventListener('click',event=>{if(event.target.closest('a')&&document.body.classList.contains('aw-menu-open'))setMenu(false);});
  document.addEventListener('keydown',event=>{
    if(!document.body.classList.contains('aw-menu-open'))return;
    if(event.key==='Escape'){event.preventDefault();setMenu(false);return;}
    if(event.key==='Tab'){
      const focusable=[...sidebar.querySelectorAll('a,button,[tabindex]:not([tabindex="-1"])')].filter(el=>!el.hidden&&!el.disabled);
      if(!focusable.length)return;
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  async function boot(){
    const hash=location.hash.slice(1).toLowerCase();
    if(path==='/admin.html'||hash&&sections.includes(hash)){location.replace('/admin'+(hash&&hash!=='overview'?'/'+hash:'')+location.search);return;}
    if(!sections.includes(section)){root.innerHTML='<div class="aw-error">Admin page not found.</div>';return;}
    document.getElementById('adminYear').textContent=new Date().getFullYear();
    user=await currentUser();if(!user)return;
    if(!['maintainer','club-leader','teacher'].includes(user.role)){document.querySelector('.aw-shell').classList.add('aw-access-denied');document.getElementById('adminSidebar').hidden=true;menu.hidden=true;document.getElementById('adminCrumb').textContent='Access denied';document.getElementById('adminTopRole').textContent='No access';root.innerHTML=heading('Staff access required','This account cannot open club administration.',linkBtn('Member home','/home'));return;}
    document.getElementById('adminAccount').textContent=user.display_name;
    document.getElementById('adminRole').textContent=user.role;
    document.getElementById('adminTopRole').textContent=user.role;
    const visible=sections.filter(s=>!['forms','broadcasts'].includes(s)||['club-leader','teacher'].includes(user.role));
    nav.innerHTML=visible.map(s=>'<a href="/admin'+(s==='overview'?'':'/'+s)+'"'+(s===section?' aria-current="page"':'')+'><span>'+e(names[s])+'</span></a>').join('');
    document.getElementById('adminCrumb').textContent=names[section];
    document.title=names[section]+' / Administration / No Vibe No Code';
    const pages={overview:loadOverview,members:loadMembers,forms:loadForms,projects:loadProjects,teams:loadTeams,broadcasts:loadBroadcasts,contacts:loadContacts,settings:loadSettings};
    await pages[section]();
  }
  boot().catch(error=>{root.innerHTML='<div class="aw-error">'+e(error.message)+'</div>';});
})();

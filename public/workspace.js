import './product-motion.js';

(() => {
  const {requestJson:request,jsonOptions:json,escapeHtml:e}=window.NVNC;
  const {ready,requireUser,icon,toast,confirmAction,refreshUnread}=window.NVNCWorkspace;
  const root=document.getElementById('workspacePage');
  const [section,rawKey]=location.pathname.split('/').filter(Boolean), key=rawKey?decodeURIComponent(rawKey):null;
  const isProject=section==='projects', isTeam=section==='teams';
  let user,preferences={},current,items=[],cursor=null,total=0,generation=0,dirty=false,initialized=false,searchTimer,inviteTimer,lastOpened,preferenceQueue=Promise.resolve(),filterOpen=false,pendingNoticeFocus=null;
  let selected=new Set(),ownTeams=[];
  const q=()=>new URLSearchParams(location.search);
  const endpoint=()=>`/api/${section}/${encodeURIComponent(current?.id||key)}`;
  const status=value=>`<span class="ws-status ${e(value)}">${e(value)}</span>`;
  const date=value=>value?new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';
  const button=(action,label,extra='',style='secondary-button')=>`<button type="button" class="${style}" data-action="${action}" ${extra}>${label}</button>`;
  const empty=(title,body,action='')=>`<div class="ws-empty"><img src="/mascots/nachoneko-chibi-thinking.png" alt=""><h3>${e(title)}</h3><p>${e(body)}</p>${action}</div>`;
  const heading=(title,description,action='')=>`<header class="page-heading"><div><h1>${e(title)}</h1><p>${e(description)}</p></div>${action}</header>`;
  const options=(values,value)=>values.map(([id,label])=>`<option value="${e(id)}" ${id===value?'selected':''}>${e(label)}</option>`).join('');
  const select=(name,label,values,value)=>`<select data-filter="${name}" aria-label="${label}">${options(values,value)}</select>`;
  const queryHref=patch=>{const next=q();Object.entries(patch).forEach(([k,v])=>{v===null?next.delete(k):next.set(k,v);});return `${location.pathname}?${next}`;};
  const tabs=(entries,active,param='tab')=>`<nav class="ws-tabs" aria-label="${isProject?'Project':isTeam?'Team':'Notification'} views">${entries.map(([id,label,count])=>`<a data-nav href="${e(queryHref({[param]:id,notification:null}))}" ${id===active?'aria-current="page"':''}>${e(label)}${count===undefined?'':`<span class="ws-count">${count}</span>`}</a>`).join('')}</nav>`;
  function navigate(patch,{replace=false}={}) {
    if(dirty&&!window.confirm('Discard your unsaved changes?'))return;
    dirty=false;history[replace?'replaceState':'pushState']({},'',queryHref(patch));selected.clear();render();
  }
  function savePreferences(patch) {
    preferences={...preferences,...patch};
    preferenceQueue=preferenceQueue.catch(()=>{}).then(()=>request('/api/workspace/preferences',{...json('PUT',patch),keepalive:true})).catch(error=>{toast(`Your view could not be saved: ${error.message}`,true);});
    return preferenceQueue;
  }
  function rememberView() {
    const params=q(),values={};for(const name of ['view','sort','status','visibility','team','label','filter','type'])if(params.has(name))values[name]=params.get(name);
    if(user)savePreferences({[section]:values});
  }
  async function allTeams() {
    let next=null,result=[];do{const data=await request('/api/teams?status=all&limit=100'+(next?'&cursor='+encodeURIComponent(next):''));result.push(...data.teams);next=data.nextCursor;}while(next);return result;
  }
  const pinButton=item=>{const pinned=(preferences[isProject?'pinnedProjects':'pinnedTeams']||[]).includes(item.id);return button('pin',icon('pin'),`data-id="${e(item.id)}" aria-label="${pinned?'Unpin':'Pin'} ${e(item.title||item.name)}" aria-pressed="${pinned}"`,'ws-pin');};
  const teamAvatar=(team,large=false)=>team.avatarUrl?`<img class="ws-team-avatar ${large?'large':''}" src="${e(team.avatarUrl)}" alt="">`:`<span class="ws-team-avatar ${large?'large':''}" aria-hidden="true">${e(team.name?.slice(0,1).toUpperCase())}</span>`;
  function projectCard(item,allowPin=true) {return `<article class="ws-item">${item.coverUrl?`<img class="ws-item-cover" src="${e(item.coverUrl)}" alt="" loading="lazy">`:''}<div class="ws-item-main"><h3><a href="/projects/${encodeURIComponent(item.slug)}">${e(item.title)}</a></h3><p>${e(item.summary||'No description yet.')}</p><div class="ws-meta">${status(item.status)}<span>${e(item.visibility)}</span>${item.team_name?`<span>${e(item.team_name)}</span>`:''}<span>Updated ${date(item.updated_at)}</span>${(item.labels||[]).map(label=>`<span class="ws-label">${e(label)}</span>`).join('')}</div></div>${allowPin?pinButton(item):''}</article>`;}
  function teamCard(item) {return `<article class="ws-item">${teamAvatar(item)}<div class="ws-item-main"><h3><a href="/teams/${encodeURIComponent(item.slug)}">${e(item.name)}</a></h3><p>${e(item.description||'Build something together.')}</p><div class="ws-meta">${status(item.status)}<span>${item.memberCount} members</span><span>${e(item.role)}</span><span>Updated ${date(item.updated_at)}</span></div></div>${pinButton(item)}</article>`;}
  const search=(placeholder,value)=>`<label class="ws-search">${icon('search')}<input id="collectionSearch" type="search" value="${e(value||'')}" placeholder="${placeholder}" aria-label="${placeholder}" data-search></label>`;
  const viewSwitch=view=>`<div class="ws-view-switch" aria-label="Display view">${['list','grid'].map(v=>button('view',v[0].toUpperCase()+v.slice(1),`data-value="${v}" aria-pressed="${v===view}"`,'')).join('')}</div>`;
  const loadMore=()=>cursor?`<div class="ws-pagination">${button('more','Load more')}</div>`:'';
  function collectionApi() {const params=q();params.delete('view');params.delete('tab');params.set('limit','20');if(isProject)params.set('mine','1');return `/api/${section}?${params}`;}
  function collectionBody(view) {return `<div class="ws-result-bar"><span>${total} ${section} · ${items.length} shown</span><span>Pins appear first on Home</span></div><section class="ws-collection ${view==='grid'?'is-grid':''}" id="collectionItems">${items.length?items.map(isProject?item=>projectCard(item):teamCard).join(''):empty(`No ${section} here`,q().get('q')?'Try another search or clear the filters.':`Create your first ${isProject?'project':'team'}, or change your filters.`,button('clear','Clear filters'))}</section>${loadMore()}`;}
  async function renderCollection(version) {
    document.title=`${isProject?'Projects':'Teams'} / No Vibe No Code`;
    const params=q(),tab=params.get('tab')||'active',view=params.get('view')||(isProject?'list':'grid');
    const data=await request(collectionApi());if(version!==generation)return;
    items=data[section];cursor=data.nextCursor;total=data.total;
    const title=isProject?'Projects':'Teams',description=isProject?'Your ideas, from the first draft to the next release.':'The people you build with. A space for every team.';
    root.innerHTML=heading(title,description,`<a class="primary-button" href="/${section}/new">${icon('plus')}New ${isProject?'project':'team'}</a>`)+(isTeam?tabs([['active','Active'],['invitations','Invitations',data.invitations.length],['archived','Archived']],tab):'');
    if(isTeam&&tab==='invitations') {root.insertAdjacentHTML('beforeend',`<section class="ws-collection">${data.invitations.length?data.invitations.map(invite=>`<article class="ws-item"><div class="ws-item-main"><h3>${e(invite.team_name)}</h3><p>${e(invite.message||`${invite.inviter_name} invited you to join.`)}</p><div class="ws-meta">From ${e(invite.inviter_name)} · Expires ${date(invite.expires_at)}</div></div><div class="ws-actions">${button('invitation','Accept',`data-id="${e(invite.id)}" data-value="accepted"`,'primary-button')}${button('invitation','Decline',`data-id="${e(invite.id)}" data-value="declined"`)}</div></article>`).join(''):empty('All caught up','New team invitations will appear here. You can also find them in Notifications.')}</section>`);return;}
    const controls=(isProject?select('status','Project status',[['active','Active projects'],['','All statuses'],...['draft','submitted','changes-requested','approved','published','archived'].map(s=>[s,s[0].toUpperCase()+s.slice(1)])],params.get('status')??'active')+select('visibility','Visibility',[['','All visibility'],['private','Private'],['members','Members'],['public','Public']],params.get('visibility')||'')+select('team','Team',[['','All teams'],...ownTeams.map(t=>[t.id,t.name])],params.get('team')||'')+`<input id="labelFilter" data-label-filter aria-label="Label filter" placeholder="Filter by label" value="${e(params.get('label')||'')}" maxlength="32" size="14">`:'')+select('sort','Sort by',[['updated','Recently updated'],['name','Name A–Z']],params.get('sort')||'updated')+viewSwitch(view);
    const active=[['status',params.get('status')],['visibility',params.get('visibility')],['team',ownTeams.find(t=>t.id===params.get('team'))?.name],['label',params.get('label')],['sort',params.get('sort')==='name'?'Name A–Z':null]].filter(([,value])=>value&&value!=='active');
    root.insertAdjacentHTML('beforeend',`<div class="ws-toolbar ws-collection-toolbar">${search(`Search ${section}`,params.get('q'))}<details class="ws-filter-details" ${filterOpen||matchMedia('(min-width: 821px)').matches?'open':''}><summary>Filters${active.length?` · ${active.length} active`:''}</summary><div class="ws-filter-grid">${controls}<div class="ws-filter-actions">${button('clear','Clear filters')}<button type="button" class="secondary-button" data-close-filters>Done</button></div></div></details></div>${active.length?`<div class="ws-active-filters" aria-label="Active filters">${active.map(([name,value])=>`<span class="ws-label">${e(name)}: ${e(value)}</span>`).join('')}</div>`:''}<div id="collectionBody">${collectionBody(view)}</div>`);
  }
  const field=(name,label,value='',extra='',kind='input')=>`<label class="ws-field"><span>${label}</span>${kind==='textarea'?`<textarea name="${name}" ${extra}>${e(value)}</textarea>`:`<input name="${name}" value="${e(value)}" ${extra}>`}</label>`;
  const formSelect=(name,label,values,value)=>`<label class="ws-field"><span>${label}</span><select name="${name}">${options(values,value)}</select></label>`;
  function markdownField(name,label,value) {return `<div class="ws-field"><label for="markdownInput">${label}</label><textarea id="markdownInput" name="${name}" class="ws-code" maxlength="50000" placeholder="# What are you building?">${e(value||'')}</textarea><div class="ws-actions">${button('preview','Preview Markdown')}<small>Markdown supported. Up to 50,000 characters.</small></div><div id="markdownPreview" class="workspace-markdown ws-preview" hidden></div></div>`;}
  const formEnd=label=>`<p class="ws-form-status" role="status"></p><div class="ws-actions"><button class="primary-button" type="submit">${label}</button><span class="ws-help" data-save-note></span></div>`;
  function projectFields(item={},settings=false) {
    const teamOptions=[['','No team'],...ownTeams.filter(t=>t.status==='active'||t.id===item.team_id).map(t=>[t.id,t.name+(t.status==='archived'?' (archived)':'')])];
    if(item.team_id&&!teamOptions.some(([id])=>id===item.team_id))teamOptions.push([item.team_id,item.team_name||'Current team']);
    if(settings)return `<div class="ws-fields">${formSelect('visibility','Visibility',[['private','Private — only you and staff'],['members','Members — after publishing'],['public','Public — after publishing']],item.visibility||'private')}${formSelect('teamId','Associated team',teamOptions,item.team_id||'')}</div><p class="ws-help">Team association groups your project. You remain its owner; teammates do not gain editing access. Only published projects are visible to other members or visitors.</p>`;
    return field('title','Project name',item.title,'required maxlength="100"')+field('summary','Description',item.summary,'maxlength="300"','textarea')+markdownField('contentMarkdown','README',item.content_markdown)+`<div class="ws-fields">${field('demoUrl','Demo link',item.demo_url,'type="url" maxlength="500" placeholder="https://"')}${field('sourceUrl','Source link',item.source_url,'type="url" maxlength="500" placeholder="https://github.com/"')}</div>`+field('labels','Labels',item.labels?.join(', '),'maxlength="330" placeholder="web, game, experiment"')+`<p class="ws-help">Separate labels with commas. Up to 10 labels, 32 characters each.</p>`;
  }
  function teamFields(item={}) {return field('name','Team name',item.name,'required maxlength="80"')+field('description','Description',item.description,'maxlength="300"','textarea')+markdownField('introductionMarkdown','Team introduction',item.introduction_markdown)+field('websiteUrl','Website',item.website_url,'type="url" maxlength="500" placeholder="https://"');}
  function renderNew() {document.title=`New ${isProject?'project':'team'} / No Vibe No Code`;root.innerHTML=`<p class="ws-breadcrumb"><a href="/${section}">${isProject?'Projects':'Teams'}</a> / New</p>`+heading(`Create a ${isProject?'project':'team'}`,isProject?'Start with a draft. You can submit it for staff review when it’s ready.':'Give your collaborators a shared home.')+`<form class="ws-form ws-editor" data-form="create">${isProject?projectFields()+projectFields({},true):teamFields()}<p class="ws-help">${isProject?'Add a cover image after creating your draft.':'Add a team avatar after creating your team.'}</p>${formEnd(isProject?'Create draft':'Create team')}</form>`;}
  function upload(kind,url) {return `<section class="ws-form-section"><h3>${kind==='cover'?'Project cover':'Team avatar'}</h3><div class="ws-upload">${url?`<img src="${e(url)}" alt="Current ${kind}">`:''}<div><label class="ws-field"><span>Upload ${kind}</span><input type="file" data-upload="${kind}" accept="image/png,image/jpeg,image/webp"></label><small class="ws-help">PNG, JPG or WebP · up to 2 MB</small></div>${url?button('remove-image','Remove image',`data-value="${kind}"`):''}</div></section>`;}
  async function renderProject(version) {
    const {project}=await request(`/api/projects/${encodeURIComponent(key)}`);if(version!==generation)return;current=project;
    const tab=q().get('tab')||'overview';document.title=`${project.title} / No Vibe No Code`;
    const entries=[['overview','Overview']];if(project.canEdit)entries.push(['editor','Editor']);if(project.canManage)entries.push(['settings','Settings']);
    root.innerHTML=`<p class="ws-breadcrumb"><a href="${user?'/projects':'/gallery'}">${user?'Projects':'Gallery'}</a> / ${e(project.owner_name)}</p>`+heading(project.title,project.summary,`<div class="ws-actions">${status(project.status)}${project.canSubmit?button('project-submit','Submit for review','','primary-button'):''}</div>`)+tabs(entries,tab);
    if(tab==='editor'&&project.canEdit){root.insertAdjacentHTML('beforeend',`<div class="ws-editor"><form class="ws-form" data-form="project">${projectFields(project)}${formEnd('Save changes')}</form>${upload('cover',project.coverUrl)}</div>`);return;}
    if(tab==='settings'&&project.canManage){root.insertAdjacentHTML('beforeend',`<div class="ws-editor">${project.status!=='archived'?`<form class="ws-form ws-form-section" data-form="project">${projectFields(project,true)}${formEnd('Save settings')}</form>`:''}<section class="ws-setting"><div><h3>${project.status==='archived'?'Restore project':'Archive project'}</h3><p>${project.status==='archived'?'Restoring returns this project to Draft. Submit it again when ready.':'Hide this project from collections and make it read-only.'}</p></div>${button(project.status==='archived'?'project-restore':'project-archive',project.status==='archived'?'Restore to Draft':'Archive project')}</section></div>`);return;}
    root.insertAdjacentHTML('beforeend',`<div class="ws-detail-grid"><section class="ws-panel">${project.coverUrl?`<img class="ws-detail-cover" src="${e(project.coverUrl)}" alt="${e(project.title)} cover">`:''}<h2 class="ws-panel-title">README</h2><div class="workspace-markdown">${project.contentHtml||'<p class="ws-muted">No README yet. Every great project starts somewhere.</p>'}</div></section><aside class="ws-aside"><h3>About this project</h3><p>${e(project.summary||'No description yet.')}</p><div class="ws-actions">${project.demo_url?`<a class="secondary-button" href="${e(project.demo_url)}" target="_blank" rel="noopener noreferrer">Open demo ↗</a>`:''}${project.source_url?`<a class="secondary-button" href="${e(project.source_url)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`:''}</div><dl><dt>Owner</dt><dd><a href="/user/${encodeURIComponent(project.owner_slug)}">${e(project.owner_name)}</a></dd><dt>Team</dt><dd>${e(project.team_name||'Individual project')}</dd><dt>Visibility</dt><dd>${e(project.visibility)}</dd><dt>Updated</dt><dd>${date(project.updated_at)}</dd></dl><div class="ws-meta">${project.labels.map(label=>`<span class="ws-label">${e(label)}</span>`).join('')}</div>${project.moderation_notes?`<section class="ws-callout"><div><h3>Review feedback</h3><p>${e(project.moderation_notes)}</p></div></section>`:''}${project.canEdit?`<p style="margin-top:24px"><a data-nav href="${e(queryHref({tab:'editor'}))}">Edit this project →</a></p>`:''}</aside></div>`);
  }
  function memberRow(member,team) {
    const canManage=team.status==='active'&&['owner','admin'].includes(team.viewerRole),other=member.id!==user.id&&member.role!=='owner';
    return `<div class="ws-member">${member.profileImageUrl||member.github_avatar_url?`<img src="${e(member.profileImageUrl||member.github_avatar_url)}" alt="">`:`<span class="ws-avatar-letter">${e(member.display_name.slice(0,1))}</span>`}<div class="ws-member-copy"><a href="/user/${encodeURIComponent(member.public_slug)}"><strong>${e(member.display_name)}</strong></a><span class="ws-muted">${e(member.role)}</span></div>${canManage&&other?`<div class="ws-actions">${team.viewerRole==='owner'?button('member-role',member.role==='admin'?'Make member':'Make admin',`data-id="${e(member.id)}" data-value="${member.role==='admin'?'member':'admin'}"`):''}${team.viewerRole==='owner'||member.role==='member'?button('member-remove','Remove',`data-id="${e(member.id)}"`,'text-button danger'):''}</div>`:''}</div>`;
  }
  async function renderTeam(version) {
    const data=await request(`/api/teams/${encodeURIComponent(key)}`);if(version!==generation)return;
    current={...data.team,members:data.members,invitations:data.invitations,viewerRole:data.viewerRole};const team=current,tab=q().get('tab')||'overview';
    const manager=['owner','admin'].includes(team.viewerRole),active=team.status==='active';document.title=`${team.name} / No Vibe No Code`;
    root.innerHTML=`<p class="ws-breadcrumb"><a href="/teams">Teams</a> / ${e(team.name)}</p>`+heading(team.name,team.description,`<div class="ws-actions">${teamAvatar(team,true)}${status(team.status)}</div>`)+tabs([['overview','Overview'],['projects','Projects'],['members','Members',data.members.length],['settings','Settings']],tab);
    if(tab==='projects'){const projects=await request(`/api/projects?team=${encodeURIComponent(team.id)}&limit=20`);if(version!==generation)return;items=projects.projects;cursor=projects.nextCursor;total=projects.total;root.insertAdjacentHTML('beforeend',`<div class="ws-result-bar"><span>${total} accessible projects</span><span>Each project is managed by its individual owner.</span></div><section class="ws-collection" id="teamProjects">${items.length?items.map(p=>projectCard(p,false)).join(''):empty('No projects to show','Only projects you can access appear here. Project owners can associate their projects in Settings.')}</section>${loadMore()}`);return;}
    if(tab==='members'){
      root.insertAdjacentHTML('beforeend',`<section class="ws-panel">${data.members.map(m=>memberRow(m,team)).join('')}</section>${manager&&active?`<section class="ws-form-section" style="margin-top:24px"><h3>Invite a member</h3><form class="ws-form" data-form="invite"><label class="ws-field"><span>Find a member</span><input type="search" data-invite-search placeholder="Search by display name (2+ characters)" autocomplete="off"></label><div id="inviteCandidates" class="ws-invite-results" aria-live="polite"></div><input type="hidden" name="userId" required>${field('message','Invitation message (optional)','','maxlength="300"')}<p class="ws-help">Invitations expire after 7 days. Returning members can be invited again.</p>${formEnd('Send invitation')}</form></section>${data.invitations.length?`<section class="ws-panel" style="margin-top:24px"><h2 class="ws-panel-title">Pending invitations</h2>${data.invitations.map(i=>`<div class="ws-member"><div class="ws-member-copy"><strong>${e(i.display_name)}</strong><span class="ws-muted">Expires ${date(i.expires_at)}</span></div>${button('revoke','Cancel invitation',`data-id="${e(i.id)}"`)}</div>`).join('')}</section>`:''}`:''}`);return;
    }
    if(tab==='settings'){
      root.insertAdjacentHTML('beforeend',`<div class="ws-editor">${manager&&active?`${upload('avatar',team.avatarUrl)}<form class="ws-form" data-form="team" style="margin-top:24px">${teamFields(team)}${formEnd('Save team')}</form>`:`<div class="ws-callout"><p>${!active?'This team is archived. Restore it before editing.':'Only owners and administrators can edit team details.'}</p></div>`}${team.viewerRole==='owner'?`${active?`<section class="ws-setting"><div><h3>Transfer ownership</h3><p>The new owner controls administrators and archive state. You become an administrator.</p></div><form class="ws-form" data-form="transfer">${formSelect('userId','New owner',[['','Choose a member'],...data.members.filter(m=>m.id!==user.id).map(m=>[m.id,m.display_name])],'')}${formEnd('Transfer ownership')}</form></section>`:''}<section class="ws-setting"><div><h3>${active?'Archive team':'Restore team'}</h3><p>${active?'Pause team changes and invitations. Existing project access is unchanged.':'Make this team active again.'}</p></div>${button(active?'team-archive':'team-restore',active?'Archive team':'Restore team')}</section><p class="ws-help">To leave this team, transfer ownership first.</p>`:team.viewerRole!=='staff'?`<section class="ws-setting"><div><h3>Leave team</h3><p>You’ll lose access to this team. Projects you own stay yours.</p></div>${button('team-leave','Leave team','','secondary-button danger')}</section>`:''}</div>`);return;
    }
    root.insertAdjacentHTML('beforeend',`<div class="ws-detail-grid"><section class="ws-panel"><h2 class="ws-panel-title">Team introduction</h2><div class="workspace-markdown">${team.introductionHtml||'<p class="ws-muted">A team with a story still to write.</p>'}</div></section><aside class="ws-aside"><h3>About the team</h3><p>${e(team.description||'No description yet.')}</p>${team.website_url?`<a class="secondary-button" href="${e(team.website_url)}" target="_blank" rel="noopener noreferrer">Website ↗</a>`:''}<dl><dt>Members</dt><dd><a data-nav href="${e(queryHref({tab:'members'}))}">${data.members.length} builders</a></dd><dt>Your role</dt><dd>${e(team.viewerRole)}</dd><dt>Updated</dt><dd>${date(team.updated_at)}</dd></dl><div class="ws-actions">${data.members.slice(0,8).map(m=>`<a href="/user/${encodeURIComponent(m.public_slug)}" title="${e(m.display_name)}"><span class="ws-avatar-letter">${e(m.display_name.slice(0,1))}</span></a>`).join('')}</div></aside></div>`);
  }
  const category=type=>({'team-invitation':'Team invitation','project-status':'Project update',broadcast:'Club announcement'}[type]||type);
  function noticeRow(item) {return `<article class="ws-notice ${item.read_at?'':'is-unread'} ${q().get('notification')===item.id?'is-selected':''}"><input type="checkbox" data-select-notice="${e(item.id)}" aria-label="Select ${e(item.title)}" ${selected.has(item.id)?'checked':''}><button class="ws-notice-open" data-action="open-notice" data-id="${e(item.id)}"><strong>${e(item.title)}</strong><p>${e(item.body)}</p><span class="ws-meta">${e(category(item.type))} · ${date(item.created_at)}</span></button>${button('notice-action',item.saved_at?'★':'☆',`data-id="${e(item.id)}" data-value="${item.saved_at?'unsave':'save'}" aria-label="${item.saved_at?'Unsave':'Save'} notification"`,'ws-pin')}</article>`;}
  function noticeDetail(item) {
    if(!item)return '<p class="ws-muted">Select a notification to read the details.</p>';
    const invite=item.invitation,canRespond=invite&&invite.status==='pending'&&invite.team_status==='active';
    return `${button('close-notice','← Back to inbox','','text-button ws-back')}<span class="ws-meta">${e(category(item.type))} · ${date(item.created_at)}</span><h2>${e(item.title)}</h2><div class="ws-notice-body">${e(item.body)}</div>${invite?`<div class="ws-callout"><div><h3>${e(invite.team_name)}</h3><p>${invite.team_status!=='active'?'This team is archived.':canRespond?`Invitation expires ${date(invite.expires_at)}.`:`Invitation ${e(invite.status)}.`}</p>${canRespond?`<div class="ws-actions">${button('invitation','Accept',`data-id="${e(invite.id)}" data-value="accepted"`,'primary-button')}${button('invitation','Decline',`data-id="${e(invite.id)}" data-value="declined"`)}</div>`:''}</div></div>`:item.action_url?`<a class="secondary-button" href="${e(item.action_url)}">Open details →</a>`:''}<div class="ws-actions">${[['read',item.read_at?'unread':'read',item.read_at?'Mark unread':'Mark read'],['save',item.saved_at?'unsave':'save',item.saved_at?'Unsave':'Save'],['done',item.archived_at?'restore':'done',item.archived_at?'Restore':'Done']].map(([,action,label])=>button('notice-action',label,`data-id="${e(item.id)}" data-value="${action}"`)).join('')}</div>`;
  }
  async function renderNotifications(version) {
    const params=q(),filter=params.get('filter')||'inbox';params.set('limit','20');params.delete('notification');
    const [data,detail]=await Promise.all([request(`/api/notifications?${params}`),q().get('notification')?request(`/api/notifications/${encodeURIComponent(q().get('notification'))}`):null]);if(version!==generation)return;
    items=data.notifications;cursor=data.nextCursor;total=data.total;current=detail?.notification;
    document.title='Notifications / No Vibe No Code';
    const bulkActions=['read','unread','save','unsave','done','restore'].map(action=>button('bulk',({read:'Read',unread:'Unread',save:'Save',unsave:'Unsave',done:'Done',restore:'Restore'})[action],`data-value="${action}" ${selected.size?'':'disabled'}`)).join('');
    root.classList.toggle('ws-notice-detail-open',Boolean(current));
    root.innerHTML=heading('Notifications','Your invitations, project updates, and club news.',button('read-all','Mark all read'))+
      tabs(['inbox','unread','saved','done'].map(name=>[name,name[0].toUpperCase()+name.slice(1),data.counts[name]]),filter,'filter')+
      `<div class="ws-toolbar ws-collection-toolbar">${search('Search notifications',q().get('q'))}<details class="ws-filter-details" ${filterOpen||matchMedia('(min-width: 821px)').matches?'open':''}><summary>Filters${q().get('type')?' · 1 active':''}</summary><div class="ws-filter-grid">${select('type','Notification category',[['','All categories'],['team-invitation','Team invitations'],['project-status','Project updates'],['broadcast','Club announcements']],q().get('type')||'')}<div class="ws-filter-actions"><a class="secondary-button" data-nav href="${e(queryHref({type:null}))}">Clear filter</a><button type="button" class="secondary-button" data-close-filters>Done</button></div></div></details></div>`+
      `<div class="ws-inbox-layout ${current?'has-selection':''}"><div class="ws-inbox-main"><div class="ws-result-bar">${total} notifications</div><div class="ws-bulk ${selected.size?'has-selection':''}"><label><input type="checkbox" aria-label="Select all notifications on this page" data-select-all ${items.length&&items.every(i=>selected.has(i.id))?'checked':''}> <span id="selectionCount">${selected.size?selected.size+' selected':'Select page'}</span></label><details class="ws-bulk-menu" ${selected.size?'':'hidden'}><summary>Actions for selected</summary><div>${bulkActions}</div></details></div><section class="ws-notice-list" id="noticeItems">${items.length?items.map(noticeRow).join(''):empty('All caught up','Nothing in this view. Check another filter or come back later.')}</section>${loadMore()}</div><aside class="ws-notice-detail" aria-label="Notification details">${noticeDetail(current)}</aside></div>`;
  }
  async function render() {
    const version=++generation,focused=document.activeElement?.id,selectionStart=document.activeElement?.selectionStart;
    root.setAttribute('aria-busy','true');
    try {
      if(key==='new')renderNew();else if(isProject&&key)await renderProject(version);else if(isTeam&&key)await renderTeam(version);else if(section==='notifications')await renderNotifications(version);else await renderCollection(version);
      if(version!==generation)return;
      const el=focused&&document.getElementById(focused);if(el){el.focus({preventScroll:true});if(typeof selectionStart==='number')el.setSelectionRange?.(selectionStart,selectionStart);}
      if(pendingNoticeFocus&&matchMedia('(max-width: 820px)').matches){const target=pendingNoticeFocus==='detail'?root.querySelector('.ws-notice-detail .ws-back'):root.querySelector(`[data-action="open-notice"][data-id="${CSS.escape(lastOpened||'')}"]`);target?.focus({preventScroll:false});pendingNoticeFocus=null;}
    } catch(error) {if(version===generation)root.innerHTML=`<div class="ws-error"><h2>Couldn’t open this page</h2><p>${e(error.message)}</p>${button('retry','Try again')} <a href="/${isProject?'projects':isTeam?'teams':'home'}">Back to workspace</a></div>`;}
    finally {if(version===generation)root.removeAttribute('aria-busy');}
  }
  async function mutate(url,method,data,message='Changes saved.') {await request(url,json(method,data));dirty=false;toast(message);await render();refreshUnread();}
  async function more(buttonEl) {
    const version=generation;
    const url=isTeam&&key?`/api/projects?team=${encodeURIComponent(current.id)}&limit=20`:(section==='notifications'?`/api/notifications?${q()}`:collectionApi());
    const params=new URL(url,location.origin);params.searchParams.set('cursor',cursor);const data=await request(params.pathname+params.search),newItems=data[isTeam&&key?'projects':section];if(version!==generation)return;
    items.push(...newItems);cursor=data.nextCursor;total=data.total;
    const container=document.getElementById(isTeam&&key?'teamProjects':section==='notifications'?'noticeItems':'collectionItems');container.insertAdjacentHTML('beforeend',newItems.map(section==='notifications'?noticeRow:isTeam&&key?p=>projectCard(p,false):isProject?p=>projectCard(p):teamCard).join(''));
    if(!cursor)buttonEl.closest('.ws-pagination').remove();const count=root.querySelector('.ws-result-bar');if(count)count.firstChild.textContent=`${total} ${isTeam&&key?'projects':section} · ${items.length} shown`;
  }
  root.addEventListener('click',async event=>{
    if(event.target.closest('[data-close-filters]')){const details=event.target.closest('.ws-filter-details');if(details)details.open=false;filterOpen=false;return;}
    const nav=event.target.closest('a[data-nav]');if(nav&&!(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)){event.preventDefault();if(dirty&&!window.confirm('Discard your unsaved changes?'))return;dirty=false;const next=new URL(nav.href);if(!key&&isTeam)next.searchParams.set('status',next.searchParams.get('tab')==='archived'?'archived':'active');history.pushState({},'',next.pathname+next.search);rememberView();selected.clear();render();return;}
    const el=event.target.closest('button[data-action]');if(!el)return;const action=el.dataset.action,id=el.dataset.id,value=el.dataset.value;el.disabled=true;
    try {
      if(action==='retry')await (initialized?render():start());
      if(action==='view'){navigate({view:value});rememberView();}
      if(action==='clear'){navigate({q:'',label:'',team:'',visibility:'',status:'active',sort:'updated',tab:isTeam?'active':null});rememberView();}
      if(action==='more')await more(el);
      if(action==='pin'){const name=isProject?'pinnedProjects':'pinnedTeams',pins=preferences[name]||[];const patch={[name]:pins.includes(id)?pins.filter(p=>p!==id):[...pins,id]};await request('/api/workspace/preferences',json('PUT',patch));preferences={...preferences,...patch};await render();toast(pins.includes(id)?'Unpinned.':'Pinned to your Home overview.');}
      if(action==='preview'){const field=root.querySelector('#markdownInput'),{html}=await request('/api/workspace/preview',json('POST',{markdown:field.value}));const preview=root.querySelector('#markdownPreview');preview.innerHTML=html||'<p class="ws-muted">Nothing to preview yet.</p>';preview.hidden=false;}
      if(action==='remove-image')confirmAction('Remove image?','Your current image will be removed.',()=>mutate(`${endpoint()}/${value}`,'DELETE',{},'Image removed.'),'Remove');
      if(action.startsWith('project-')||action.startsWith('team-')){
        const kind=action.split('-')[1];if(dirty)throw new Error('Save your changes before continuing.');
        const descriptions={submit:'Submit the saved version for club staff review?',archive:'This makes the project or team read-only until restored.',restore:isProject?'This project will return to Draft.':'This team will become active again.',leave:'You’ll lose team access. Your own projects are not removed.'};
        confirmAction(`${kind[0].toUpperCase()+kind.slice(1)} ${isProject?'project':'team'}?`,descriptions[kind],async()=>{await request(`${endpoint()}/${kind}`,json('POST',{}));if(kind==='leave')location.href='/teams';else{toast('Changes saved.');await render();refreshUnread();}},kind==='submit'?'Submit for review':'Confirm');
      }
      if(action==='candidate'){root.querySelector('[name=userId]').value=id;root.querySelectorAll('[data-action=candidate]').forEach(b=>b.setAttribute('aria-pressed',String(b===el)));}
      if(action==='revoke')confirmAction('Cancel invitation?','The recipient will no longer be able to accept it.',()=>mutate(`${endpoint()}/invitations/${encodeURIComponent(id)}`,'DELETE',{},'Invitation cancelled.'));
      if(action==='member-role')confirmAction('Change member role?',`This member will become ${value==='admin'?'an administrator':'an ordinary member'}.`,()=>mutate(`${endpoint()}/members/${encodeURIComponent(id)}`,'PUT',{role:value}));
      if(action==='member-remove')confirmAction('Remove member?','This person will lose team access. Their own projects remain theirs.',()=>mutate(`${endpoint()}/members/${encodeURIComponent(id)}`,'PUT',{status:'removed'},'Member removed.'));
      if(action==='invitation'){await mutate(`/api/team-invitations/${encodeURIComponent(id)}/respond`,'POST',{status:value},value==='accepted'?'You joined the team.':'Invitation declined.');}
      if(action==='open-notice'){await request(`/api/notifications/${encodeURIComponent(id)}/read`,json('POST',{}));lastOpened=id;pendingNoticeFocus='detail';navigate({notification:id});refreshUnread();}
      if(action==='close-notice'){pendingNoticeFocus='list';navigate({notification:null});}
      if(action==='notice-action')await mutate(`/api/notifications/${encodeURIComponent(id)}/action`,'POST',{action:value},'Notification updated.');
      if(action==='bulk'){if(!selected.size)throw new Error('Select a notification first.');await request('/api/notifications/bulk',json('POST',{ids:[...selected],action:value}));selected.clear();await render();refreshUnread();toast('Notifications updated.');}
      if(action==='read-all')await mutate('/api/notifications/read-all','POST',{},'All notifications marked read.');
    }catch(error){toast(error.message,true);}finally{el.disabled=false;}
  });
  root.addEventListener('submit',async event=>{
    const form=event.target.closest('[data-form]');if(!form)return;event.preventDefault();const data=Object.fromEntries(new FormData(form)),kind=form.dataset.form,submit=form.querySelector('[type=submit]'),message=form.querySelector('.ws-form-status');
    message.textContent='';if(data.labels!==undefined)data.labels=data.labels.split(',').map(s=>s.trim()).filter(Boolean);
    if(kind==='transfer'){if(!data.userId){message.textContent='Choose the next owner.';return;}confirmAction('Transfer ownership?','You will become an administrator and only the new owner can transfer ownership again.',()=>mutate(`${endpoint()}/transfer`,'POST',data,'Ownership transferred.'));return;}
    submit.disabled=true;
    try{
      if(kind==='invite'&&!data.userId)throw new Error('Search for a member and select them first.');
      const result=await request(kind==='create'?`/api/${section}`:kind==='invite'?`${endpoint()}/invitations`:endpoint(),json(kind==='create'||kind==='invite'?'POST':'PUT',data));dirty=false;
      if(kind==='create'){const item=result[isProject?'project':'team'];location.href=`/${section}/${encodeURIComponent(item.slug)}?tab=${isProject?'editor':'settings'}`;return;}
      if(kind==='invite'){toast('Invitation sent.');await render();}
      else{form.querySelector('[data-save-note]').textContent=`Saved at ${new Date().toLocaleTimeString()}`;if(data.title||data.name){root.querySelector('.page-heading h1').textContent=data.title||data.name;document.title=`${data.title||data.name} / No Vibe No Code`;}if(data.summary!==undefined||data.description!==undefined)root.querySelector('.page-heading p').textContent=data.summary??data.description;toast('Changes saved.');}
    }catch(error){message.textContent=error.message;message.scrollIntoView({block:'nearest'});}finally{submit.disabled=false;}
  });
  root.addEventListener('input',event=>{
    if(event.target.closest('[data-form]')&&!event.target.matches('[data-invite-search]'))dirty=true;
    if(event.target.matches('[data-search],[data-label-filter]')){clearTimeout(searchTimer);const name=event.target.matches('[data-search]')?'q':'label',value=event.target.value;searchTimer=setTimeout(()=>{navigate({[name]:value});rememberView();},350);}
    if(event.target.matches('[data-invite-search]')){clearTimeout(inviteTimer);const input=event.target,value=input.value;root.querySelector('[name=userId]').value='';inviteTimer=setTimeout(async()=>{try{const result=await request(`${endpoint()}/candidates?q=${encodeURIComponent(value)}`);if(!input.isConnected||input.value!==value)return;document.getElementById('inviteCandidates').innerHTML=result.members.length?result.members.map(m=>button('candidate',e(m.display_name),`data-id="${e(m.id)}" aria-pressed="false"`,'')).join(''):`<p class="ws-help">${value.length<2?'Enter at least two characters.':'No available members found. Check the name or pending invitations.'}</p>`;}catch(error){toast(error.message,true);}},300);}
  });
  root.addEventListener('change',async event=>{
    const el=event.target;
    if(el.matches('[data-filter]')){navigate({[el.dataset.filter]:el.value});rememberView();}
    if(el.matches('[data-select-notice],[data-select-all]')){
      if(el.matches('[data-select-all]'))items.forEach(i=>el.checked?selected.add(i.id):selected.delete(i.id));else el.checked?selected.add(el.dataset.selectNotice):selected.delete(el.dataset.selectNotice);
      root.querySelectorAll('[data-select-notice]').forEach(input=>input.checked=selected.has(input.dataset.selectNotice));root.querySelectorAll('[data-action=bulk]').forEach(b=>b.disabled=!selected.size);root.querySelector('#selectionCount').textContent=selected.size?`${selected.size} selected`:'Select page';const all=root.querySelector('[data-select-all]');all.checked=items.length>0&&items.every(i=>selected.has(i.id));all.indeterminate=selected.size>0&&!all.checked;
      const bulkMenu=root.querySelector('.ws-bulk-menu');if(bulkMenu){bulkMenu.hidden=!selected.size;if(!selected.size)bulkMenu.open=false;}root.querySelector('.ws-bulk')?.classList.toggle('has-selection',Boolean(selected.size));
    }
    if(el.matches('[data-upload]')&&el.files[0]){
      const file=el.files[0];el.disabled=true;
      try{if(dirty)throw new Error('Save your text changes before uploading an image.');if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2000000)throw new Error('Choose a PNG, JPG or WebP image under 2 MB.');const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read this image.'));reader.readAsDataURL(file);});await mutate(`${endpoint()}/${el.dataset.upload}`,'POST',{dataUrl},'Image updated.');}catch(error){toast(error.message,true);el.value='';}finally{el.disabled=false;}
    }
  });
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  root.addEventListener('toggle',event=>{if(event.target.matches('.ws-filter-details')&&matchMedia('(max-width: 820px)').matches)filterOpen=event.target.open;},true);
  window.matchMedia('(min-width: 821px)').addEventListener('change',event=>{const details=root.querySelector('.ws-filter-details');if(details)details.open=event.matches||filterOpen;});
  window.addEventListener('popstate',()=>{dirty=false;selected.clear();render();});
  window.addEventListener('workspace:unread',event=>{if(section==='notifications')root.querySelectorAll('.ws-tabs a').forEach(link=>{if(new URL(link.href).searchParams.get('filter')==='unread'){const count=link.querySelector('.ws-count');if(count)count.textContent=event.detail;}});});
  async function start(){
    user=isProject&&key&&key!=='new'?await ready:await requireUser();
    if(user){const data=await request('/api/workspace/preferences');preferences=data.preferences;if(isProject)ownTeams=await allTeams();}
    if(!key){const params=q(),saved=preferences[section]||{};if(!params.size)for(const [name,value]of Object.entries(saved))params.set(name,value);
      if(isProject&&!params.has('status'))params.set('status','active');if(isTeam){if(!params.has('tab'))params.set('tab',params.get('status')==='archived'?'archived':'active');params.set('status',params.get('tab')==='archived'?'archived':'active');}
      if(isProject||isTeam){if(!params.has('view'))params.set('view',isProject?'list':'grid');if(!params.has('sort'))params.set('sort','updated');}
      history.replaceState({},'',location.pathname+'?'+params);
    }
    if(section==='notifications'&&q().get('notification')){lastOpened=q().get('notification');await request(`/api/notifications/${encodeURIComponent(lastOpened)}/read`,json('POST',{}));refreshUnread();}
    initialized=true;await render();
  }
  start().catch(error=>{root.innerHTML=`<div class="ws-error"><p>${e(error.message)}</p>${button('retry','Try again')}</div>`;});
})();

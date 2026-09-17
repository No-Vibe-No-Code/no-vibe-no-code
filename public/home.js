import './product-motion.js';

(() => {
  const {requestJson:request,escapeHtml:e}=window.NVNC;
  const {requireUser,icon}=window.NVNCWorkspace;
  const query=new URLSearchParams(location.search);
  if(query.get('team')) { location.replace('/teams/'+encodeURIComponent(query.get('team')));return; }
  if(['#projects','#teams','#notifications'].includes(location.hash)) {location.replace('/'+location.hash.slice(1));return;}
  const empty=(title,body,href,label)=>`<div class="ws-empty"><img src="/mascots/nachoneko-chibi-laptop.png" alt=""><h3>${title}</h3><p>${body}</p><a class="secondary-button" href="${href}">${label}</a></div>`;
  async function load() {
    const user=await requireUser(),data=await request('/api/workspace/summary');
    document.getElementById('homePage').innerHTML=`<header class="page-heading"><div><h1>Welcome back, ${e(user.display_name)}.</h1><p>A little progress, every day. Here’s what’s happening in your workspace.</p></div><a class="primary-button" href="/projects/new">${icon('plus')}New project</a></header>
    <section class="ws-summary" aria-label="Workspace summary">${[['projects','Projects',data.counts.projects],['teams','Teams',data.counts.teams],['notifications?filter=unread','Unread',data.counts.unread],['teams?tab=invitations','Invitations',data.counts.invitations]].map(([href,label,count])=>`<a href="/${href}"><strong ${label==='Unread'?'id="homeUnread"':''}>${count}</strong><span>${label}</span></a>`).join('')}</section>
    <div class="ws-home-grid"><section class="ws-home-panel"><header><h2>Your projects</h2><a href="/projects">View all →</a></header>${data.projects.length?`<div class="ws-panel">${data.projects.map(p=>`<a class="ws-home-row" href="/projects/${encodeURIComponent(p.slug)}">${icon((data.preferences.pinnedProjects||[]).includes(p.id)?'pin':'projects')}<div><strong>${e(p.title)}</strong><p>${e(p.summary||'Make your next idea real.')}</p></div><span class="ws-status ${e(p.status)}">${e(p.status)}</span></a>`).join('')}</div>`:empty('Your next idea starts here','Create a draft, build at your pace, then share it with the club.','/projects/new','Create a project')}</section>
    <section class="ws-home-panel"><header><h2>Your teams</h2><a href="/teams">View all →</a></header>${data.teams.length?`<div class="ws-panel">${data.teams.map(t=>`<a class="ws-home-row" href="/teams/${encodeURIComponent(t.slug)}">${icon((data.preferences.pinnedTeams||[]).includes(t.id)?'pin':'teams')}<div><strong>${e(t.name)}</strong><p>${e(t.role)} · ${t.memberCount} members</p></div>${icon('arrow')}</a>`).join('')}</div>`:empty('Better, together','Find your collaborators or bring a new team together.','/teams/new','Create a team')}</section></div>
    ${data.counts.invitations?`<section class="ws-callout"><div><h3>${data.counts.invitations} pending invitation${data.counts.invitations===1?'':'s'}</h3><p>Someone wants to build with you. Take a look.</p></div><a class="primary-button" href="/teams?tab=invitations">Review invitations</a></section>`:''}
    <section class="ws-callout"><div><h3>Find your people.</h3><p>Explore what the club is making and meet the people behind it.</p></div><div class="ws-actions"><a class="secondary-button" href="/gallery">Explore the gallery</a><a class="secondary-button" href="/members">Meet the builders</a></div></section>`;
  }
  window.addEventListener('workspace:unread',event=>{const el=document.getElementById('homeUnread');if(el)el.textContent=event.detail;});
  load().catch(error=>{document.getElementById('homePage').innerHTML=`<div class="ws-error"><h2>Couldn’t open your workspace</h2><p>${e(error.message)}</p><a class="secondary-button" href="/home">Try again</a></div>`;});
})();

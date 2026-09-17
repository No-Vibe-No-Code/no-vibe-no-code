(() => {
  const {requestJson: request, jsonOptions: json, escapeHtml: e} = window.NVNC;
  const paths = {home:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',projects:'M3 4h7l2 3h9v14H3Z',teams:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',notifications:'M4 4h16v16H4ZM4 14h5l1 3h4l1-3h5',gallery:'M3 3h18v18H3ZM3 17l6-6 4 4 3-3 5 5M7 7h1',members:'M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',pin:'m9 3 12 0M9 3v5l-3 5v2h12v-2l-3-5V3M12 15v7',plus:'M12 4v16M4 12h16',search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',arrow:'M5 12h14m-5-5 5 5-5 5',check:'m5 12 4 4L19 6'};
  const icon = name => `<svg class="ws-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.projects}"/></svg>`;
  document.body.classList.add('ws-page');
  document.querySelectorAll('.product-sidebar,.mobile-nav,.site-mascot-badge').forEach(el => el.remove());
  const main = document.querySelector('.product-main');
  const header = document.createElement('header'); header.className = 'ws-header';
  header.innerHTML = `<a class="ws-skip" href="#workspace-content">Skip to content</a><div class="ws-header-inner"><a class="ws-brand" href="/home"><img src="/logo-symbol.webp?v=20260913-sky" alt="">No Vibe No Code</a><div class="ws-account" id="wsAccount"></div></div><nav class="ws-nav" id="wsNavigation" aria-label="Main navigation"></nav>`;
  const old = main.querySelector('.product-topbar,[data-workspace-header]'); if (old) old.replaceWith(header); else main.prepend(header);
  const content = main.querySelector('.product-content'); if (content) { if(!content.id)content.id = 'workspace-content';content.tabIndex=-1; }
  header.querySelector('.ws-skip').href = `#${content?.id || 'workspace-content'}`;
  const footer = document.createElement('footer'); footer.className = 'ws-footer';
  footer.innerHTML = `<nav aria-label="Footer navigation"><a href="/?public=1#club">About</a><a href="/gallery">Gallery</a><a href="/?public=1">Public site</a><a href="/members">Members</a><a href="/?public=1#contact">Contact</a></nav><p>© ${new Date().getFullYear()} No Vibe No Code · Built by students, for builders.</p>`; main.append(footer);
  const message = document.createElement('div'); message.className = 'ws-toast'; message.hidden = true; message.setAttribute('role','status'); document.body.append(message);
  let timer, user;
  const toast = (text, error = false) => { clearTimeout(timer); message.textContent = text; message.classList.toggle('is-error',error); message.hidden=false; timer=setTimeout(()=>message.hidden=true,error?8000:4000); };
  const signIn = () => `/?account=login&returnTo=${encodeURIComponent(location.pathname+location.search+location.hash)}`;
  async function refreshUnread() { if (!user || document.hidden) return; try { const {count}=await request('/api/notifications/unread-count'); document.querySelectorAll('[data-notification-count]').forEach(el=>{el.textContent=count;el.hidden=!count;}); window.dispatchEvent(new CustomEvent('workspace:unread',{detail:count})); } catch {} }
  const ready = request('/api/me').then(result => {
    user = result.user;
    const section = location.pathname.split('/')[1].replace('.html','');
    document.getElementById('wsNavigation').innerHTML = (user?['home','projects','teams','notifications','gallery','members']:['gallery','members']).map(name=>`<a href="/${name}" ${name===section||(name==='members'&&['profile','user'].includes(section))?'aria-current="page"':''}>${icon(name)}${name[0].toUpperCase()+name.slice(1)}${name==='notifications'?'<span class="ws-count" data-notification-count hidden></span>':''}</a>`).join('');
    document.getElementById('wsAccount').innerHTML = user ? `<a class="ws-bell" href="/notifications" aria-label="Notifications">${icon('bell')}<span class="ws-count" data-notification-count hidden></span></a><details class="ws-account-menu"><summary aria-label="Account menu">${user.profileImageUrl||user.github_avatar_url?`<img src="${e(user.profileImageUrl||user.github_avatar_url)}" alt="">`:`<span class="ws-avatar-letter">${e(user.display_name?.slice(0,1))}</span>`}<span>${e(user.display_name)}</span><span aria-hidden="true">⌄</span></summary><div class="ws-account-dropdown"><strong>Signed in as ${e(user.display_name)}</strong><a href="/user/${encodeURIComponent(user.public_slug)}">Your profile</a><a href="/profile?edit=1">Edit profile & NFC</a>${['maintainer','club-leader','teacher'].includes(user.role)?'<a href="/admin">Staff dashboard</a>':''}<button type="button" id="wsSignOut">Sign out</button></div></details>` : `<a class="primary-button" href="${signIn()}">Sign in</a>`;
    document.getElementById('wsSignOut')?.addEventListener('click',async()=>{try{await request('/api/auth/logout',json('POST',{}));location.href='/?public=1';}catch(error){toast(error.message,true);}});
    refreshUnread(); return user;
  });
  ready.catch(error=>toast(error.message,true));
  const requireUser = async () => { const member = await ready; if (!member) {location.replace(signIn());throw new Error('Sign in to open your workspace.');}return member;};
  function confirmAction(title, description, action, label='Confirm') {
    const dialog=document.createElement('dialog');dialog.className='ws-confirm';dialog.innerHTML=`<form method="dialog"><h2>${e(title)}</h2><p>${e(description)}</p><div class="ws-actions"><button value="cancel" class="secondary-button" autofocus>Cancel</button><button value="confirm" class="primary-button">${e(label)}</button></div></form>`;
    dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='confirm';dialog.remove();if(accepted)Promise.resolve().then(action).catch(error=>toast(error.message,true));},{once:true});document.body.append(dialog);dialog.showModal();
  }
  window.addEventListener('focus',refreshUnread);document.addEventListener('visibilitychange',refreshUnread);setInterval(refreshUnread,60000);
  document.addEventListener('click',event=>{const menu=document.querySelector('.ws-account-menu');if(menu&&!menu.contains(event.target))menu.open=false;});
  window.NVNCWorkspace={ready,requireUser,refreshUnread,icon,toast,confirmAction};
})();

(() => {
  const workspace = Boolean(document.querySelector('.ws-header'));
  const header = document.querySelector(workspace ? '.ws-header-inner' : '.site-header, .product-topbar');
  if (!header) return;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'mobile-menu-trigger';
  trigger.setAttribute('aria-label', 'Open menu');
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.innerHTML = '<span aria-hidden="true">☰</span><span>Menu</span>';
  header.append(trigger);

  const drawer = document.createElement('dialog');
  drawer.className = 'mobile-menu-drawer';
  drawer.setAttribute('aria-label', 'Site menu');
  drawer.innerHTML = '<div class="mobile-menu-panel"><div class="mobile-menu-head"><strong>No Vibe No Code</strong><button type="button" class="mobile-menu-close" aria-label="Close menu">×</button></div><nav aria-label="Mobile navigation"></nav></div>';
  document.body.append(drawer);
  const nav = drawer.querySelector('nav');
  const publicLinks = '<a href="/?public=1">Public site</a><a href="/?public=1#club">About the club</a><a href="/?public=1#join">Join</a><a href="/gallery">Gallery</a><a href="/members">Members</a><a href="/?public=1#contact">Contact</a><a href="/?account=login">Sign in</a>';

  async function fill() {
    if (workspace) {
      await window.NVNCWorkspace.ready.catch(() => null);
      const links = [...document.querySelectorAll('.ws-nav a')].map(link => link.outerHTML).join('');
      const account = [...document.querySelectorAll('.ws-account-dropdown a')].map(link => link.outerHTML).join('');
      nav.innerHTML = links + '<div class="mobile-menu-divider"></div>' + account + '<a href="/?public=1">Public site</a>' + (document.getElementById('wsSignOut') ? '<button type="button" data-mobile-signout>Sign out</button>' : '<a href="/?account=login">Sign in</a>');
    } else {
      nav.innerHTML = publicLinks;
      const path = location.pathname;
      const active = path.startsWith('/gallery') ? '/gallery' : path.startsWith('/members') || path.startsWith('/user') ? '/members' : null;
      if (active) nav.querySelector(`a[href="${active}"]`)?.setAttribute('aria-current', 'page');
    }
  }
  trigger.addEventListener('click', async () => {
    await fill();
    drawer.showModal();
    document.body.classList.add('mobile-menu-open');
    drawer.querySelector('.mobile-menu-close').focus();
  });
  drawer.addEventListener('close', () => {
    document.body.classList.remove('mobile-menu-open');
    trigger.focus({ preventScroll: true });
  });
  drawer.querySelector('.mobile-menu-close').addEventListener('click', () => drawer.close());
  drawer.addEventListener('click', event => {
    if (event.target === drawer) drawer.close();
    if (event.target.closest('a')) drawer.close();
    if (event.target.matches('[data-mobile-signout]')) {
      drawer.close();
      document.getElementById('wsSignOut')?.click();
    }
  });
  window.matchMedia('(min-width: 821px)').addEventListener('change', event => {
    if (event.matches && drawer.open) drawer.close();
  });
})();

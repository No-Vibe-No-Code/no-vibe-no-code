(() => {
  const {requestJson:request,escapeHtml:e}=window.NVNC;
  let items=[],cursor,version=0,timer;
  const input=document.getElementById('projectSearch'),more=document.getElementById('loadMore'),container=document.getElementById('gallery');
  const filters=document.createElement('details');
  filters.className='public-filter-details';
  filters.innerHTML='<summary>Filters</summary><div class="public-filter-fields"></div>';
  const status=document.getElementById('projectStatus');
  status.replaceWith(filters);
  filters.querySelector('.public-filter-fields').append(status);
  const filterClose=document.createElement('button');
  filterClose.type='button';filterClose.className='secondary-button';filterClose.textContent='Apply';
  filterClose.onclick=()=>{filters.open=false;};
  filters.querySelector('.public-filter-fields').append(filterClose);
  filters.open=matchMedia('(min-width: 821px)').matches;
  matchMedia('(min-width: 821px)').addEventListener('change',event=>{filters.open=event.matches;});
  const count=document.createElement('p');count.className='collection-result-count';count.setAttribute('role','status');
  container.before(count);
  input.value=new URLSearchParams(location.search).get('q')||'';
  async function load(append=false){
    const current=++version;more.disabled=true;
    try{
      const params=new URLSearchParams({status:'published',visibility:'public',limit:'24',q:input.value});
      if(append&&cursor)params.set('cursor',cursor);
      const data=await request('/api/projects?'+params);if(current!==version)return;
      items=append?[...items,...data.projects]:data.projects;cursor=data.nextCursor;
      count.textContent=`${data.total??items.length} published projects${cursor?` · ${items.length} shown`:''}`;
      more.classList.toggle('hidden',!cursor);
      container.innerHTML=items.length?items.map(p=>`<article class="project-card">${p.coverUrl?`<img class="project-cover" src="${e(p.coverUrl)}" alt="" loading="lazy">`:''}<div class="project-card-body"><span class="badge success">Published</span><h3><a href="/projects/${encodeURIComponent(p.slug)}">${e(p.title)}</a></h3><p>${e(p.summary||'No description yet.')}</p><a href="/user/${encodeURIComponent(p.owner_slug)}">By ${e(p.owner_name)}</a></div></article>`).join(''):'<div class="ws-empty"><h3>No matching projects</h3><p>Try another search, or come back soon for new builds.</p></div>';
    }catch(error){count.textContent='Projects could not be loaded.';container.innerHTML=`<div class="ws-error"><p>${e(error.message)}</p><button id="retryGallery" class="secondary-button">Try again</button></div>`;document.getElementById('retryGallery').onclick=()=>load();}
    finally{more.disabled=false;}
  }
  input.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{history.replaceState({},'','/gallery'+(input.value?'?q='+encodeURIComponent(input.value):''));load();},300);};
  more.onclick=()=>load(true);load();
})();

const { requestJson, escapeHtml } = window.NVNC;
const Motion = window.NVNCMotion;
let allProjects = [];
let nextCursor;
const render = () => {
  const query = document.getElementById("projectSearch").value.toLowerCase();
  const projects = allProjects.filter((project) => `${project.title} ${project.summary} ${project.owner_name}`.toLowerCase().includes(query));
  document.getElementById("gallery").innerHTML = projects.length ? projects.map((project) => `<article class="project-card"><div class="project-card-body"><span class="badge success">Published</span><h3><a href="/project.html?project=${encodeURIComponent(project.slug)}">${escapeHtml(project.title)}</a></h3><p>${escapeHtml(project.summary || "No summary yet.")}</p><a href="/profile.html?slug=${encodeURIComponent(project.owner_slug)}">By ${escapeHtml(project.owner_name)}</a></div></article>`).join("") : '<div class="empty-state"><h3>No matching projects</h3><p>Try a different search.</p></div>';
  Motion.reveal(document.querySelectorAll("#gallery .project-card"));
};
const load = async (append = false) => {
  const result = await requestJson(`/api/projects?status=published&limit=24${append && nextCursor ? `&cursor=${encodeURIComponent(nextCursor)}` : ""}`);
  allProjects = append ? allProjects.concat(result.projects || []) : result.projects || [];
  nextCursor = result.nextCursor;
  if (nextCursor) Motion.show(document.getElementById("loadMore"));
  else Motion.hide(document.getElementById("loadMore"));
  render();
};
document.getElementById("projectSearch").oninput = render;
document.getElementById("loadMore").onclick = () => load(true);
load().catch((error) => { document.getElementById("gallery").innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`; });

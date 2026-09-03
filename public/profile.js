const { requestJson, jsonOptions, escapeHtml, markdown } = window.NVNC;
const Motion = window.NVNCMotion;
const params = new URLSearchParams(location.search);
const requestedSlug = params.get("slug");
let ownUser;
let member;
let projects = [];
const renderProfile = () => {
  document.title = `${member.displayName} / No Vibe No Code`;
  document.getElementById("profileTitle").textContent = member.displayName;
  document.getElementById("displayName").textContent = member.displayName;
  document.getElementById("profileBio").textContent = member.bio || "No public bio yet.";
  document.getElementById("skills").textContent = (member.skills || []).join(" · ") || "Building with AI.";
  if (member.profileImageUrl) document.getElementById("profileAvatar").src = member.profileImageUrl;
  document.getElementById("profileLinks").innerHTML = (member.links || []).map((link) => `<a class="secondary-button" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`).join("");
  document.getElementById("readme").innerHTML = `<p>${markdown(member.readme || "# Hello\nThis member has not published a README yet.")}</p>`;
  document.getElementById("profileProjects").innerHTML = projects.length ? projects.map((project) => `<a class="project-card" href="/project.html?project=${encodeURIComponent(project.slug)}"><div class="project-card-body"><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.summary)}</p><span class="badge success">Published</span></div></a>`).join("") : '<div class="empty-state"><h3>No public projects</h3><p>Published work will appear here.</p></div>';
};
const load = async () => {
  const me = await requestJson("/api/me").catch(() => ({ user:null }));
  ownUser = me.user;
  const slug = requestedSlug || ownUser?.public_slug;
  if (!slug) throw new Error("Choose a member profile from the gallery.");
  const result = await requestJson(`/api/members/${encodeURIComponent(slug)}`);
  member = result.member;
  projects = result.projects || [];
  renderProfile();
  if (ownUser?.public_slug === slug) {
    Motion.show(document.getElementById("editToggle"));
    document.getElementById("englishName").value = ownUser.english_name || "";
    document.getElementById("chineseName").value = ownUser.chinese_name || "";
    document.getElementById("wechatId").value = ownUser.wechat_id || "";
    document.getElementById("classGrade").value = ownUser.class_grade || "";
    document.getElementById("bio").value = ownUser.bio || "";
    document.getElementById("skillsInput").value = (ownUser.skills || []).join(", ");
    document.getElementById("readmeDraft").value = ownUser.readme_draft || "";
    if (params.get("edit") === "1") Motion.show(document.getElementById("profileEditor"));
  }
};
document.getElementById("editToggle").onclick = () => Motion.toggle(document.getElementById("profileEditor"));
document.getElementById("readmeTab").onclick = async () => { await Motion.swap(document.getElementById("profileProjects"),document.getElementById("readme")); document.getElementById("readmeTab").setAttribute("aria-selected","true"); document.getElementById("projectsTab").setAttribute("aria-selected","false"); };
document.getElementById("projectsTab").onclick = async () => { await Motion.swap(document.getElementById("readme"),document.getElementById("profileProjects")); document.getElementById("readmeTab").setAttribute("aria-selected","false"); document.getElementById("projectsTab").setAttribute("aria-selected","true"); };
document.getElementById("previewReadme").onclick = () => { document.getElementById("readme").innerHTML = `<p>${markdown(document.getElementById("readmeDraft").value)}</p>`; document.getElementById("readme").scrollIntoView({ behavior:"smooth" }); };
document.getElementById("profileForm").onsubmit = async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); data.skills = data.skillsInput.split(",").map((item) => item.trim()).filter(Boolean); delete data.skillsInput; try { await requestJson("/api/profile", jsonOptions("PUT", data)); document.getElementById("profileMessage").textContent = "Profile draft saved."; } catch (error) { document.getElementById("profileMessage").textContent = error.message; } };
document.getElementById("publishReadme").onclick = async () => { document.getElementById("profileForm").requestSubmit(); await requestJson("/api/profile/readme/publish", jsonOptions("POST", {})); document.getElementById("profileMessage").textContent = "README published."; };
load().catch((error) => { document.querySelector(".product-content").innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`; });

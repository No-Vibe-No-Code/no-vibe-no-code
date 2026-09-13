const { requestJson, jsonOptions, escapeHtml, markdown } = window.NVNC;
const Motion = window.NVNCMotion;
const params = new URLSearchParams(location.search);
const routeName = location.pathname.startsWith("/user/") ? decodeURIComponent(location.pathname.slice(6)) : "";
const requestedSlug = params.get("slug") || routeName;
let ownUser;
let member;
let projects = [];

const renderProfile = () => {
  const github = member.github;
  const githubReadme = github?.enabled && github.readmeHtml;
  const avatarUrl = member.profileImageUrl || github?.avatarUrl;
  const links = [...(member.links || [])];
  if (github?.profileUrl && !links.some((link) => link.url === github.profileUrl)) links.unshift({ label: "GitHub", url: github.profileUrl });
  document.title = `${member.displayName} / No Vibe No Code`;
  document.getElementById("profileTitle").textContent = member.displayName;
  document.getElementById("displayName").textContent = member.displayName;
  document.getElementById("profileBio").textContent = member.bio || github?.bio || "No public bio yet.";
  document.getElementById("skills").textContent = (member.skills || []).join(" · ") || "Building with AI.";
  if (avatarUrl) document.getElementById("profileAvatar").src = avatarUrl;
  document.getElementById("profileLinks").innerHTML = links.map((link) => `<a class="secondary-button" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`).join("");
  const sourceNote = githubReadme ? `<div class="github-readme-source"><span>LIVE FROM GITHUB</span><a href="${escapeHtml(github.profileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(github.username || "GitHub")} ↗</a></div>` : "";
  document.getElementById("readme").innerHTML = githubReadme ? `${sourceNote}${github.readmeHtml}` : `<p>${markdown(member.readme || "# Hello\nThis member has not published a README yet.")}</p>`;
  document.getElementById("profileProjects").innerHTML = projects.length ? projects.map((project) => `<a class="project-card" href="/project.html?project=${encodeURIComponent(project.slug)}"><div class="project-card-body"><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.summary)}</p><span class="badge success">Published</span></div></a>`).join("") : '<div class="empty-state"><h3>No public projects</h3><p>Published work will appear here.</p></div>';
};

const load = async () => {
  const me = await requestJson("/api/me").catch(() => ({ user: null }));
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
    document.getElementById("githubProfileUrl").value = ownUser.github_profile_url || "";
    document.getElementById("githubReadmeEnabled").checked = Boolean(ownUser.github_readme_enabled);
    document.getElementById("readmeDraft").value = ownUser.readme_draft || "";
    if (params.get("edit") === "1") Motion.show(document.getElementById("profileEditor"));
  }
};

document.getElementById("editToggle").onclick = () => Motion.toggle(document.getElementById("profileEditor"));
document.getElementById("readmeTab").onclick = async () => { await Motion.swap(document.getElementById("profileProjects"), document.getElementById("readme")); document.getElementById("readmeTab").setAttribute("aria-selected", "true"); document.getElementById("projectsTab").setAttribute("aria-selected", "false"); };
document.getElementById("projectsTab").onclick = async () => { await Motion.swap(document.getElementById("readme"), document.getElementById("profileProjects")); document.getElementById("readmeTab").setAttribute("aria-selected", "false"); document.getElementById("projectsTab").setAttribute("aria-selected", "true"); };
document.getElementById("previewReadme").onclick = () => { document.getElementById("readme").innerHTML = `<p>${markdown(document.getElementById("readmeDraft").value)}</p>`; document.getElementById("readme").scrollIntoView({ behavior: "smooth" }); };

const profileForm = document.getElementById("profileForm");
const profileMessage = document.getElementById("profileMessage");
const githubProfileUrl = document.getElementById("githubProfileUrl");
const githubReadmeEnabled = document.getElementById("githubReadmeEnabled");
const saveProfile = async () => {
  const data = Object.fromEntries(new FormData(profileForm));
  data.skills = String(data.skillsInput || "").split(",").map((item) => item.trim()).filter(Boolean);
  data.githubProfileUrl = githubProfileUrl.value.trim();
  data.githubReadmeEnabled = githubReadmeEnabled.checked;
  delete data.skillsInput;
  await requestJson("/api/profile", jsonOptions("PUT", data));
  if (ownUser) {
    ownUser.github_profile_url = data.githubProfileUrl;
    ownUser.github_readme_enabled = data.githubReadmeEnabled ? 1 : 0;
  }
};

profileForm.onsubmit = async (event) => {
  event.preventDefault();
  try {
    await saveProfile();
    profileMessage.textContent = "Profile draft saved.";
  } catch (error) {
    profileMessage.textContent = error.message;
  }
};

document.getElementById("syncGithub").onclick = async () => {
  if (!githubProfileUrl.value.trim()) {
    profileMessage.textContent = "Add your GitHub profile URL first.";
    githubProfileUrl.focus();
    return;
  }
  const button = document.getElementById("syncGithub");
  button.disabled = true;
  button.textContent = "Syncing GitHub README…";
  githubReadmeEnabled.checked = true;
  profileMessage.textContent = "";
  try {
    await saveProfile();
    const result = await requestJson("/api/profile/github/sync", jsonOptions("POST", {}));
    member.github = result.github;
    renderProfile();
    profileMessage.textContent = "GitHub README imported. It will refresh automatically when your public README changes.";
  } catch (error) {
    profileMessage.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Use GitHub profile README ↗";
  }
};

document.getElementById("publishReadme").onclick = async () => {
  try {
    await saveProfile();
    await requestJson("/api/profile/readme/publish", jsonOptions("POST", {}));
    profileMessage.textContent = "README published.";
  } catch (error) {
    profileMessage.textContent = error.message;
  }
};

load().catch((error) => { document.querySelector(".product-content").innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`; });

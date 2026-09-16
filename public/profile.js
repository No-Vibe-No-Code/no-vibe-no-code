const { requestJson, jsonOptions, escapeHtml, markdown } = window.NVNC;
const Motion = window.NVNCMotion;
const params = new URLSearchParams(location.search);
const routeName = location.pathname.startsWith("/user/") ? decodeURIComponent(location.pathname.slice(6)) : "";
const requestedSlug = params.get("slug") || routeName;
let ownUser;
let member;
let projects = [];

const iconSvg = (kind) => {
  const paths = {
    github: '<path d="M12 3.3a8.7 8.7 0 0 0-2.75 16.95c.44.08.6-.19.6-.42v-1.5c-2.45.53-2.97-1.04-2.97-1.04-.4-1.02-.98-1.3-.98-1.3-.8-.55.06-.54.06-.54.88.06 1.34.9 1.34.9.78 1.33 2.05.95 2.55.73.08-.57.3-.95.55-1.17-1.96-.22-4.02-.98-4.02-4.37 0-.97.35-1.76.9-2.38-.09-.22-.39-1.12.08-2.34 0 0 .74-.24 2.42.9a8.42 8.42 0 0 1 4.4 0c1.68-1.14 2.42-.9 2.42-.9.47 1.22.17 2.12.08 2.34.56.62.9 1.41.9 2.38 0 3.4-2.06 4.15-4.03 4.37.32.28.59.82.59 1.65v2.27c0 .23.16.5.6.42A8.7 8.7 0 0 0 12 3.3Z" fill="currentColor"/>',
    youtube: '<rect x="3.5" y="6" width="17" height="12" rx="3"/><path d="m10 9 5 3-5 3V9Z" fill="currentColor" stroke="none"/>',
    douyin: '<path d="M14 4v9.2a3.8 3.8 0 1 1-3.1-3.74"/><path d="M14 4c.46 1.8 1.55 3.04 3.5 3.5"/>',
    xiaohongshu: '<rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M7.5 8.5h9M7.5 12h9M7.5 15.5h5"/>',
    x: '<path d="m5 4 14 16M19 4 5 20"/>',
    link: '<path d="M9.5 14.5 14.5 9.5M7.2 17.8l-1 1a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M16.8 6.2l1-1a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0"/>',
    wechat: '<path d="M8.5 17.5c-3 0-5.5-1.8-5.5-4s2.5-4 5.5-4 5.5 1.8 5.5 4-2.5 4-5.5 4Z"/><path d="M13.7 11.8c.63-2.2 3-3.8 5.8-3.8 3.3 0 6 2 6 4.5 0 1.6-1.06 3.05-2.7 3.85l.4 2.15-2.6-1.18a7.6 7.6 0 0 1-1.1.08c-1.25 0-2.4-.3-3.36-.8"/><circle cx="6.5" cy="13.5" r=".65" fill="currentColor" stroke="none"/><circle cx="10.5" cy="13.5" r=".65" fill="currentColor" stroke="none"/><circle cx="17.5" cy="12.5" r=".65" fill="currentColor" stroke="none"/><circle cx="21.5" cy="12.5" r=".65" fill="currentColor" stroke="none"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    teams: '<circle cx="8" cy="9" r="3"/><circle cx="17" cy="8" r="2.2"/><path d="M2.8 18c.4-2.5 2.2-4 5.2-4s4.8 1.5 5.2 4M14 14c2.4-.2 4.3 1.1 4.8 3"/>',
  };
  return `<svg class="profile-link-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[kind] || paths.link}</svg>`;
};

const linkKind = (url) => {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "github.com") return "github";
    if (host === "youtube.com" || host === "youtu.be") return "youtube";
    if (host === "douyin.com" || host.endsWith(".douyin.com")) return "douyin";
    if (host === "xiaohongshu.com" || host === "xhslink.com" || host.endsWith(".xiaohongshu.com")) return "xiaohongshu";
    if (host === "x.com" || host === "twitter.com") return "x";
  } catch {}
  return "link";
};

const renderProfileRail = () => {
  const github = member.github;
  const links = [];
  if (github?.profileUrl) links.push({ label: "GitHub", url: github.profileUrl, kind: "github" });
  for (const link of member.links || []) {
    if (!link?.url || links.some((item) => item.url === link.url)) continue;
    links.push({ label: link.label || "Link", url: link.url, kind: linkKind(link.url) });
  }
  const linkHtml = links.map((link) => `<a class="profile-link-row" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"><span class="profile-link-mark profile-link-mark--${link.kind}">${iconSvg(link.kind)}</span><span>${escapeHtml(link.label)}</span><span class="profile-link-arrow" aria-hidden="true">↗</span></a>`).join("");
  const teamsHtml = (member.teams || []).map((team) => `<div class="profile-team-row"><span class="profile-link-mark profile-link-mark--teams">${iconSvg("teams")}</span><span><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(team.role || "member")}</small></span></div>`).join("");
  const contacts = member.contacts || {};
  const contactItems = [];
  if (contacts.wechatId) contactItems.push(`<div class="profile-contact-row"><span class="profile-link-mark profile-link-mark--wechat">${iconSvg("wechat")}</span><span><small>WeChat</small><strong>${escapeHtml(contacts.wechatId)}</strong></span></div>`);
  if (contacts.email) contactItems.push(`<a class="profile-contact-row" href="mailto:${escapeHtml(contacts.email)}"><span class="profile-link-mark profile-link-mark--mail">${iconSvg("mail")}</span><span><small>Email</small><strong>${escapeHtml(contacts.email)}</strong></span></a>`);
  const sections = [
    ["profileLinksSection", "profileLinks", linkHtml],
    ["profileTeamsSection", "profileTeams", teamsHtml],
    ["profileContactsSection", "profileContacts", contactItems.join("")],
  ];
  sections.forEach(([sectionId, contentId, html]) => {
    document.getElementById(contentId).innerHTML = html;
    document.getElementById(sectionId).classList.toggle("hidden", !html);
  });
};

const renderProfile = () => {
  const github = member.github;
  const githubReadme = github?.enabled && github.readmeHtml;
  const avatarUrl = member.profileImageUrl || github?.avatarUrl;
  document.title = `${member.displayName} / No Vibe No Code`;
  document.getElementById("profileTitle").textContent = member.displayName;
  document.getElementById("displayName").textContent = member.displayName;
  document.getElementById("profileBio").textContent = member.bio || github?.bio || "No public bio yet.";
  document.getElementById("skills").textContent = (member.skills || []).join(" · ") || "Building with AI.";
  document.getElementById("profileAvatar").src = avatarUrl || "/logo-symbol.webp";
  renderProfileRail();
  const sourceNote = githubReadme ? `<div class="github-readme-source"><span>IMPORTED FROM GITHUB</span><a href="${escapeHtml(github.profileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(github.username || "GitHub")} ↗</a></div>` : "";
  const readme = document.getElementById("readme");
  readme.innerHTML = githubReadme ? `${sourceNote}${github.readmeHtml}` : markdown(member.readme || "# Hello\nThis member has not published a README yet.");
  readme.classList.toggle("readme--github", Boolean(githubReadme));
  if (githubReadme) {
    // GitHub honors README image dimensions, including fractional percentages.
    // Apply them to cached imports too, without trusting arbitrary CSS from the README.
    readme.querySelectorAll("img[width], img[height], table[width]").forEach((element) => {
      for (const dimension of ["width", "height"]) {
        const value = element.getAttribute(dimension);
        const match = /^(\d{1,4}(?:\.\d+)?)(%)?$/.exec(value || "");
        if (match) element.style[dimension] = `${match[1]}${match[2] || "px"}`;
      }
    });
  }
  document.getElementById("profileProjects").innerHTML = projects.length ? projects.map((project) => `<a class="project-card" href="/project.html?project=${encodeURIComponent(project.slug)}"><div class="project-card-body"><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.summary)}</p><span class="badge success">Published</span></div></a>`).join("") : '<div class="empty-state"><h3>No public projects</h3><p>Published work will appear here.</p></div>';
};

const linksEditor = document.getElementById("linksEditor");
const addLinkRow = (link = {}) => {
  const row = document.createElement("div");
  row.className = "link-editor-row";
  row.innerHTML = '<input class="link-label-input" type="text" maxlength="60" placeholder="Label (e.g. YouTube)" aria-label="Link label"><input class="link-url-input" type="url" maxlength="500" placeholder="https://..." aria-label="Link URL"><button class="text-button remove-link" type="button" aria-label="Remove link">×</button>';
  row.querySelector(".link-label-input").value = link.label || "";
  row.querySelector(".link-url-input").value = link.url || "";
  row.querySelector(".remove-link").onclick = () => { row.remove(); };
  linksEditor.appendChild(row);
};
const renderLinksEditor = (links = []) => {
  linksEditor.innerHTML = "";
  (links.length ? links : [{}]).forEach(addLinkRow);
};
const readLinksEditor = () => [...linksEditor.querySelectorAll(".link-editor-row")].map((row) => ({
  label: row.querySelector(".link-label-input").value.trim(),
  url: row.querySelector(".link-url-input").value.trim(),
})).filter((link) => link.label && /^https?:\/\//i.test(link.url));

const nfcCards = document.getElementById("nfcCards");
const nfcStatus = document.getElementById("nfcStatus");
const loadMyCards = async () => {
  const result = await requestJson("/api/nfc/my-cards");
  if (!result.cards.length) {
    nfcCards.textContent = "No cards bound yet. Scan a card and choose ‘Bind to my profile’ first.";
    return;
  }
  nfcCards.innerHTML = result.cards.map((card) => `<div class="nfc-card-setting" data-card-id="${escapeHtml(card.id)}"><strong>${escapeHtml(card.label)}</strong><label>Custom tap link<input class="nfc-destination" type="url" inputmode="url" maxlength="500" placeholder="https://example.com/your-page" value="${escapeHtml(card.redirectUrl)}"></label><small>Leave blank for your public profile.</small><div class="nfc-card-actions"><button class="secondary-button nfc-save" type="button">Save link</button><button class="text-button nfc-default" type="button">Use my profile</button></div><p class="status-message nfc-card-status" role="status"></p></div>`).join("");
  nfcCards.querySelectorAll(".nfc-card-setting").forEach((row) => {
    const input = row.querySelector(".nfc-destination");
    const message = row.querySelector(".nfc-card-status");
    const saveButton = row.querySelector(".nfc-save");
    const defaultButton = row.querySelector(".nfc-default");
    const save = async (redirectUrl) => {
      saveButton.disabled = true;
      defaultButton.disabled = true;
      message.textContent = "Saving…";
      try {
        const saved = await requestJson(`/api/nfc/my-cards/${encodeURIComponent(row.dataset.cardId)}`, jsonOptions("PUT", { redirectUrl }));
        input.value = saved.redirectUrl;
        message.textContent = saved.redirectUrl ? "Card taps now open your custom link." : "Card taps now open your public profile.";
      } catch (error) {
        message.textContent = error.message;
      } finally {
        saveButton.disabled = false;
        defaultButton.disabled = false;
      }
    };
    saveButton.onclick = () => save(input.value.trim());
    defaultButton.onclick = () => save("");
  });
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
  if (ownUser?.public_slug === member.slug) {
    Motion.show(document.getElementById("editToggle"));
    document.getElementById("avatarActions").classList.remove("hidden");
    document.getElementById("englishName").value = ownUser.english_name || "";
    document.getElementById("chineseName").value = ownUser.chinese_name || "";
    document.getElementById("wechatId").value = ownUser.wechat_id || "";
    document.getElementById("email").value = ownUser.email || "";
    document.getElementById("showWechatPublic").checked = Boolean(ownUser.privacy?.wechatPublic);
    document.getElementById("showEmailPublic").checked = Boolean(ownUser.privacy?.emailPublic);
    document.getElementById("classGrade").value = ownUser.class_grade || "";
    document.getElementById("bio").value = ownUser.bio || "";
    document.getElementById("skillsInput").value = (ownUser.skills || []).join(", ");
    document.getElementById("githubProfileUrl").value = ownUser.github_profile_url || "";
    document.getElementById("githubReadmeEnabled").checked = Boolean(ownUser.github_readme_enabled);
    document.getElementById("readmeDraft").value = ownUser.readme_draft || "";
    renderLinksEditor(ownUser.links || []);
    await loadMyCards().catch((error) => { nfcStatus.textContent = error.message; });
    if (params.get("edit") === "1") Motion.show(document.getElementById("profileEditor"));
  }
};

document.getElementById("editToggle").onclick = () => Motion.toggle(document.getElementById("profileEditor"));
document.getElementById("readmeTab").onclick = async () => { await Motion.swap(document.getElementById("profileProjects"), document.getElementById("readme")); document.getElementById("readmeTab").setAttribute("aria-selected", "true"); document.getElementById("projectsTab").setAttribute("aria-selected", "false"); };
document.getElementById("projectsTab").onclick = async () => { await Motion.swap(document.getElementById("readme"), document.getElementById("profileProjects")); document.getElementById("readmeTab").setAttribute("aria-selected", "false"); document.getElementById("projectsTab").setAttribute("aria-selected", "true"); };
document.getElementById("previewReadme").onclick = () => { document.getElementById("readme").innerHTML = markdown(document.getElementById("readmeDraft").value); document.getElementById("readme").scrollIntoView({ behavior: "smooth" }); };
document.getElementById("addProfileLink").onclick = () => addLinkRow();

const avatarInput = document.getElementById("avatarFile");
const avatarStatus = document.getElementById("avatarStatus");
document.getElementById("changeAvatar").onclick = () => avatarInput.click();
avatarInput.onchange = async () => {
  const file = avatarInput.files?.[0];
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2_000_000) {
    avatarStatus.textContent = "Choose a PNG, JPG, or WebP image under 2 MB.";
    avatarInput.value = "";
    return;
  }
  avatarStatus.textContent = "Uploading photo…";
  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read that photo."));
      reader.readAsDataURL(file);
    });
    await requestJson("/api/profile-image", jsonOptions("POST", { dataUrl }));
    member.profileImageUrl = `/api/profile-image/${ownUser.id}?v=${Date.now()}`;
    renderProfile();
    avatarStatus.textContent = "Profile photo updated.";
  } catch (error) {
    avatarStatus.textContent = error.message;
  } finally {
    avatarInput.value = "";
  }
};

const profileForm = document.getElementById("profileForm");
const profileMessage = document.getElementById("profileMessage");
const githubProfileUrl = document.getElementById("githubProfileUrl");
const githubReadmeEnabled = document.getElementById("githubReadmeEnabled");
const saveProfile = async ({ refresh = true } = {}) => {
  const data = Object.fromEntries(new FormData(profileForm));
  data.skills = String(data.skillsInput || "").split(",").map((item) => item.trim()).filter(Boolean);
  data.links = readLinksEditor();
  data.email = document.getElementById("email").value.trim();
  data.githubProfileUrl = githubProfileUrl.value.trim();
  data.githubReadmeEnabled = githubReadmeEnabled.checked;
  data.privacy = { ...(ownUser?.privacy || {}), wechatPublic: document.getElementById("showWechatPublic").checked, emailPublic: document.getElementById("showEmailPublic").checked };
  delete data.skillsInput;
  await requestJson("/api/profile", jsonOptions("PUT", data));
  if (refresh) await load();
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
  let profileSaved = false;
  try {
    await saveProfile({ refresh: false });
    profileSaved = true;
    await requestJson("/api/profile/github/sync", jsonOptions("POST", {}));
    await load();
    profileMessage.textContent = "GitHub README imported. It will refresh automatically when your public README changes.";
  } catch (error) {
    profileMessage.textContent = profileSaved ? `${error.message} Your profile link was saved; your published README remains available.` : error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Use GitHub profile README ↗";
  }
};

document.getElementById("publishReadme").onclick = async () => {
  try {
    await saveProfile();
    await requestJson("/api/profile/readme/publish", jsonOptions("POST", {}));
    await load();
    profileMessage.textContent = "README published.";
  } catch (error) {
    profileMessage.textContent = error.message;
  }
};

load().catch((error) => { document.querySelector(".product-content").innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`; });

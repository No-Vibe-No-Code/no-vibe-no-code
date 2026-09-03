const { requestJson, jsonOptions, escapeHtml, currentUser, setAccount, loadUnreadCount } = window.NVNC;
const Motion = window.NVNCMotion;
let user;
let activeTeamId;
const empty = (title, body, action = "") => `<div class="empty-state"><h3>${title}</h3><p>${body}</p>${action}</div>`;
const renderProjects = (projects) => {
  document.getElementById("projectCount").textContent = projects.length;
  document.getElementById("projectList").innerHTML = projects.length ? projects.map((project) => `<article class="row"><div class="row-copy"><strong>${escapeHtml(project.title)}</strong><span>${escapeHtml(project.summary || "No summary yet")}</span></div><span class="badge ${project.status === "published" ? "success" : ""}">${escapeHtml(project.status)}</span></article>`).join("") : empty("No projects yet", "Create a draft and turn your next idea into something people can try.", '<button class="primary-button" data-create-project>Create project</button>');
  Motion.reveal(document.querySelectorAll("#projectList .row"));
};
const renderTeams = (teams) => {
  document.getElementById("teamCount").textContent = teams.length;
  document.getElementById("teamList").innerHTML = teams.length ? teams.map((team) => `<a class="row" href="/home.html?team=${encodeURIComponent(team.id)}"><div class="row-copy"><strong>${escapeHtml(team.name)}</strong><span>${escapeHtml(team.role || "member")}</span></div></a>`).join("") : empty("No team yet", "Create a team or accept an invitation.");
  Motion.reveal(document.querySelectorAll("#teamList .row"));
};
const renderInvitations = (invitations) => {
  document.getElementById("invitationList").innerHTML = invitations.length ? invitations.map((invite) => `<article class="row" data-invitation="${escapeHtml(invite.id)}"><div class="row-copy"><strong>${escapeHtml(invite.team_name)}</strong><span>Invited by ${escapeHtml(invite.inviter_name)}</span></div><div><button class="primary-button" data-answer="accepted">Accept</button><button class="text-button" data-answer="declined">Decline</button></div></article>`).join("") : empty("No invitations", "New team invitations will appear here.");
  Motion.reveal(document.querySelectorAll("#invitationList .row"));
};
const renderNotifications = (notifications) => {
  document.getElementById("notificationList").innerHTML = notifications.length ? notifications.map((item) => `<a class="row ${item.read_at ? "" : "is-unread"}" href="${escapeHtml(item.action_url || "#")}" data-notification="${escapeHtml(item.id)}"><div class="row-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.body || "")}</span></div><span>${new Date(item.created_at).toLocaleDateString()}</span></a>`).join("") : empty("Inbox clear", "Invitations, reviews, and club broadcasts will appear here.");
  Motion.reveal(document.querySelectorAll("#notificationList .row"));
};
const load = async () => {
  user = await currentUser();
  setAccount(user);
  document.getElementById("welcome").textContent = `Welcome back, ${user.display_name}.`;
  const [projects, teams, notifications] = await Promise.all([
    requestJson("/api/projects?mine=1&limit=20"),
    requestJson("/api/teams?mine=1&limit=20"),
    requestJson("/api/notifications?limit=20")
  ]);
  renderProjects(projects.projects || projects.results || []);
  renderTeams(teams.teams || teams.results || []);
  renderInvitations(teams.invitations || []);
  const notices = notifications.notifications || notifications.results || [];
  renderNotifications(notices);
  const unread = notices.filter((item) => !item.read_at).length;
  document.getElementById("unreadCount").textContent = unread;
  loadUnreadCount();
  const selectedTeam = new URLSearchParams(location.search).get("team");
  if (selectedTeam) openTeam(selectedTeam);
};
const openTeam = async (teamId) => {
  const result = await requestJson(`/api/teams/${encodeURIComponent(teamId)}`);
  activeTeamId = result.team.id;
  document.getElementById("teamDetailName").textContent = result.team.name;
  document.getElementById("teamMembers").innerHTML = result.members.map((member) => `<a class="row" href="/profile.html?slug=${encodeURIComponent(member.public_slug)}"><div class="row-copy"><strong>${escapeHtml(member.display_name)}</strong><span>${escapeHtml(member.role)}</span></div></a>`).join("");
  const canInvite = ["owner","admin"].includes(result.viewerRole);
  if (canInvite) Motion.show(document.getElementById("inviteForm"));
  else Motion.hide(document.getElementById("inviteForm"));
  Motion.show(document.getElementById("teamDetail"));
};
const projectDialog = document.getElementById("projectDialog");
const teamDialog = document.getElementById("teamDialog");
const openProject = () => Motion.openDialog(projectDialog);
document.getElementById("newProject").onclick = openProject;
document.getElementById("newProjectSecondary").onclick = openProject;
document.addEventListener("click", async (event) => {
  if (event.target.matches("[data-create-project]")) openProject();
  if (event.target.matches("[data-close]")) Motion.closeDialog(document.getElementById(event.target.dataset.close));
  const answer = event.target.closest("[data-answer]");
  if (answer) {
    const row = answer.closest("[data-invitation]");
    await requestJson(`/api/team-invitations/${row.dataset.invitation}/respond`, jsonOptions("POST", { status: answer.dataset.answer }));
    await Motion.remove(row);
    loadUnreadCount();
  }
  const notification = event.target.closest("[data-notification]");
  if (notification) {
    event.preventDefault();
    await requestJson(`/api/notifications/${notification.dataset.notification}/read`, jsonOptions("POST", {}));
    notification.classList.remove("is-unread");
    loadUnreadCount();
    if (notification.getAttribute("href") !== "#") location.href = notification.getAttribute("href");
  }
});
document.getElementById("newTeam").onclick = () => Motion.openDialog(teamDialog);
document.getElementById("closeTeamDetail").onclick = () => Motion.hide(document.getElementById("teamDetail"));
document.getElementById("inviteForm").onsubmit = async (event) => { event.preventDefault(); const output=document.getElementById("inviteMessage"); try { await requestJson(`/api/teams/${activeTeamId}/invitations`,jsonOptions("POST",Object.fromEntries(new FormData(event.target)))); output.textContent="Invitation sent."; event.target.reset(); } catch(error){output.textContent=error.message;} };
document.getElementById("editProfile").onclick = () => location.href = `/profile.html?edit=1`;
const toggleNotifications = () => Motion.toggle(document.getElementById("notificationPanel"));
document.getElementById("notificationButton").onclick = toggleNotifications;
document.getElementById("notificationNav").onclick = toggleNotifications;
document.getElementById("markAllRead").onclick = async () => { await requestJson("/api/notifications/read-all", jsonOptions("POST", {})); document.querySelectorAll(".is-unread").forEach((row) => row.classList.remove("is-unread")); loadUnreadCount(); };
document.getElementById("projectForm").onsubmit = async (event) => { event.preventDefault(); const message = document.getElementById("projectMessage"); try { await requestJson("/api/projects", jsonOptions("POST", Object.fromEntries(new FormData(event.target)))); await Motion.closeDialog(projectDialog); location.reload(); } catch (error) { message.textContent = error.message; } };
document.getElementById("teamForm").onsubmit = async (event) => { event.preventDefault(); const message = document.getElementById("teamMessage"); try { await requestJson("/api/teams", jsonOptions("POST", Object.fromEntries(new FormData(event.target)))); await Motion.closeDialog(teamDialog); location.reload(); } catch (error) { message.textContent = error.message; } };
load().catch((error) => { document.querySelector(".product-content").innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`; });

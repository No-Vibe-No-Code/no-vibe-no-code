const { requestJson, escapeHtml } = window.NVNC;
const Motion = window.NVNCMotion;
let allMembers = [];
const render = () => {
  const query = document.getElementById("memberSearch").value.toLowerCase().trim();
  const members = allMembers.filter((member) => `${member.displayName} ${(member.skills || []).join(" ")} ${member.bio || ""}`.toLowerCase().includes(query));
  document.getElementById("members").innerHTML = members.length ? members.map((member, index) => `<a class="member-card" style="--index:${index}" href="/user/${encodeURIComponent(member.displayName)}"><div class="member-card-top">${member.profileImageUrl ? `<img src="${escapeHtml(member.profileImageUrl)}" alt="">` : `<span class="member-avatar-fallback">${escapeHtml(member.displayName.slice(0, 1).toUpperCase())}</span>`}<span class="badge">${escapeHtml(member.joinedAt ? new Date(member.joinedAt).getFullYear() : "Member")}</span></div><h3>${escapeHtml(member.displayName)}</h3><p>${escapeHtml(member.bio || (member.skills || []).join(" · ") || "Building with AI.")}</p><span class="member-card-link">View profile ↗</span></a>`).join("") : '<div class="empty-state"><h3>No matching members</h3><p>Try a different name or interest.</p></div>';
  Motion.reveal(document.querySelectorAll("#members .member-card"));
};
const load = async () => {
  const result = await requestJson("/api/members?limit=100");
  allMembers = result.members || [];
  render();
};
document.getElementById("memberSearch").oninput = render;
load().catch((error) => { document.getElementById("members").innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`; });

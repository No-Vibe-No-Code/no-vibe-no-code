const message = document.getElementById("adminMessage");
const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result;
};
const jsonOptions = (method, data) => ({
  method,
  headers: { "content-type":"application/json" },
  body: JSON.stringify(data),
});
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[character]);
const roles = ["non-member", "member", "maintainer", "club-leader", "teacher"];

const renderUsers = (users) => {
  document.getElementById("userCount").textContent = `${users.length} total`;
  document.getElementById("users").innerHTML = users.length ? users.map((user) => `
    <article class="admin-row" data-user-id="${escapeHtml(user.id)}">
      <div><strong>${escapeHtml(user.display_name)}</strong><span>${escapeHtml(user.english_name)} · ${escapeHtml(user.chinese_name)} · ${escapeHtml(user.class_grade)}</span></div>
      <label>Role<select class="role-select">${roles.map((role) => `<option value="${role}"${role === user.role ? " selected" : ""}>${role}</option>`).join("")}</select></label>
      <button class="outline-button reset-password" type="button">Reset password</button>
    </article>`).join("") : "<p>No members yet.</p>";

  document.querySelectorAll(".role-select").forEach((select) => {
    select.onchange = async () => {
      const row = select.closest("[data-user-id]");
      try {
        await requestJson(`/api/admin/users/${row.dataset.userId}`, jsonOptions("PUT", { role:select.value }));
        message.textContent = "Role updated.";
      } catch (error) {
        message.textContent = error.message;
      }
    };
  });
  document.querySelectorAll(".reset-password").forEach((button) => {
    button.onclick = async () => {
      const row = button.closest("[data-user-id]");
      const password = prompt("Enter a new password (at least 8 characters):");
      if (!password) return;
      try {
        await requestJson(`/api/admin/users/${row.dataset.userId}/password`, jsonOptions("PUT", { password }));
        message.textContent = "Password reset.";
      } catch (error) {
        message.textContent = error.message;
      }
    };
  });
};

const renderContacts = (contacts) => {
  document.getElementById("contactCount").textContent = `${contacts.length} total`;
  document.getElementById("contacts").innerHTML = contacts.length ? contacts.map((contact) => `
    <article class="admin-row contact-row">
      <div><strong>${escapeHtml(contact.name)}</strong><span>${escapeHtml(contact.wechat_id)} · ${new Date(contact.created_at).toLocaleString()}</span><p>${escapeHtml(contact.message)}</p></div>
      <span class="status-badge"><i></i>${escapeHtml(contact.status)}</span>
    </article>`).join("") : "<p>No messages yet.</p>";
};

const load = async () => {
  try {
    const [users, contacts, status] = await Promise.all([
      requestJson("/api/admin/users"),
      requestJson("/api/admin/contacts"),
      requestJson("/api/site-status"),
    ]);
    renderUsers(users.users.results || []);
    renderContacts(contacts.contacts.results || []);
    document.getElementById("competitionActive").checked = status.competitionActive;
  } catch (error) {
    document.querySelector(".admin-shell").innerHTML = `<section class="admin-denied"><p class="eyebrow">ACCESS DENIED</p><h1>Sign in first.</h1><p>${escapeHtml(error.message)}</p><a class="pink-button" href="/">Return to the site</a></section>`;
  }
};

document.getElementById("competitionActive").onchange = async (event) => {
  try {
    await requestJson("/api/site-status", jsonOptions("PUT", { competitionActive:event.target.checked }));
    message.textContent = "Competition status updated.";
  } catch (error) {
    event.target.checked = !event.target.checked;
    message.textContent = error.message;
  }
};

load();

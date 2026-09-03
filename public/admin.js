const { requestJson, jsonOptions, escapeHtml, currentUser, setAccount } = window.NVNC;
const Motion = window.NVNCMotion;
const message = document.getElementById("adminMessage");
const roles = ["non-member", "member", "maintainer", "club-leader", "teacher"];
let users = [];
let forms = [];
let currentFormId = null;
let fields = [];
const uid = () => crypto.randomUUID();
const empty = (title, body) => `<div class="empty-state"><h3>${title}</h3><p>${body}</p></div>`;
const renderUsers = () => {
  const query = document.getElementById("memberSearch").value.toLowerCase();
  const role = document.getElementById("roleFilter").value;
  const filtered = users.filter((user) => (!role || user.role === role) && `${user.display_name} ${user.english_name} ${user.chinese_name} ${user.class_grade}`.toLowerCase().includes(query));
  document.getElementById("userCount").textContent = `${filtered.length} shown`;
  document.getElementById("users").innerHTML = filtered.length ? filtered.map((user) => `<article class="row" data-user-id="${escapeHtml(user.id)}"><div class="row-copy"><strong>${escapeHtml(user.display_name)}</strong><span>${escapeHtml(user.english_name)} / ${escapeHtml(user.chinese_name)} / ${escapeHtml(user.class_grade)}</span></div><label>Role <select class="role-select">${roles.map((item) => `<option value="${item}"${item === user.role ? " selected" : ""}>${item}</option>`).join("")}</select></label><label>Status <select class="status-select"><option value="active"${user.status === "active" ? " selected" : ""}>active</option><option value="suspended"${user.status === "suspended" ? " selected" : ""}>suspended</option><option value="archived"${user.status === "archived" ? " selected" : ""}>archived</option></select></label><button class="text-button reset-password" type="button">Reset password</button></article>`).join("") : empty("No matching members", "Change the search or role filter.");
  Motion.reveal(document.querySelectorAll("#users .row"));
};
const renderContacts = (contacts) => {
  document.getElementById("contactCount").textContent = `${contacts.length} total`;
  document.getElementById("contactsList").innerHTML = contacts.length ? contacts.map((contact) => `<article class="row"><div class="row-copy"><strong>${escapeHtml(contact.name)}</strong><span>${escapeHtml(contact.wechat_id)} / ${new Date(contact.created_at).toLocaleString()}</span><p>${escapeHtml(contact.message)}</p></div><span class="badge">${escapeHtml(contact.status)}</span></article>`).join("") : empty("Inbox clear", "New contact messages will appear here.");
  Motion.reveal(document.querySelectorAll("#contactsList .row"));
};
const renderForms = () => {
  document.getElementById("formsList").innerHTML = forms.length ? forms.map((form) => `<article class="row" data-form-id="${escapeHtml(form.id)}"><div class="row-copy"><strong>${escapeHtml(form.title)}</strong><span>${escapeHtml(form.status)} / ${form.response_count || 0} responses / ${escapeHtml(form.access)}</span></div><div><a class="text-button" href="/api/admin/forms/${encodeURIComponent(form.id)}/responses?format=csv">Export CSV</a><a class="text-button" href="/form.html?form=${encodeURIComponent(form.slug)}" target="_blank">Preview</a><button class="secondary-button edit-form" type="button">Edit</button></div></article>`).join("") : empty("No forms yet", "Build a signup, registration, survey, or feedback form.");
  Motion.reveal(document.querySelectorAll("#formsList .row"));
};
const renderProjects = (projects) => {
  document.getElementById("adminProjects").innerHTML = projects.length ? projects.map((project) => `<article class="row" data-project-id="${escapeHtml(project.id)}"><div class="row-copy"><strong>${escapeHtml(project.title)}</strong><span>By ${escapeHtml(project.owner_name)} / ${escapeHtml(project.status)}</span></div><div><button class="secondary-button project-status" data-status="changes-requested">Request changes</button><button class="primary-button project-status" data-status="published">Publish</button></div></article>`).join("") : empty("Nothing to review", "Submitted projects will appear here.");
  Motion.reveal(document.querySelectorAll("#adminProjects .row"));
};
const needsOptions = (type) => ["single-choice", "checkboxes", "dropdown"].includes(type);
const renderQuestions = () => {
  document.getElementById("questionList").innerHTML = fields.length ? fields.map((field, index) => `<article class="question-card" data-field-id="${field.id}"><div class="question-head"><input class="question-label" value="${escapeHtml(field.label)}" aria-label="Question label"><span class="badge">${escapeHtml(field.type)}</span></div><div class="form-grid"><div class="field"><label>Helper text</label><input class="question-help" value="${escapeHtml(field.help || "")}"></div><div class="field"><label>Placeholder</label><input class="question-placeholder" value="${escapeHtml(field.placeholder || "")}"></div></div>${needsOptions(field.type) ? `<div class="question-options">${(field.options || []).map((option, optionIndex) => `<div class="question-option"><input value="${escapeHtml(option)}" data-option-index="${optionIndex}"><button type="button" class="text-button remove-option" aria-label="Remove option">Remove</button></div>`).join("")}<button type="button" class="text-button add-option">Add option</button></div>` : ""}<div class="toolbar"><label><input type="checkbox" class="question-required"${field.required ? " checked" : ""}> Required</label><button type="button" class="text-button move-up"${index === 0 ? " disabled" : ""}>Move up</button><button type="button" class="text-button move-down"${index === fields.length - 1 ? " disabled" : ""}>Move down</button><button type="button" class="danger-button delete-question">Delete</button></div></article>`).join("") : empty("Start with a question", "Choose a question type from the right.");
};
const syncQuestions = () => {
  document.querySelectorAll("[data-field-id]").forEach((card) => {
    const field = fields.find((item) => item.id === card.dataset.fieldId);
    field.label = card.querySelector(".question-label").value.trim();
    field.help = card.querySelector(".question-help").value.trim();
    field.placeholder = card.querySelector(".question-placeholder").value.trim();
    field.required = card.querySelector(".question-required").checked;
    if (needsOptions(field.type)) field.options = [...card.querySelectorAll("[data-option-index]")].map((input) => input.value.trim()).filter(Boolean);
  });
};
const schema = () => ({ sections:[{ id:"main", title:"", fields }] });
const openNewForm = () => {
  currentFormId = null; fields = [];
  document.getElementById("formTitle").value = "";
  document.getElementById("formDescription").value = "";
  document.getElementById("formAccess").value = "public";
  renderQuestions(); Motion.openDialog(document.getElementById("formDialog"));
};
const editForm = async (formId) => {
  const result = await requestJson(`/api/admin/forms/${formId}`);
  currentFormId = formId;
  document.getElementById("formTitle").value = result.form.title;
  document.getElementById("formDescription").value = result.form.description;
  document.getElementById("formAccess").value = result.form.access;
  fields = result.revision?.schema?.sections?.flatMap((section) => section.fields || []) || [];
  renderQuestions(); Motion.openDialog(document.getElementById("formDialog"));
};
const saveForm = async () => {
  syncQuestions();
  if (!document.getElementById("formTitle").value.trim()) throw new Error("Form title is required.");
  if (fields.some((field) => !field.label)) throw new Error("Every question needs a label.");
  const data = { title:document.getElementById("formTitle").value, description:document.getElementById("formDescription").value, access:document.getElementById("formAccess").value, schema:schema() };
  const result = currentFormId ? await requestJson(`/api/admin/forms/${currentFormId}`, jsonOptions("PUT", data)) : await requestJson("/api/admin/forms", jsonOptions("POST", data));
  if (!currentFormId) currentFormId = result.form.id;
  document.getElementById("formBuilderMessage").textContent = "Draft saved.";
  return currentFormId;
};
document.addEventListener("click", async (event) => {
  if (event.target.matches("[data-close]")) Motion.closeDialog(document.getElementById(event.target.dataset.close));
  if (event.target.matches("[data-new-form]")) openNewForm();
  const add = event.target.closest("[data-field-type]");
  if (add) { syncQuestions(); fields.push({ id:uid(), type:add.dataset.fieldType, label:"Untitled question", help:"", placeholder:"", required:false, options:needsOptions(add.dataset.fieldType) ? ["Option 1"] : undefined }); renderQuestions(); }
  const card = event.target.closest("[data-field-id]");
  if (card) {
    const index = fields.findIndex((field) => field.id === card.dataset.fieldId);
    if (event.target.matches(".delete-question")) { syncQuestions(); fields.splice(index,1); renderQuestions(); }
    if (event.target.matches(".move-up") && index > 0) { syncQuestions(); [fields[index-1],fields[index]]=[fields[index],fields[index-1]]; renderQuestions(); }
    if (event.target.matches(".move-down") && index < fields.length-1) { syncQuestions(); [fields[index+1],fields[index]]=[fields[index],fields[index+1]]; renderQuestions(); }
    if (event.target.matches(".add-option")) { syncQuestions(); fields[index].options.push(`Option ${fields[index].options.length+1}`); renderQuestions(); }
    if (event.target.matches(".remove-option")) { syncQuestions(); fields[index].options.splice(Number(event.target.previousElementSibling.dataset.optionIndex),1); renderQuestions(); }
  }
  const edit = event.target.closest(".edit-form");
  if (edit) await editForm(edit.closest("[data-form-id]").dataset.formId);
  const roleSelect = event.target.closest(".role-select");
  if (roleSelect) {
    try { await requestJson(`/api/admin/users/${roleSelect.closest("[data-user-id]").dataset.userId}`, jsonOptions("PUT",{role:roleSelect.value})); message.textContent="Role updated."; } catch (error) { message.textContent=error.message; }
  }
  const statusSelect = event.target.closest(".status-select");
  if (statusSelect) {
    const previous = users.find((item) => item.id === statusSelect.closest("[data-user-id]").dataset.userId)?.status;
    try { await requestJson(`/api/admin/users/${statusSelect.closest("[data-user-id]").dataset.userId}`, jsonOptions("PUT",{status:statusSelect.value})); message.textContent="Account status updated."; } catch (error) { statusSelect.value=previous; message.textContent=error.message; }
  }
  const reset = event.target.closest(".reset-password");
  if (reset) { const password=prompt("Enter a new password with at least 8 characters:"); if (password) try { await requestJson(`/api/admin/users/${reset.closest("[data-user-id]").dataset.userId}/password`,jsonOptions("PUT",{password})); message.textContent="Password reset."; } catch(error){message.textContent=error.message;} }
  const projectStatus = event.target.closest(".project-status");
  if (projectStatus) { try { await requestJson(`/api/admin/projects/${projectStatus.closest("[data-project-id]").dataset.projectId}/status`, jsonOptions("PUT",{status:projectStatus.dataset.status})); await Motion.remove(projectStatus.closest(".row")); message.textContent="Project status updated."; } catch(error){message.textContent=error.message;} }
});
document.getElementById("memberSearch").oninput = renderUsers;
document.getElementById("roleFilter").onchange = renderUsers;
document.getElementById("newForm").onclick = openNewForm;
document.getElementById("newBroadcast").onclick = () => Motion.openDialog(document.getElementById("broadcastDialog"));
document.getElementById("saveFormDraft").onclick = () => saveForm().catch((error) => document.getElementById("formBuilderMessage").textContent=error.message);
document.getElementById("publishForm").onclick = async () => { try { const formId=await saveForm(); await requestJson(`/api/admin/forms/${formId}/publish`,jsonOptions("POST",{})); document.getElementById("formBuilderMessage").textContent="Form published."; } catch(error){document.getElementById("formBuilderMessage").textContent=error.message;} };
document.getElementById("audienceType").onchange = (event) => event.target.value === "role" ? Motion.show(document.getElementById("audienceRoleField")) : Motion.hide(document.getElementById("audienceRoleField"));
document.getElementById("broadcastForm").onsubmit = async (event) => { event.preventDefault(); const output=document.getElementById("broadcastMessage"); try { const result=await requestJson("/api/admin/broadcasts",jsonOptions("POST",Object.fromEntries(new FormData(event.target)))); output.textContent=`Sent to ${result.delivered} members.`; } catch(error){output.textContent=error.message;} };
document.getElementById("competitionActive").onchange = async (event) => { try { await requestJson("/api/site-status",jsonOptions("PUT",{competitionActive:event.target.checked})); message.textContent="Competition status updated."; } catch(error){event.target.checked=!event.target.checked;message.textContent=error.message;} };
const load = async () => {
  const user = await currentUser(); setAccount(user);
  const [overview,userData,contactData,status,formData,projects] = await Promise.all([requestJson("/api/admin/overview"),requestJson("/api/admin/users"),requestJson("/api/admin/contacts"),requestJson("/api/site-status"),requestJson("/api/admin/forms"),requestJson("/api/projects?status=submitted&limit=50")]);
  users=userData.users.results||[]; forms=formData.forms||[];
  document.getElementById("memberMetric").textContent=overview.counts.members;
  document.getElementById("projectMetric").textContent=overview.counts.pendingProjects;
  document.getElementById("formMetric").textContent=overview.counts.openForms;
  document.getElementById("competitionActive").checked=status.competitionActive;
  renderUsers(); renderContacts(contactData.contacts.results||[]); renderForms(); renderProjects(projects.projects||[]);
};
load().catch((error)=>{document.querySelector(".product-content").innerHTML=`<div class="notice error">${escapeHtml(error.message)}</div>`;});

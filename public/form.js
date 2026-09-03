const { requestJson, jsonOptions, escapeHtml } = window.NVNC;
const Motion = window.NVNCMotion;
const formKey = new URLSearchParams(location.search).get("form");
let form;
const inputFor = (field) => {
  const common = `id="${escapeHtml(field.id)}" name="${escapeHtml(field.id)}"${field.required ? " required" : ""}`;
  if (field.type === "paragraph") return `<textarea ${common} placeholder="${escapeHtml(field.placeholder || "")}"></textarea>`;
  if (["single-choice","checkboxes"].includes(field.type)) return `<div class="stack">${(field.options || []).map((option) => `<label><input type="${field.type === "checkboxes" ? "checkbox" : "radio"}" ${common} value="${escapeHtml(option)}"> ${escapeHtml(option)}</label>`).join("")}</div>`;
  if (field.type === "dropdown") return `<select ${common}><option value="">Choose an option</option>${(field.options || []).map((option)=>`<option>${escapeHtml(option)}</option>`).join("")}</select>`;
  if (field.type === "consent") return `<label><input type="checkbox" ${common}> I agree</label>`;
  if (field.type === "linear-scale") return `<input type="range" min="1" max="10" value="5" ${common}>`;
  const type = ({ email:"email", number:"number", date:"date", time:"time", url:"url" })[field.type] || "text";
  return `<input type="${type}" ${common} placeholder="${escapeHtml(field.placeholder || "")}">`;
};
const load = async () => {
  if (!formKey) throw new Error("No form selected.");
  const result = await requestJson(`/api/forms/${encodeURIComponent(formKey)}`); form=result.form;
  document.title=`${form.title} / No Vibe No Code`; document.getElementById("formHeading").textContent=form.title; document.getElementById("formDescription").textContent=form.description;
  const fields=(form.schema.sections||[]).flatMap((section)=>section.fields||[]);
  document.getElementById("dynamicForm").innerHTML=fields.map((field)=>`<div class="field"><label for="${escapeHtml(field.id)}">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>${inputFor(field)}${field.help ? `<small>${escapeHtml(field.help)}</small>` : ""}<span class="field-error"></span></div>`).join("")+'<p class="status-message" id="responseMessage"></p><div class="form-actions"><button class="primary-button">Submit response</button></div>';
  Motion.reveal(document.querySelectorAll("#dynamicForm > .field"));
};
document.getElementById("dynamicForm").onsubmit=async(event)=>{event.preventDefault();const data=new FormData(event.target);const answers={};for(const [key,value] of data){if(answers[key]!==undefined)answers[key]=Array.isArray(answers[key])?[...answers[key],value]:[answers[key],value];else answers[key]=value;}try{await requestJson(`/api/forms/${encodeURIComponent(form.id)}/responses`,jsonOptions("POST",{answers}));event.target.innerHTML='<div class="empty-state"><h3>Response submitted</h3><p>Your response has been saved.</p><a class="primary-button" href="/home.html">Member home</a></div>';Motion.revealWithin(event.target);}catch(error){document.getElementById("responseMessage").textContent=error.message;}};
load().catch((error)=>{document.getElementById("dynamicForm").innerHTML=`<div class="notice error">${escapeHtml(error.message)}</div>`;});

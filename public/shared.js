const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[character]);
const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
};
const jsonOptions = (method, data) => ({
  method,
  headers: { "content-type":"application/json" },
  body: JSON.stringify(data),
});
const markdown = (source) => {
  const safe = escapeHtml(source || "");
  return safe
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>");
};
const currentUser = () => requestJson("/api/me").then(({ user }) => {
  if (!user) location.href = "/#account";
  return user;
});
const setAccount = (user) => {
  document.querySelectorAll("[data-account-name]").forEach((element) => {
    element.textContent = user.display_name;
  });
};
const loadUnreadCount = async () => {
  try {
    const result = await requestJson("/api/notifications/unread-count");
    document.querySelectorAll("[data-notification-count]").forEach((element) => {
      element.textContent = result.count || "";
      element.classList.toggle("hidden", !result.count);
    });
  } catch {}
};
window.NVNC = { escapeHtml, requestJson, jsonOptions, markdown, currentUser, setAccount, loadUnreadCount };

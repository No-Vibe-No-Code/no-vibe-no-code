const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[character]);
document.querySelectorAll('img[src="/logo-symbol.webp"],link[href="/logo-symbol-icon.png"]').forEach((element) => {
  const attribute = element.tagName === "LINK" ? "href" : "src";
  element.setAttribute(attribute, `${element.getAttribute(attribute)}?v=20260913-sky`);
});
const MASCOT_VERSION = "20260914-mascots-v1";
const mascotVariants = Object.freeze({
  "chibi-laptop": { alt: "Nachoneko building with a laptop", placement: "corner" },
  "chibi-thinking": { alt: "Thoughtful Nachoneko", placement: "corner" },
  "chibi-sleepy": { alt: "Sleepy Nachoneko", placement: "corner" },
  "chibi-celebrate": { alt: "Celebrating Nachoneko", placement: "corner" },
  code: { alt: "Nachoneko coding", placement: "corner" },
  game: { alt: "Nachoneko playing a game", placement: "corner" },
  heart: { alt: "Nachoneko holding a heart", placement: "corner" },
  coffee: { alt: "Sleepy Nachoneko with coffee", placement: "corner" },
  sketch: { alt: "Nachoneko sketching an idea", placement: "corner" },
  read: { alt: "Nachoneko reading", placement: "corner" },
  "point-down": { alt: "Nachoneko pointing down", placement: "corner" },
  "footer-sit": { alt: "Nachoneko waving", placement: "corner" },
  sticker: { alt: "Nachoneko sticker", placement: "corner" },
  pixel: { alt: "Pixel-art Nachoneko with a laptop", placement: "corner" },
  "paper-cut": { alt: "Paper-cut Nachoneko", placement: "corner" },
  ink: { alt: "Ink-drawn Nachoneko", placement: "corner" },
  night: { alt: "Nachoneko resting in night mode", placement: "corner" },
  plush: { alt: "Nachoneko plush mascot", placement: "corner" },
  happy: { alt: "Happy Nachoneko", placement: "corner" },
  surprised: { alt: "Surprised Nachoneko", placement: "corner" },
  yawn: { alt: "Yawning Nachoneko", placement: "corner" },
  shrug: { alt: "Nachoneko shrugging", placement: "corner" },
  "thumbs-up": { alt: "Nachoneko giving a thumbs up", placement: "corner" },
  loading: { alt: "Nachoneko waiting beside loading dots", placement: "corner" },
  wave: { alt: "Nachoneko waving", placement: "corner" },
  "peek-left": { alt: "Nachoneko peeking from the left edge", placement: "edge-left" },
  "peek-right": { alt: "Nachoneko peeking from the right edge", placement: "edge-right" },
});
const mascotPath = (variant) => `/mascots/nachoneko-${variant}.png?v=${MASCOT_VERSION}`;
const currentPath = location.pathname.toLowerCase().replace(/\/+$/, "") || "/";
const routeMascot = currentPath.startsWith("/user/") || ["/profile", "/profile.html"].includes(currentPath)
  ? "peek-left"
  : ({
      "/home": "chibi-laptop",
      "/home.html": "chibi-laptop",
      "/members": "peek-right",
      "/members.html": "peek-right",
      "/gallery": "sticker",
      "/gallery.html": "sticker",
      "/project": "code",
      "/project.html": "code",
      "/form": "happy",
      "/form.html": "happy",
      "/admin": "paper-cut",
      "/admin.html": "paper-cut",
    }[currentPath] || "footer-sit");
const selectedMascot = mascotVariants[routeMascot] || mascotVariants["footer-sit"];
if (!document.body.dataset.noSiteMascot) {
  const mascotBadge = document.createElement("aside");
  mascotBadge.className = `site-mascot-badge site-mascot-badge--${selectedMascot.placement}`;
  mascotBadge.dataset.mascotVariant = routeMascot;
  mascotBadge.setAttribute("aria-label", "Nachoneko mascot");
  mascotBadge.innerHTML = `<img src="${mascotPath(routeMascot)}" loading="lazy" decoding="async" alt="${selectedMascot.alt}">`;
  document.body.append(mascotBadge);
}
const emptyMascotSlots = Object.freeze({
  projectList: "sketch",
  teamList: "chibi-thinking",
  invitationList: "heart",
  notificationList: "night",
  members: "wave",
  gallery: "pixel",
  profileProjects: "game",
});
const decorateEmptyStates = () => {
  Object.entries(emptyMascotSlots).forEach(([containerId, variant]) => {
    const emptyState = document.getElementById(containerId)?.querySelector(".empty-state");
    if (!emptyState || emptyState.querySelector(".empty-mascot")) return;
    const image = document.createElement("img");
    image.className = "empty-mascot";
    image.src = mascotPath(variant);
    image.alt = mascotVariants[variant]?.alt || "Nachoneko mascot";
    image.loading = "lazy";
    image.decoding = "async";
    emptyState.prepend(image);
  });
};
decorateEmptyStates();
new MutationObserver(decorateEmptyStates).observe(document.body, { childList: true, subtree: true });
const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
};
const csrfToken = () => { const existing = document.cookie.match(/(?:^|;\s*)nvnc_csrf=([^;]+)/)?.[1]; if (existing) return existing; const token = crypto.randomUUID(); document.cookie = `nvnc_csrf=${token}; SameSite=Lax; Path=/; Max-Age=86400${location.protocol === "https:" ? "; Secure" : ""}`; return token; };
const jsonOptions = (method, data) => ({
  method,
  headers: { "content-type":"application/json", "x-csrf-token":csrfToken() },
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
window.NVNC = { escapeHtml, requestJson, jsonOptions, markdown, currentUser, setAccount, loadUnreadCount, mascotVariants, mascotPath };

const { requestJson, jsonOptions, escapeHtml } = window.NVNC;
const params = new URLSearchParams(location.search);
const token = params.get("token") || (location.pathname.startsWith("/nfc/") ? location.pathname.slice(5) : "");
const returnTo = `${location.pathname}${location.search}`;
const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
const loginUrl = `/?account=login&returnTo=${encodeURIComponent(safeReturnTo)}`;
const signupUrl = `/?account=signup&returnTo=${encodeURIComponent(safeReturnTo)}`;
const heading = document.getElementById("nfcHeading");
const message = document.getElementById("nfcMessage");
const actions = document.getElementById("nfcActions");
const status = document.getElementById("nfcStatus");
const button = (label, href, className = "primary-button") => `<a class="${className}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;

const showError = (text) => {
  heading.textContent = "Card unavailable";
  message.textContent = text;
  actions.innerHTML = button("Return to club site", "/", "secondary-button");
};

const claim = async (user, card) => {
  actions.innerHTML = '<button class="primary-button" id="claimButton" type="button">Bind to my profile</button>';
  const claimButton = document.getElementById("claimButton");
  claimButton.onclick = async () => {
    claimButton.disabled = true;
    status.textContent = "Binding this card…";
    try {
      const result = await requestJson(`/api/nfc/cards/${encodeURIComponent(token)}/claim`, jsonOptions("POST", {}));
      status.textContent = "Card bound. Opening your profile…";
      location.replace(result.profileUrl);
    } catch (error) {
      claimButton.disabled = false;
      status.textContent = error.message;
      if (error.message.toLowerCase().includes("already")) window.setTimeout(() => location.reload(), 1200);
    }
  };
};

const load = async () => {
  if (!token || !/^[A-Za-z0-9_-]{12,160}$/.test(token)) return showError("This NFC link is not valid.");
  const [card, me] = await Promise.all([
    requestJson(`/api/nfc/cards/${encodeURIComponent(token)}`),
    requestJson("/api/me").catch(() => ({ user: null })),
  ]);
  if (card.status === "disabled") return showError("This card has been disabled. Please ask a club leader for help.");
  if (card.status === "claimed") return location.replace(card.profileUrl);
  heading.textContent = "Claim your profile card";
  message.textContent = `This card is ready${card.label ? ` · ${card.label}` : ""}. Bind it once and future scans will open your public profile.`;
  if (me.user) return claim(me.user, card);
  actions.innerHTML = `${button("Sign in to bind", loginUrl)}${button("Create an account", signupUrl, "secondary-button")}`;
};

load().catch((error) => showError(error.message || "Could not read this NFC card."));

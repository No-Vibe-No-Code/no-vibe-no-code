const { requestJson, jsonOptions } = window.NVNC;

const deviceFingerprint = () => {
  const timezone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })();
  const screenShape = `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.devicePixelRatio || 1}`;
  return [navigator.userAgent, navigator.language, navigator.platform, timezone, screenShape, navigator.hardwareConcurrency || 0, navigator.maxTouchPoints || 0].join("|").slice(0, 1200);
};

const status = document.getElementById("voteStatus");
const total = document.getElementById("voteTotal");
const summary = document.getElementById("voteSummary");
const buttons = [...document.querySelectorAll("[data-vote]")];

const render = (result) => {
  const allVotes = Number(result.total) || 0;
  total.textContent = allVotes;
  summary.textContent = result.hasVoted ? "Your vote is recorded." : "Cast one vote for your favorite.";
  const maxVotes = Math.max(1, ...result.variants.map((variant) => Number(variant.votes) || 0));
  result.variants.forEach((variant) => {
    const card = document.querySelector(`[data-variant="${variant.slug}"]`);
    if (!card) return;
    card.querySelector("[data-votes]").textContent = Number(variant.votes) || 0;
    card.querySelector("[data-bar]").style.width = `${Math.round(((Number(variant.votes) || 0) / maxVotes) * 100)}%`;
    const button = card.querySelector("[data-vote]");
    button.disabled = Boolean(result.hasVoted);
    button.textContent = result.hasVoted && result.votedVariant === variant.slug ? "Your vote" : result.hasVoted ? "Vote recorded" : "Vote for this card";
    card.classList.toggle("is-voted", result.hasVoted && result.votedVariant === variant.slug);
  });
};

const load = async () => {
  const result = await requestJson("/api/vote/results", { headers: { "x-device-fingerprint": deviceFingerprint() } });
  render(result);
};

buttons.forEach((button) => {
  button.addEventListener("click", async () => {
    buttons.forEach((item) => { item.disabled = true; });
    status.textContent = "Recording your vote…";
    try {
      await requestJson("/api/vote", jsonOptions("POST", { variant: button.dataset.vote, deviceFingerprint: deviceFingerprint() }));
      status.textContent = "Vote recorded. Thanks for helping choose the card.";
      await load();
    } catch (error) {
      status.textContent = error.message || "Could not record the vote.";
      await load().catch(() => buttons.forEach((item) => { item.disabled = false; }));
    }
  });
});

load().catch((error) => {
  total.textContent = "—";
  summary.textContent = error.message || "Votes are temporarily unavailable.";
  status.textContent = "Please refresh and try again.";
});

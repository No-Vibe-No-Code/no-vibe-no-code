const { requestJson, jsonOptions, escapeHtml } = window.NVNC;

const variants = [
  { slug: "skyline-ribbon", name: "Skyline Ribbon", kicker: "01 · SIGNAL + FLOW", description: "A crisp diagonal sweep with a bright, welcoming club signal.", palette: "Powder blue · sky blue · royal blue", front: "/card-variants/skyline-ribbon-front.png", back: "/card-variants/skyline-ribbon-back.png" },
  { slug: "blueberry-window", name: "Blueberry Window", kicker: "02 · SOFT + FRIENDLY", description: "A soft cloud window that lets the mascot peek into your next idea.", palette: "Icy blue · cobalt · white", front: "/card-variants/blueberry-window-front.png", back: "/card-variants/blueberry-window-back.png" },
  { slug: "blueprint-paws", name: "Blueprint Paws", kicker: "03 · TECHNICAL + PLAYFUL", description: "A technical sketchbook look for people who like to see how things work.", palette: "Blueprint blue · white · soft blue", front: "/card-variants/blueprint-paws-front.png", back: "/card-variants/blueprint-paws-back.png" },
  { slug: "cloud-cat", name: "Cloud Cat", kicker: "04 · AIRY + CALM", description: "An airy, gentle card that feels like a tiny piece of the club sky.", palette: "Baby blue · sky blue · deep blue", front: "/card-variants/cloud-cat-front.png", back: "/card-variants/cloud-cat-back.png" },
  { slug: "after-school-club", name: "After-School Club", kicker: "05 · DOODLE + CLUB", description: "Notebook doodles, laptop energy, and a little more personality.", palette: "White · light blue · royal blue", front: "/card-variants/after-school-club-front.png", back: "/card-variants/after-school-club-back.png" },
];

const voteContent = document.querySelector(".vote-content");
const workspace = document.getElementById("ratingWorkspace");
const completion = document.getElementById("completionView");
const card = document.getElementById("flipCard");
const flipCue = document.getElementById("flipCue");
const ratingChoices = [...document.querySelectorAll("[data-rating]")];
const nextButton = document.getElementById("nextRating");
const status = document.getElementById("voteStatus");
const cardIndex = document.getElementById("cardIndex");
const cardKicker = document.getElementById("cardKicker");
const cardTitle = document.getElementById("cardTitle");
const cardDescription = document.getElementById("cardDescription");
const cardPalette = document.getElementById("cardPalette");
const cardFrontImage = document.getElementById("cardFrontImage");
const cardBackImage = document.getElementById("cardBackImage");
const ratingHint = document.getElementById("ratingHint");
const voteStep = document.getElementById("voteStep");
const progressText = document.getElementById("voteProgressText");
const progressBar = document.getElementById("voteProgressBar");
const resultGrid = document.getElementById("resultGrid");
const totalVoters = document.getElementById("totalVoters");
const ratings = new Map();
let currentIndex = 0;
let selectedRating = null;

const deviceFingerprint = () => {
  const timezone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })();
  const screenShape = `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.devicePixelRatio || 1}`;
  return [navigator.userAgent, navigator.language, navigator.platform, timezone, screenShape, navigator.hardwareConcurrency || 0, navigator.maxTouchPoints || 0].join("|").slice(0, 1200);
};

const renderProgress = () => {
  const count = ratings.size;
  progressText.textContent = `${count} / ${variants.length} rated`;
  progressBar.style.width = `${Math.round((count / variants.length) * 100)}%`;
  voteStep.textContent = count === variants.length ? "ALL FIVE RATED" : `CONCEPT ${currentIndex + 1} OF ${variants.length}`;
};

const setFlipCue = (flipped) => {
  const name = variants[currentIndex].name;
  card.setAttribute("aria-label", `${flipped ? "Show the front" : "Show the back"} of ${name} card`);
  flipCue.innerHTML = `${flipped ? "Tap the card to see the front" : "Tap the card to see the back"} <span aria-hidden="true">↻</span>`;
};

const flipCard = () => {
  const flipped = card.classList.toggle("is-flipped");
  setFlipCue(flipped);
};

const showCard = (index) => {
  currentIndex = index;
  selectedRating = ratings.has(variants[index].slug) ? ratings.get(variants[index].slug) : null;
  const variant = variants[index];
  card.classList.remove("is-flipped");
  cardFrontImage.src = variant.front;
  cardBackImage.src = variant.back;
  cardIndex.textContent = variant.kicker;
  cardKicker.textContent = variant.kicker;
  cardTitle.textContent = variant.name;
  cardDescription.textContent = variant.description;
  cardPalette.textContent = variant.palette;
  setFlipCue(false);
  ratingChoices.forEach((choice) => {
    const selected = Number(choice.dataset.rating) === selectedRating;
    choice.setAttribute("aria-checked", String(selected));
    choice.disabled = false;
  });
  nextButton.disabled = selectedRating === null;
  ratingHint.textContent = selectedRating === null ? "Choose 0–5 stars to continue." : `${selectedRating} star${selectedRating === 1 ? "" : "s"} selected.`;
  ratingHint.classList.remove("rating-hint--selected");
  workspace.classList.remove("is-changing");
  void workspace.offsetWidth;
  workspace.classList.add("is-changing");
  renderProgress();
};

const showCompletion = (result) => {
  workspace.classList.add("hidden");
  completion.classList.remove("hidden");
  voteContent.classList.add("is-complete");
  voteStep.textContent = "ALL FIVE RATED";
  progressText.textContent = `${variants.length} / ${variants.length} rated`;
  progressBar.style.width = "100%";
  const resultMap = new Map((result.variants || []).map((variant) => [variant.slug, variant]));
  resultGrid.innerHTML = variants.map((variant, index) => {
    const item = resultMap.get(variant.slug) || {};
    const average = Number.isFinite(Number(item.averageRating)) ? Number(item.averageRating).toFixed(1) : "—";
    const count = Number(item.ratingCount) || 0;
    return `<div class="result-item" style="--result-index:${index}"><strong>${escapeHtml(variant.name)}</strong><span class="result-average">${average}<small>/5</small></span><small>${count} ratings · average</small></div>`;
  }).join("");
  totalVoters.textContent = Number(result.totalVoters) || 0;
};

const load = async () => {
  const result = await requestJson("/api/vote/results", { headers: { "x-device-fingerprint": deviceFingerprint() } });
  ratings.clear();
  (result.ratings || []).forEach((item) => ratings.set(item.variant, Number(item.rating)));
  if (result.completed || ratings.size === variants.length) return showCompletion(result);
  const nextIndex = variants.findIndex((variant) => !ratings.has(variant.slug));
  showCard(nextIndex < 0 ? 0 : nextIndex);
  return result;
};

ratingChoices.forEach((choice) => {
  choice.addEventListener("click", () => {
    selectedRating = Number(choice.dataset.rating);
    ratingChoices.forEach((item) => item.setAttribute("aria-checked", String(item === choice)));
    nextButton.disabled = false;
    ratingHint.textContent = `${selectedRating} star${selectedRating === 1 ? "" : "s"} selected.`;
    ratingHint.classList.add("rating-hint--selected");
  });
});

card.addEventListener("click", flipCard);
flipCue.addEventListener("click", flipCard);

nextButton.addEventListener("click", async () => {
  if (selectedRating === null) return;
  nextButton.disabled = true;
  ratingChoices.forEach((choice) => { choice.disabled = true; });
  status.textContent = "Saving this rating…";
  try {
    await requestJson("/api/vote", jsonOptions("POST", { variant: variants[currentIndex].slug, rating: selectedRating, deviceFingerprint: deviceFingerprint() }));
    status.textContent = ratings.size + 1 === variants.length ? "All ratings saved. Preparing the results…" : "Rating saved. Next card…";
    await load();
    if (!completion.classList.contains("hidden")) status.textContent = "Your ratings are in. Thanks for helping choose the card.";
  } catch (error) {
    status.textContent = error.message || "Could not save this rating.";
    ratingChoices.forEach((choice) => { choice.disabled = false; });
    await load().catch(() => { nextButton.disabled = false; });
  }
});

load().catch((error) => {
  status.textContent = error.message || "Ratings are temporarily unavailable.";
  nextButton.disabled = true;
});

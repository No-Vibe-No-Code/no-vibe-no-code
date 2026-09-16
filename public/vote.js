const { requestJson } = window.NVNC;
const card = document.getElementById("flipCard");
const cue = document.getElementById("flipCue");

const flipCard = () => {
  const flipped = card.classList.toggle("is-flipped");
  card.setAttribute("aria-label", `Show the ${flipped ? "front" : "back"} of Cloud Cat card`);
  cue.innerHTML = `${flipped ? "Tap to see the front" : "Tap to see the back"} <span aria-hidden="true">↻</span>`;
};
card.addEventListener("click", flipCard);
cue.addEventListener("click", flipCard);

requestJson("/api/vote/results").then((result) => {
  const winner = result.variants?.find((variant) => variant.slug === result.winner);
  if (!result.closed || !winner) throw new Error("Final results are unavailable right now.");
  document.getElementById("winnerAverage").textContent = winner.averageRating === null ? "—" : Number(winner.averageRating).toFixed(2);
  document.getElementById("totalVoters").textContent = Number(result.totalVoters) || 0;
  document.getElementById("voteSummary").textContent = `${winner.ratingCount} ratings for Cloud Cat · voting is now closed.`;
}).catch((error) => {
  document.getElementById("voteSummary").textContent = "Cloud Cat is the selected design. Final rating totals are temporarily unavailable.";
  document.getElementById("voteStatus").textContent = error.message;
});

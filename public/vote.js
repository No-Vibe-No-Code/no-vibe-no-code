const { requestJson } = window.NVNC;
const card = document.getElementById("flipCard");
const cue = document.getElementById("flipCue");
const inner = card.querySelector('.flip-card-inner');
const cueMark = cue.querySelector('span');
const Motion = window.NVNCMotion;
const flipState = { angle: 0 };
let flipAnimation;
let cueAnimation;

const flipCard = () => {
  const flipped = card.classList.toggle("is-flipped");
  card.setAttribute("aria-label", `Show the ${flipped ? "front" : "back"} of Cloud Cat card`);
  cue.firstChild.textContent = flipped ? 'Tap to see the front ' : 'Tap to see the back ';
  const destination = flipped ? 180 : 0;
  flipAnimation?.cancel();
  cueAnimation?.cancel();
  if (Motion.isReduced()) {
    flipState.angle = destination;
    inner.style.transform = `rotateY(${destination}deg)`;
    cueMark.style.transform = `rotate(${destination}deg)`;
    return;
  }
  flipAnimation = Motion.animate(flipState, {
    angle: destination,
    duration: 680,
    ease: 'inOut(3)',
    onUpdate: () => { inner.style.transform = `rotateY(${flipState.angle}deg)`; },
  });
  cueAnimation = Motion.animate(cueMark, { rotate: destination, duration: 440, ease: 'out(4)' });
};
card.addEventListener("click", flipCard);
cue.addEventListener("click", flipCard);
window.addEventListener('pagehide', () => { flipAnimation?.cancel(); cueAnimation?.cancel(); }, { once: true });

requestJson("/api/vote/results").then((result) => {
  const winner = result.variants?.find((variant) => variant.slug === result.winner);
  if (!result.closed || !winner) throw new Error("Final results are unavailable right now.");
  document.getElementById("winnerAverage").textContent = winner.averageRating === null ? "—" : Number(winner.averageRating).toFixed(2);
  document.getElementById("totalVoters").textContent = Number(result.totalVoters) || 0;
  const ratingCount = Number(winner.ratingCount) || 0;
  document.getElementById("voteSummary").textContent = `${ratingCount} rating${ratingCount === 1 ? "" : "s"} for Cloud Cat · voting is now closed.`;
}).catch((error) => {
  document.getElementById("voteSummary").textContent = "Cloud Cat is the selected design. Final rating totals are temporarily unavailable.";
  document.getElementById("voteStatus").textContent = error.message;
});

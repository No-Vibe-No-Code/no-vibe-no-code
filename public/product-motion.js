const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const animated = new WeakSet();
const running = new WeakMap();
const revealSelector = [
  "[data-motion]",
  ".page-heading",
  ".metric",
  ".panel",
  ".profile-card",
  ".project-card",
  ".question-card",
  ".empty-state",
  ".notice",
].join(",");

const cancel = (element) => {
  running.get(element)?.cancel();
  running.delete(element);
};

const play = (element, keyframes, options = {}) => {
  cancel(element);
  if (reducedMotion.matches || !element.animate) return Promise.resolve();
  const timing = {
    duration: 380,
    easing: "cubic-bezier(.16,1,.3,1)",
    fill: "both",
    ...options,
  };
  const animation = element.animate(keyframes, timing);
  running.set(element, animation);
  let timer;
  const completion = new Promise((resolve) => {
    timer = window.setTimeout(resolve, Number(timing.duration) + Number(timing.delay || 0) + 100);
    animation.finished.then(resolve, resolve);
  });
  return completion.finally(() => {
    window.clearTimeout(timer);
    if (running.get(element) !== animation) return;
    running.delete(element);
    animation.cancel();
    element.style.opacity = "";
    element.style.transform = "";
  });
};

const entranceFrames = (element) => {
  const direction = element.dataset.motionDirection;
  const x = direction === "left" ? -18 : direction === "right" ? 18 : 0;
  const y = direction ? 0 : element.matches(".page-heading") ? 22 : 14;
  return [
    { opacity: 0, transform: `translate3d(${x}px,${y}px,0)` },
    { opacity: 1, transform: "translate3d(0,0,0)" },
  ];
};

const reveal = (elements) => {
  const candidates = Array.from(elements).filter((element) => element instanceof HTMLElement && !animated.has(element));
  candidates.slice(12).forEach((element) => animated.add(element));
  candidates.slice(0, 12).forEach((element, index) => {
    animated.add(element);
    play(element, entranceFrames(element), {
      duration: element.matches(".page-heading") ? 500 : 420,
      delay: Math.min(index, 8) * 45,
    });
  });
};

let observer;
if (!reducedMotion.matches && "IntersectionObserver" in window) {
  observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
    visible.forEach((element) => observer.unobserve(element));
    reveal(visible);
  }, { rootMargin: "0px 0px 80px", threshold: 0.06 });
}

const revealWithin = (root = document) => {
  const elements = [];
  if (root instanceof HTMLElement && root.matches(revealSelector)) elements.push(root);
  elements.push(...root.querySelectorAll(revealSelector));
  if (!observer || reducedMotion.matches) {
    elements.forEach((element) => animated.add(element));
    return;
  }
  elements.filter((element) => !animated.has(element)).forEach((element) => {
    const firstFrame = entranceFrames(element)[0];
    element.style.opacity = firstFrame.opacity;
    element.style.transform = firstFrame.transform;
    observer.observe(element);
  });
};

const show = async (element) => {
  if (!element) return;
  cancel(element);
  observer?.unobserve(element);
  animated.add(element);
  element.classList.remove("hidden");
  element.removeAttribute("hidden");
  await play(element, [
    { opacity: 0, transform: "translate3d(0,10px,0)" },
    { opacity: 1, transform: "translate3d(0,0,0)" },
  ], { duration: 300 });
};

const hide = async (element) => {
  if (!element || element.classList.contains("hidden")) return;
  await play(element, [
    { opacity: 1, transform: "translate3d(0,0,0)" },
    { opacity: 0, transform: "translate3d(0,-8px,0)" },
  ], { duration: 180, easing: "cubic-bezier(.4,0,1,1)" });
  element.classList.add("hidden");
};

const toggle = (element) => element?.classList.contains("hidden") ? show(element) : hide(element);

const openDialog = async (dialog) => {
  if (!dialog?.open) dialog?.showModal();
  if (!dialog) return;
  await play(dialog, [
    { opacity: 0, transform: "translate3d(0,12px,0) scale(.98)" },
    { opacity: 1, transform: "translate3d(0,0,0) scale(1)" },
  ], { duration: 320 });
};

const closeDialog = async (dialog) => {
  if (!dialog?.open) return;
  await play(dialog, [
    { opacity: 1, transform: "translate3d(0,0,0) scale(1)" },
    { opacity: 0, transform: "translate3d(0,8px,0) scale(.985)" },
  ], { duration: 160, easing: "cubic-bezier(.4,0,1,1)" });
  dialog.close();
};

const remove = async (element) => {
  if (!element) return;
  await play(element, [
    { opacity: 1, transform: "translate3d(0,0,0)" },
    { opacity: 0, transform: "translate3d(14px,0,0)" },
  ], { duration: 180, easing: "cubic-bezier(.4,0,1,1)" });
  element.remove();
};

const swap = async (outgoing, incoming) => {
  if (!outgoing || !incoming || outgoing === incoming) return;
  await hide(outgoing);
  await show(incoming);
};

const mutationObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
    if (node instanceof HTMLElement) revealWithin(node);
  }));
});

document.addEventListener("DOMContentLoaded", () => {
  revealWithin();
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}, { once: true });

window.addEventListener("pagehide", () => {
  observer?.disconnect();
  mutationObserver.disconnect();
}, { once: true });

window.NVNCMotion = { reveal, revealWithin, show, hide, toggle, openDialog, closeDialog, remove, swap };

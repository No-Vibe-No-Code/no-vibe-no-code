import { animate, stagger } from 'animejs';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const animated = new WeakSet();
const running = new WeakMap();
const revealSelector = [
  '[data-motion]', '.page-heading', '.metric', '.panel', '.profile-card',
  '.project-card', '.question-card', '.empty-state', '.notice',
  '.ws-item', '.ws-notice-detail', '.ws-home-panel',
  '.aw-heading', '.aw-metric', '.aw-card', '.aw-row',
].join(',');

const isReduced = () => reducedMotion.matches;

function cancel(element) {
  const previous = running.get(element);
  if (!previous) return;
  previous.animation.cancel();
  previous.resolve(false);
  running.delete(element);
  element.style.willChange = '';
}

// A superseded transition resolves false so stale exits cannot hide current content.
function run(element, properties, options = {}) {
  if (!element) return Promise.resolve(false);
  cancel(element);
  if (isReduced()) {
    element.style.transform = '';
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    element.style.willChange = 'transform';
    let instance;
    const finish = () => {
      if (running.get(element)?.animation !== instance) return;
      running.delete(element);
      element.style.willChange = '';
      if (options.clear !== false) element.style.transform = '';
      resolve(true);
    };
    instance = animate(element, {
      ...properties,
      duration: options.duration ?? 300,
      ease: options.ease ?? 'out(4)',
      delay: options.delay ?? 0,
      onComplete: finish,
    });
    running.set(element, { animation: instance, resolve });
  });
}

function entrance(element) {
  const direction = element.dataset.motionDirection;
  const x = direction === 'left' ? -16 : direction === 'right' ? 16 : 0;
  const y = direction ? 0 : element.matches('.page-heading, .aw-heading') ? 18 : 10;
  return { x: [x, 0], y: [y, 0] };
}

function reveal(elements) {
  const candidates = Array.from(elements).filter((element) =>
    element instanceof HTMLElement && !animated.has(element) && element.getClientRects().length);
  candidates.forEach((element, index) => {
    animated.add(element);
    element.style.transform = '';
    if (isReduced() || index >= 10) return;
    run(element, entrance(element), {
      duration: element.matches('.page-heading, .aw-heading') ? 440 : 320,
      delay: Math.min(index, 6) * 35,
    });
  });
}

let observer;
if ('IntersectionObserver' in window) {
  observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
    visible.forEach((element) => observer.unobserve(element));
    reveal(visible);
  }, { rootMargin: '0px 0px 60px', threshold: 0.06 });
}

function revealWithin(root = document) {
  const elements = [];
  if (root instanceof HTMLElement && root.matches(revealSelector)) elements.push(root);
  elements.push(...root.querySelectorAll(revealSelector));
  elements.filter((element) => !animated.has(element)).forEach((element) => {
    if (!element.getClientRects().length) return;
    if (!observer || isReduced()) {
      animated.add(element);
      return;
    }
    observer.observe(element);
  });
}

async function show(element) {
  if (!element) return false;
  observer?.unobserve(element);
  animated.add(element);
  element.classList.remove('hidden');
  element.removeAttribute('hidden');
  return run(element, { y: [10, 0], scale: [.985, 1] }, { duration: 280 });
}

async function hide(element) {
  if (!element || element.classList.contains('hidden')) return false;
  const completed = await run(element, { y: [0, -8], scale: [1, .985] }, { duration: 180, ease: 'in(3)' });
  if (completed) element.classList.add('hidden');
  return completed;
}

const toggle = (element) => element?.classList.contains('hidden') ? show(element) : hide(element);

async function openDialog(dialog) {
  if (!dialog) return false;
  if (!dialog.open) dialog.showModal();
  const fromLeft = dialog.dataset.motionDirection === 'left';
  return run(dialog, fromLeft ? { x: [-24, 0] } : { y: [18, 0], scale: [.98, 1] }, { duration: 320 });
}

async function closeDialog(dialog) {
  if (!dialog?.open) return false;
  const toLeft = dialog.dataset.motionDirection === 'left';
  const completed = await run(dialog, toLeft ? { x: [0, -24] } : { y: [0, 10], scale: [1, .985] }, { duration: 180, ease: 'in(3)' });
  if (completed && dialog.open) dialog.close();
  return completed;
}

async function remove(element) {
  if (!element) return false;
  const completed = await run(element, { x: [0, 14] }, { duration: 180, ease: 'in(3)' });
  if (completed) element.remove();
  return completed;
}

async function swap(outgoing, incoming) {
  if (!outgoing || !incoming || outgoing === incoming) return;
  await hide(outgoing);
  await show(incoming);
}

const mutationObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
    if (node instanceof HTMLElement) revealWithin(node);
  }));
});

document.addEventListener('DOMContentLoaded', () => {
  revealWithin();
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}, { once: true });

reducedMotion.addEventListener('change', () => {
  if (!isReduced()) return;
  document.querySelectorAll(revealSelector).forEach((element) => {
    cancel(element);
    element.style.transform = '';
  });
});

window.addEventListener('pagehide', () => {
  observer?.disconnect();
  mutationObserver.disconnect();
}, { once: true });

window.NVNCMotion = { isReduced, animate, stagger, run, reveal, revealWithin, show, hide, toggle, openDialog, closeDialog, remove, swap, cancel };

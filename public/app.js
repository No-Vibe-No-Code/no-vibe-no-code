const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const animeEngine = window.anime;
const startupLoader = document.getElementById("startupLoader");
const startupStartedAt = performance.now();
const introHooks = [];
const onIntro = (hook) => introHooks.push(hook);
let introStarted = false;
const runIntro = () => {
  if (introStarted) return;
  introStarted = true;
  introHooks.forEach((hook) => {
    try { hook(); } catch (error) { console.error(error); }
  });
};
let onLanguageChange = () => {};
const finishStartup = () => {
  const remaining = Math.max(0, 500 - (performance.now() - startupStartedAt));
  window.setTimeout(() => {
    runIntro();
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");
    if (!startupLoader) return;
    startupLoader.classList.add("is-exiting");
    startupLoader.addEventListener("animationend", () => startupLoader.remove(), { once: true });
  }, remaining);
};
if (reduceMotion) {
  finishStartup();
} else if (document.readyState === "complete") {
  finishStartup();
} else {
  window.addEventListener("load", finishStartup, { once: true });
}

const copy = {
  en: {navClub:"The club",navCompetition:"Competition",navJoin:"Join",account:"Account",heroEyebrow:"AI MAKER CLUB · STUDENT-LED",heroTitle:"A club for<br><em>making with AI.</em>",heroLede:"No Vibe No Code is a student-led club where you turn ideas into websites, apps, games, and useful experiments.",joinClub:"Join the club <span>↗</span>",exploreCompetition:"Explore the competition ↓",overviewClubKicker:"WHAT IS THE CLUB?",overviewClubTitle:"A place to build, learn, and find your people.",overviewClubText:"You do not need to know a programming language or follow a fixed class. Members choose a project, use the tools that fit, and help one another make it real.",readClub:"Read how the club works ↘",overviewCompetitionKicker:"WHAT COMPETITIONS ARE STARTING?",overviewCompetitionTitle:"AI Companion",comingSoon:"COMING AFTER FORMATION",overviewCompetitionText:"The first competition starts only after the club is formed, approved by the school, and paired with a teacher advisor. Participants then get 7 days to build an AI companion.",readCompetition:"See the competition brief ↘",sectionClub:"THE CLUB",clubTitle:"Not a class.<br><span>A maker community.</span>",clubIntro:"No Vibe No Code is a student-led AI coding and creative practice club. There is no fixed language, no weekly homework, and no one right way to build.",featureOneTitle:"Bring the idea",featureOneText:"Websites, apps, local tools, games, and experiments. Start with something you want to see exist.",featureTwoTitle:"Find your people",featureTwoText:"Work in flexible teams and learn from members with different strengths and experience.",featureThreeTitle:"Ship the thing",featureThreeText:"Make, test, share, and keep ownership of your direction. Progress beats perfection.",sectionRhythm:"HOW IT WORKS",rhythmTitle:"40 minutes.<br><span>Every week.</span>",announcements:"ANNOUNCEMENTS",announcementsText:"Competition updates, club news, deadlines, and opportunities.",openWork:"OPEN WORK TIME",openWorkText:"Chat, code, test ideas, ask for help, or work independently.",sectionCompetition:"THE FIRST COMPETITION",competitionTitle:"AI<br><span>Companion.</span>",notActive:"NOT ACTIVE YET",competitionIntro:"The first competition is AI Companion. It starts after the club is formed, school approval is complete, and a teacher advisor is confirmed.",competitionDetails:"Participants can work solo or in pairs and have 7 days to build a website, app, local program, or other interactive experience. Everyone can attend the showcase, even if they are not a club member. Students try projects directly and vote for one favorite.",futureCompetitions:"After that, the club will run more themed, month-long project competitions for member teams.",competitionLocked:"Registration opens after club formation",days:"DAYS TO BUILD",vote:"ONE PERSON · ONE VOTE",openSource:"OPEN SOURCE ON GITHUB",sectionJoin:"JOIN IN",joinTitle:"Start with<br><span>curiosity.</span>",joinText:"The first eight core members help form the club before Club Fair. You do not need prior coding experience. Bring an idea, an interest, or the willingness to try.",signupTitle:"Create your member profile",displayName:"Display name (unique login)",englishName:"Real English name",chineseName:"Real Chinese name",wechatId:"WeChat ID",classGrade:"Class + grade",password:"Password",chooseRole:"I want to join as",nonMember:"Non-member",member:"Member",terms:"By choosing Member, I understand that membership is a commitment for the current school year. If I decide to leave, I will delete my account and may register again as a non-member. I understand that the club is student-led, peer-based, and subject to school approval. I confirm that the information I provide is accurate and I agree to follow school safety and community rules.",agree:"I have read and agree to these terms.",continue:"Continue (3)",submitSignup:"Submit signup",sectionContact:"CONTACT",contactTitle:"Questions?<br><span>Find us.</span>",sendMessage:"Send message ↗",loginTitle:"Sign in",signIn:"Sign in"},
  zh: {navClub:"社团介绍",navCompetition:"项目竞赛",navJoin:"加入社团",account:"账号",heroEyebrow:"AI 创作社团 · 学生主导",heroTitle:"一个用 AI<br><em>做东西的社团。</em>",heroLede:"No Vibe No Code 是学生主导的社团。你可以把想法做成网站、应用、游戏或实用的小工具。",joinClub:"加入社团 <span>↗</span>",exploreCompetition:"了解项目竞赛 ↓",overviewClubKicker:"这是什么社团？",overviewClubTitle:"一起做东西，一起学习，也一起找队友。",overviewClubText:"不需要会编程，也没有固定课程。成员自己选择项目和工具，在实际制作中互相帮助，把想法变成作品。",readClub:"了解社团活动方式 ↘",overviewCompetitionKicker:"接下来有哪些竞赛？",overviewCompetitionTitle:"AI 陪伴者",comingSoon:"社团成立后开始",overviewCompetitionText:"第一次竞赛要等社团成立、学校批准并确定指导老师后才开始。参赛者之后有 7 天制作自己的 AI 陪伴者。",readCompetition:"查看竞赛说明 ↘",sectionClub:"社团介绍",clubTitle:"不是课堂。<br><span>是创作社区。</span>",clubIntro:"No Vibe No Code 是一个由学生主导的 AI 编程与创意实践社团。不要求统一语言，没有每周作业，也没有唯一的制作方式。",featureOneTitle:"带着想法来",featureOneText:"网站、应用、本地工具、游戏和实验。从一个你想让它存在的东西开始。",featureTwoTitle:"找到伙伴",featureTwoText:"和不同特长、不同经验的成员组队，一边合作一边学习。",featureThreeTitle:"把作品做出来",featureThreeText:"制作、测试、分享，并保留自己的方向。进步比完美更重要。",sectionRhythm:"活动方式",rhythmTitle:"每周<br><span>40 分钟。</span>",announcements:"社团公告",announcementsText:"竞赛动态、社团新闻、截止日期和机会。",openWork:"自由创作时间",openWorkText:"交流、编程、测试想法、寻求帮助，或者独立完成自己的项目。",sectionCompetition:"第一次项目竞赛",competitionTitle:"AI<br><span>陪伴者。</span>",notActive:"暂未开放",competitionIntro:"第一次竞赛是 AI 陪伴者。它将在社团成立、学校审批完成并确定指导老师后开始。",competitionDetails:"参赛者可以个人或双人组队，在 7 天内制作网站、应用、本地程序或其他可体验的互动作品。即使不是社团成员，也可以参加展示会。",futureCompetitions:"之后，社团会为成员团队举办更多主题项目竞赛。",competitionLocked:"社团成立后开放报名",days:"天开发时间",vote:"一人一票",openSource:"代码开源到 GitHub",sectionJoin:"加入方式",joinTitle:"从一份<br><span>好奇开始。</span>",joinText:"最初的 8 名核心成员将帮助社团在 Club Fair 前完成组建。不需要编程基础，只要有想法、兴趣或愿意尝试。",signupTitle:"创建社团档案",displayName:"显示名称（唯一登录名）",englishName:"真实英文名",chineseName:"真实中文名",wechatId:"微信号",classGrade:"班级 + 年级",password:"密码",chooseRole:"我希望以",nonMember:"非社团成员",member:"社团成员",terms:"选择“社团成员”即表示我理解：社团成员需要承诺参加当前整个学年。如果决定退出，我会删除账号，并可以重新以非社团成员身份报名。我理解社团由学生主导、以成员互相学习为主，并且需要遵守学校审批要求。我确认所填写信息真实准确，并同意遵守学校安全规定和社群规则。",agree:"我已阅读并同意以上条款。",continue:"继续（3）",submitSignup:"提交报名",sectionContact:"联系组织者",contactTitle:"有问题？<br><span>联系我们。</span>",sendMessage:"发送消息 ↗",loginTitle:"登录",signIn:"登录"}
};
Object.assign(copy.en, { createAccount: "Join this club", createProfile: "Create your profile ↗", heroTitle: '<span class="hero-title-line">A club for</span><em class="hero-title-line">making with AI.</em>', firstPrizeLabel: "GIFT CARD · FIRST PRIZE", secondPrizeLabel: "GIFT CARD · SECOND PRIZE", thirdPrizeLabel: "GIFT CARD · THIRD PRIZE", termsTitle: "Membership terms", termsRequired: "Terms acceptance required", termsAcceptedStatus: "Terms accepted", reviewTerms: "Review terms", wechatHelp: "Any questions? Add unoxyrich on WeChat.", contactText: "For questions about the club, membership, or the first competition, contact the organizer directly on WeChat." });
Object.assign(copy.zh, { createAccount: "加入社团", createProfile: "创建社团档案 ↗", heroTitle: '<span class="hero-title-line">一个用 AI</span><em class="hero-title-line">做东西的社团。</em>', firstPrizeLabel: "礼品卡 · 一等奖", secondPrizeLabel: "礼品卡 · 二等奖", thirdPrizeLabel: "礼品卡 · 三等奖", termsTitle: "成员条款", termsRequired: "需要接受条款", termsAcceptedStatus: "已接受条款", reviewTerms: "查看条款", wechatHelp: "有问题？请在微信添加 unoxyrich。", contactText: "如果你对社团、成员身份或第一次竞赛有问题，请直接在微信联系组织者。" });
let lang = navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
const setLanguage = () => { document.documentElement.lang = lang === "zh" ? "zh-CN" : "en"; document.querySelectorAll("[data-i18n]").forEach((el) => { const value = copy[lang][el.dataset.i18n]; if (value !== undefined) el.innerHTML = value; }); };
document.getElementById("langToggle").onclick = () => { lang = lang === "en" ? "zh" : "en"; setLanguage(); onLanguageChange(); };
setLanguage();
/* ---------- Motion engine ---------- */
/* Everything enters by flying in from outside the viewport. No opacity fades anywhere. */
const animeReady = Boolean(animeEngine) && !reduceMotion;
const CJK_PATTERN = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/;
const CHAR_SPLIT_LIMIT = 260;
const DIRECTIONS = ["left", "right", "top", "bottom"];
const randomBetween = (min, max) => min + Math.random() * (max - min);

const makeCharSpan = (character, pieces) => {
  const span = document.createElement("span");
  span.className = "split-char fly-piece";
  span.textContent = character;
  pieces.push(span);
  return span;
};

const splitPieces = (root) => {
  if (!root) return [];
  const existing = root.querySelectorAll(".fly-piece");
  if (existing.length) return Array.from(existing);
  const plain = (root.textContent || "").replace(/\s+/g, " ").trim();
  if (!plain) return [];
  const perCharacter = plain.length <= CHAR_SPLIT_LIMIT;
  const pieces = [];
  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 3) {
        const value = child.nodeValue;
        if (!value || !value.trim()) return;
        const fragment = document.createDocumentFragment();
        value.split(/(\s+)/).forEach((token) => {
          if (!token) return;
          if (!token.trim()) {
            fragment.appendChild(document.createTextNode(token));
            return;
          }
          if (perCharacter && CJK_PATTERN.test(token)) {
            Array.from(token).forEach((character) => fragment.appendChild(makeCharSpan(character, pieces)));
            return;
          }
          const word = document.createElement("span");
          word.className = "split-word";
          if (perCharacter) {
            Array.from(token).forEach((character) => word.appendChild(makeCharSpan(character, pieces)));
          } else {
            word.classList.add("fly-piece");
            word.textContent = token;
            pieces.push(word);
          }
          fragment.appendChild(word);
        });
        node.replaceChild(fragment, child);
      } else if (child.nodeType === 1) {
        if (child.tagName === "BR" || child.tagName === "IMG" || child.tagName === "INPUT") return;
        if (child.classList.contains("split-word") || child.classList.contains("split-char")) return;
        walk(child);
      }
    });
  };
  walk(root);
  return pieces;
};

const offscreenFrom = (element, direction, pad) => {
  const rect = element.getBoundingClientRect();
  if (direction === "left") return { x: -(rect.right + pad), y: 0 };
  if (direction === "right") return { x: window.innerWidth - rect.left + pad, y: 0 };
  if (direction === "top") return { x: 0, y: -(rect.bottom + pad) };
  return { x: 0, y: window.innerHeight - rect.top + pad };
};

const prepareFly = (nodes, config) => {
  const items = Array.from(nodes || []).filter(Boolean);
  if (!animeReady || !items.length) return null;
  const pad = config.pad === undefined ? 90 : config.pad;
  const states = items.map((node, index) => {
    const direction = typeof config.dir === "function" ? config.dir(node, index) : config.dir || "left";
    const base = offscreenFrom(node, direction, pad);
    const horizontal = direction === "left" || direction === "right";
    const jitterX = config.jitterX || 0;
    const jitterY = config.jitterY || 0;
    /* Along the travel axis the jitter only pushes further out, so nothing ever starts on screen. */
    const outward = (value, amount) => value + (value < 0 ? -1 : 1) * Math.random() * amount;
    return {
      x: horizontal ? outward(base.x, jitterX) : randomBetween(-jitterX, jitterX),
      y: horizontal ? randomBetween(-jitterY, jitterY) : outward(base.y, jitterY),
      rotate: config.spin ? randomBetween(-config.spin, config.spin) : 0
    };
  });
  items.forEach((node, index) => {
    node.style.willChange = "transform";
    node.style.transform = `translate3d(${states[index].x}px,${states[index].y}px,0) rotate(${states[index].rotate}deg)`;
  });
  return { items, states };
};

const playFly = (prepared, config) => {
  if (!prepared) return;
  const items = prepared.items;
  const states = prepared.states;
  animeEngine.animate(items, {
    translateX: (target, index) => [states[index].x, 0],
    translateY: (target, index) => [states[index].y, 0],
    rotate: (target, index) => [states[index].rotate, 0],
    duration: config.duration === undefined ? 950 : config.duration,
    delay: animeEngine.stagger(config.stagger === undefined ? 14 : config.stagger, { start: config.delay || 0 }),
    ease: config.ease || "out(4)",
    onComplete: () => items.forEach((node) => {
      node.style.transform = "";
      node.style.willChange = "";
    })
  });
};

const flyIn = (nodes, config) => playFly(prepareFly(nodes, config || {}), config || {});
const flyText = (selector, config) => {
  const pieces = [];
  document.querySelectorAll(selector).forEach((element) => pieces.push.apply(pieces, splitPieces(element)));
  flyIn(pieces, config);
};

/* ---------- Ink particle field ---------- */
const field = document.getElementById("particleField");
const fieldContext = field && field.getContext ? field.getContext("2d") : null;
if (field && fieldContext) {
  const context = fieldContext;
  const COUNT = 180;
  const NOZZLE = { x: -0.18, y: 0.46 };
  const points = Array.from({ length: COUNT }, (unused, index) => {
    const hx = Math.random();
    const hy = Math.random();
    const spread = randomBetween(-0.17, 0.17);
    return {
      hx,
      hy,
      size: index % 4 === 0 ? 5 : 3,
      alpha: 0.14 + Math.random() * 0.25,
      depth: 0.25 + Math.random() * 0.95,
      phaseX: randomBetween(0, Math.PI * 2),
      phaseY: randomBetween(0, Math.PI * 2),
      speedX: randomBetween(0.05, 0.15),
      speedY: randomBetween(0.05, 0.15),
      ampX: randomBetween(0.004, 0.018),
      ampY: randomBetween(0.012, 0.05),
      startX: NOZZLE.x + randomBetween(-0.05, 0.02),
      startY: NOZZLE.y + randomBetween(-0.05, 0.05),
      controlX: NOZZLE.x + (hx - NOZZLE.x) * 0.32 + spread * 0.18,
      controlY: NOZZLE.y + (hy - NOZZLE.y) * 0.26 + spread,
      delay: Math.pow(Math.random(), 1.6) * 0.55,
      span: randomBetween(0.85, 1.5)
    };
  });
  const xs = new Float64Array(COUNT);
  const ys = new Float64Array(COUNT);
  const radii = new Float64Array(COUNT);
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const resize = () => {
    field.width = window.innerWidth * devicePixelRatio;
    field.height = window.innerHeight * devicePixelRatio;
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize, { passive: true });
  const easeOut = (value) => 1 - Math.pow(1 - value, 3);
  const bezier = (from, control, to, t) => {
    const inverse = 1 - t;
    return inverse * inverse * from + 2 * inverse * t * control + t * t * to;
  };
  const paint = (linkFactor) => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    context.clearRect(0, 0, width, height);
    for (let index = 0; index < COUNT; index += 1) {
      context.fillStyle = `rgba(232,62,131,${points[index].alpha})`;
      context.beginPath();
      context.arc(xs[index], ys[index], radii[index], 0, Math.PI * 2);
      context.fill();
    }
    if (linkFactor <= 0) return;
    const reach = 118;
    const reachSquared = reach * reach;
    for (let index = 0; index < COUNT; index += 1) {
      for (let other = index + 1; other < COUNT; other += 1) {
        const dx = xs[index] - xs[other];
        const dy = ys[index] - ys[other];
        const squared = dx * dx + dy * dy;
        if (squared >= reachSquared) continue;
        const distance = Math.sqrt(squared);
        context.strokeStyle = `rgba(232,62,131,${0.075 * (1 - distance / reach) * linkFactor})`;
        context.beginPath();
        context.moveTo(xs[index], ys[index]);
        context.lineTo(xs[other], ys[other]);
        context.stroke();
      }
    }
  };
  if (reduceMotion) {
    for (let index = 0; index < COUNT; index += 1) {
      xs[index] = points[index].hx * window.innerWidth;
      ys[index] = points[index].hy * window.innerHeight;
      radii[index] = points[index].size;
    }
    paint(1);
  } else {
    let inkStart = null;
    window.addEventListener("pointermove", (event) => {
      pointer.targetX = event.clientX / window.innerWidth - 0.5;
      pointer.targetY = event.clientY / window.innerHeight - 0.5;
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => {
      pointer.targetX = 0;
      pointer.targetY = 0;
    });
    const render = (now) => {
      const seconds = now / 1000;
      const width = window.innerWidth;
      const height = window.innerHeight;
      pointer.x += (pointer.targetX - pointer.x) * 0.06;
      pointer.y += (pointer.targetY - pointer.y) * 0.06;
      const inkTime = inkStart === null ? null : (now - inkStart) / 1000;
      for (let index = 0; index < COUNT; index += 1) {
        const point = points[index];
        const homeX = point.hx + Math.sin(seconds * point.speedX + point.phaseX) * point.ampX;
        const homeY = point.hy + Math.sin(seconds * point.speedY + point.phaseY) * point.ampY;
        let nx = homeX;
        let ny = homeY;
        let grow = 1;
        if (inkTime === null || inkTime < 0) {
          nx = point.startX;
          ny = point.startY;
          grow = 0.2;
        } else if (inkTime < point.delay + point.span) {
          const local = Math.max(0, Math.min(1, (inkTime - point.delay) / point.span));
          const eased = easeOut(local);
          nx = bezier(point.startX, point.controlX, homeX, eased);
          ny = bezier(point.startY, point.controlY, homeY, eased);
          grow = 0.2 + 0.8 * Math.min(1, local * 2.2);
        }
        xs[index] = nx * width - pointer.x * 95 * point.depth;
        ys[index] = ny * height - pointer.y * 62 * point.depth;
        radii[index] = point.size * grow;
      }
      const linkFactor = inkTime === null ? 0 : Math.max(0, Math.min(1, (inkTime - 0.55) / 0.85));
      paint(linkFactor);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
    onIntro(() => { inkStart = performance.now() + 90; });
  }
}

/* ---------- Opening sequence ---------- */
onIntro(() => {
  if (!animeReady) return;
  flyIn([document.querySelector(".site-header")], { dir: "top", pad: 40, duration: 820, ease: "out(3)" });
  flyIn(document.querySelectorAll(".brand, .site-header nav a, .header-actions > *"), {
    dir: "top", pad: 40, duration: 760, stagger: 55, delay: 210
  });
  flyText(".hero-copy .eyebrow", {
    dir: "left", duration: 820, stagger: 9, delay: 260, jitterY: 130, spin: 90
  });
  flyText(".hero-copy h1", {
    dir: () => DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)],
    duration: 1000, stagger: 18, delay: 320, jitterX: 220, jitterY: 220, spin: 220, ease: "out(3)"
  });
  flyText(".hero-copy .lede", {
    dir: "left", duration: 880, stagger: 6, delay: 520, jitterY: 110, spin: 80
  });
  flyIn(document.querySelectorAll(".hero-actions > *"), {
    dir: "left", duration: 900, stagger: 90, delay: 720
  });
  flyIn([document.querySelector(".hero-mark")], {
    dir: "right", pad: 140, duration: 1250, delay: 180, ease: "out(3)"
  });
  const globe = document.querySelector(".globe-object");
  if (globe) {
    globe.style.transform = "rotate(-540deg)";
    animeEngine.animate(globe, { rotate: [-540, 0], duration: 1700, delay: 180, ease: "out(4)" });
  }

  const revealPlan = [
    { selector: ".ticker", mode: "block", dir: () => "left", config: { duration: 950, ease: "out(3)" } },
    { selector: ".overview-block", mode: "text", dir: (index) => (index % 2 ? "right" : "left"), config: { duration: 840, stagger: 6, jitterY: 100, spin: 100 } },
    { selector: ".section-heading", mode: "text", dir: () => "left", config: { duration: 920, stagger: 13, jitterY: 150, spin: 150 } },
    { selector: ".club-content > .body-large", mode: "text", dir: () => "right", config: { duration: 840, stagger: 6, jitterY: 90, spin: 90 } },
    { selector: ".feature-grid article", mode: "text", dir: (index) => (index === 1 ? "right" : "left"), config: { duration: 820, stagger: 6, jitterY: 80, spin: 80 } },
    { selector: ".rhythm-intro", mode: "text", dir: () => "left", config: { duration: 900, stagger: 11, jitterY: 130, spin: 130 } },
    { selector: ".rhythm-card", mode: "block", dir: () => "right", config: { duration: 980, ease: "out(3)" } },
    { selector: ".competition-top > div:first-child", mode: "text", dir: () => "left", config: { duration: 920, stagger: 13, jitterY: 150, spin: 150 } },
    { selector: ".status-badge", mode: "block", dir: () => "right", config: { duration: 860 } },
    { selector: ".comp-description", mode: "text", dir: () => "left", config: { duration: 840, stagger: 5, jitterY: 90, spin: 75 } },
    { selector: ".prize-stage", mode: "block", dir: () => "right", config: { duration: 1150, ease: "out(3)" } },
    { selector: ".rules-list div", mode: "block", dir: (index) => (index % 2 ? "right" : "left"), config: { duration: 880 } },
    { selector: ".contact-section > div:first-child", mode: "text", dir: () => "left", config: { duration: 920, stagger: 13, jitterY: 150, spin: 150 } },
    { selector: ".contact-display > p", mode: "text", dir: () => "right", config: { duration: 840, stagger: 6, jitterY: 90, spin: 90 } },
    { selector: ".wechat-display", mode: "block", dir: () => "right", config: { duration: 920 } }
  ];

  const units = [];
  const prepareUnit = (unit) => {
    const nodes = unit.mode === "text" ? splitPieces(unit.element) : [unit.element];
    unit.prepared = prepareFly(nodes, unit.config);
  };

  /* Elements are parked outside the viewport, so an IntersectionObserver on them would
     never fire. Vertical position is untouched by the horizontal park, so trigger on that. */
  let checkQueued = false;
  const checkReveals = () => {
    checkQueued = false;
    const limit = window.innerHeight * 0.92;
    let pending = 0;
    units.forEach((unit) => {
      if (unit.done) return;
      const rect = unit.element.getBoundingClientRect();
      /* No bottom check: anything already scrolled past must still be released. */
      if (rect.top < limit) {
        unit.done = true;
        playFly(unit.prepared, unit.config);
        return;
      }
      pending += 1;
    });
    if (!pending) {
      window.removeEventListener("scroll", queueCheck);
      window.removeEventListener("resize", queueCheck);
    }
  };
  const queueCheck = () => {
    if (checkQueued) return;
    checkQueued = true;
    requestAnimationFrame(checkReveals);
  };

  revealPlan.forEach((plan) => {
    document.querySelectorAll(plan.selector).forEach((element, index) => {
      const unit = { element, mode: plan.mode, done: false, config: Object.assign({}, plan.config, { dir: plan.dir(index) }) };
      prepareUnit(unit);
      units.push(unit);
    });
  });
  window.addEventListener("scroll", queueCheck, { passive: true });
  window.addEventListener("resize", queueCheck, { passive: true });
  queueCheck();

  onLanguageChange = () => {
    units.forEach((unit) => {
      if (unit.done || unit.mode !== "text") return;
      prepareUnit(unit);
    });
  };
});
const heroTilt = document.querySelector(".hero-tilt");
if (heroTilt && !reduceMotion) {
  const tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
  window.addEventListener("pointermove", (event) => {
    tilt.targetY = ((event.clientX / window.innerWidth) - 0.5) * 48;
    tilt.targetX = (0.5 - (event.clientY / window.innerHeight)) * 40;
  }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => {
    tilt.targetX = 0;
    tilt.targetY = 0;
  });
  const updateHeroTilt = () => {
    tilt.x += (tilt.targetX - tilt.x) * 0.075;
    tilt.y += (tilt.targetY - tilt.y) * 0.075;
    heroTilt.style.transform = `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translate3d(0, 0, 18px)`;
    requestAnimationFrame(updateHeroTilt);
  };
  updateHeroTilt();
}
const prizeStage = document.querySelector(".prize-stage");
const prizeStack = document.querySelector(".prize-stack");
if (prizeStage && prizeStack && !reduceMotion) {
  const cardTilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
  window.addEventListener("pointermove", (event) => {
    const bounds = prizeStage.getBoundingClientRect();
    const horizontal = (event.clientX - (bounds.left + bounds.width / 2)) / Math.max(bounds.width / 2, 1);
    const vertical = (event.clientY - (bounds.top + bounds.height / 2)) / Math.max(bounds.height / 2, 1);
    cardTilt.targetY = Math.max(-1, Math.min(1, horizontal)) * 13;
    cardTilt.targetX = Math.max(-1, Math.min(1, -vertical)) * 10;
  }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => {
    cardTilt.targetX = 0;
    cardTilt.targetY = 0;
  });
  const updateCardTilt = () => {
    cardTilt.x += (cardTilt.targetX - cardTilt.x) * 0.08;
    cardTilt.y += (cardTilt.targetY - cardTilt.y) * 0.08;
    prizeStack.style.transform = `rotateX(${cardTilt.x}deg) rotateY(${cardTilt.y}deg)`;
    requestAnimationFrame(updateCardTilt);
  };
  updateCardTilt();
}
const post = async (url, data) => { const response = await fetch(url, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(data) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Request failed"); return result; };
const signupForm = document.getElementById("signupForm"), terms = document.getElementById("termsAccepted"), continueButton = document.getElementById("termsContinue"), submitButton = signupForm.querySelector(".submit-button"), termsStatus = document.getElementById("termsStatus");
let countdown;
terms.onchange = () => {
  clearInterval(countdown);
  submitButton.disabled = true;
  if (!terms.checked) {
    continueButton.disabled = true;
    continueButton.textContent = copy[lang].continue;
    termsStatus.textContent = copy[lang].termsRequired;
    termsStatus.classList.remove("accepted");
    return;
  }
  continueButton.disabled = true;
  let remaining = 3;
  continueButton.textContent = copy[lang].continue.replace("3", remaining);
  countdown = setInterval(() => {
    remaining -= 1;
    continueButton.textContent = copy[lang].continue.replace("3", remaining);
    if (remaining <= 0) {
      clearInterval(countdown);
      continueButton.textContent = copy[lang].continue.replace(/\(\d+\)|（\d+）/, "");
      continueButton.disabled = false;
    }
  }, 1000);
};
signupForm.onsubmit = async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(signupForm)); data.termsAccepted = terms.checked; try { await post("/api/auth/signup", data); document.getElementById("signupMessage").textContent = lang === "zh" ? "报名成功！请从右上角登录。" : "Signup received — sign in from the top right."; signupForm.reset(); terms.checked = false; termsStatus.textContent = copy[lang].termsRequired; termsStatus.classList.remove("accepted"); submitButton.disabled = true; } catch (error) { document.getElementById("signupMessage").textContent = error.message; } };
const contactForm = document.getElementById("contactForm");
if (contactForm) contactForm.onsubmit = async (event) => { event.preventDefault(); try { await post("/api/contact", Object.fromEntries(new FormData(event.target))); document.getElementById("contactMessage").textContent = lang === "zh" ? "消息已发送。" : "Message sent."; event.target.reset(); } catch (error) { document.getElementById("contactMessage").textContent = error.message; } };
const signupDialog = document.getElementById("signupDialog");
const termsDialog = document.getElementById("termsDialog");
const openSignup = () => { if (!signupDialog.open) signupDialog.showModal(); document.body.classList.add("signup-dialog-open"); };
const openTerms = () => { if (!termsDialog.open) termsDialog.showModal(); };
document.getElementById("createAccountButton").onclick = openSignup;
const joinSectionButton = document.getElementById("joinSectionButton");
if (joinSectionButton) joinSectionButton.onclick = openSignup;
document.querySelectorAll('a[href="#join"]').forEach((link) => link.onclick = (event) => { event.preventDefault(); openSignup(); });
signupForm.querySelector('[value="member"]').addEventListener("change", openTerms);
document.getElementById("reviewTerms").onclick = openTerms;
continueButton.onclick = () => {
  termsStatus.textContent = copy[lang].termsAcceptedStatus;
  termsStatus.classList.add("accepted");
  submitButton.disabled = false;
  termsDialog.close();
};
document.getElementById("signupClose").onclick = () => signupDialog.close();
document.getElementById("termsClose").onclick = () => termsDialog.close();
signupDialog.addEventListener("close", () => document.body.classList.remove("signup-dialog-open"));
termsDialog.addEventListener("close", () => {
  if (!submitButton.disabled) return;
  clearInterval(countdown);
  terms.checked = false;
  continueButton.disabled = true;
  continueButton.textContent = copy[lang].continue;
});
const dialog = document.getElementById("accountDialog"); document.getElementById("accountButton").onclick = () => dialog.showModal();
document.getElementById("accountClose").onclick = () => dialog.close();
const accountContent = document.getElementById("accountContent");
const accountButton = document.getElementById("accountButton");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[character]);
const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result;
};
const fileDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error("Could not read that image."));
  reader.readAsDataURL(file);
});
const renderAccount = (user) => {
  const privileged = ["club-leader", "teacher", "maintainer"].includes(user.role);
  accountButton.textContent = user.display_name;
  accountContent.innerHTML = `<p class="eyebrow">ACCOUNT / 001</p><h3>${escapeHtml(user.display_name)}</h3><p class="account-role">${escapeHtml(user.role)}</p>${privileged ? `<a class="pink-button account-admin-link" href="/admin.html">${lang === "zh" ? "打开管理面板 ↗" : "Open admin dashboard ↗"}</a>` : ""}<form id="profileForm" class="panel-form"><label>English name<input name="englishName" value="${escapeHtml(user.english_name)}" required></label><label>中文名<input name="chineseName" value="${escapeHtml(user.chinese_name)}" required></label><label>WeChat ID<input name="wechatId" value="${escapeHtml(user.wechat_id)}" required></label><label>Class + grade<input name="classGrade" value="${escapeHtml(user.class_grade)}" required></label><label>Profile image<input type="file" name="image" accept="image/png,image/jpeg,image/webp"></label><button class="pink-button">Save profile</button><p class="form-message" id="profileMessage"></p></form><div class="account-actions"><button class="outline-button" id="deleteAccount">${lang === "zh" ? "删除账号" : "Delete account"}</button><button class="pink-button" id="logout">${lang === "zh" ? "退出登录" : "Sign out"}</button></div>`;
  document.getElementById("profileForm").onsubmit = async (event) => {
    event.preventDefault();
    const message = document.getElementById("profileMessage");
    const profileData = Object.fromEntries(new FormData(event.target));
    delete profileData.image;
    try {
      await requestJson("/api/profile", { method:"PUT", headers:{"content-type":"application/json"}, body:JSON.stringify(profileData) });
      const image = event.target.image.files[0];
      if (image) await post("/api/profile-image", { dataUrl:await fileDataUrl(image) });
      message.textContent = lang === "zh" ? "档案已保存。" : "Profile saved.";
    } catch (error) {
      message.textContent = error.message;
    }
  };
  document.getElementById("deleteAccount").onclick = async () => {
    if (!confirm(lang === "zh" ? "确定删除账号？" : "Delete your account?")) return;
    try {
      await requestJson("/api/profile", { method:"DELETE" });
      location.reload();
    } catch (error) {
      alert(error.message);
    }
  };
  document.getElementById("logout").onclick = async () => {
    await post("/api/auth/logout", {});
    location.reload();
  };
};
const loginForm = document.getElementById("loginForm");
loginForm.onsubmit = async (event) => {
  event.preventDefault();
  const message = document.getElementById("loginMessage");
  message.textContent = "";
  try {
    await post("/api/auth/login", Object.fromEntries(new FormData(event.target)));
    const me = await requestJson("/api/me");
    renderAccount(me.user);
  } catch (error) {
    message.textContent = error.message;
  }
};
requestJson("/api/me").then(({ user }) => {
  if (user) renderAccount(user);
}).catch((error) => console.error("Could not restore account session", error));

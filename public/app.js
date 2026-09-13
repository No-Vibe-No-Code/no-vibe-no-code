const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const startupLoader = document.getElementById("startupLoader");
const startupStartedAt = performance.now();
const introHooks = [];
const onIntro = (hook) => introHooks.push(hook);
let introStarted = false;
const animationGroups = [];
let animationFrame = 0;
const easing = (name, value) => {
  const match = /^out\((\d+)\)$/.exec(name || "");
  return match ? 1 - Math.pow(1 - value, Number(match[1])) : value;
};
const stagger = (amount = 0, options = {}) => (target, index) =>
  (options.start || 0) + amount * index;
const renderAnimations = (time) => {
  animationFrame = 0;
  for (let index = animationGroups.length - 1; index >= 0; index -= 1) {
    const group = animationGroups[index];
    let groupActive = false;
    group.items.forEach((item) => {
      const progress = Math.max(0, Math.min(1, (time - item.startAt) / group.duration));
      const eased = easing(group.ease, progress);
      if (progress < 1) groupActive = true;
      item.target.style.transform = item.transform(eased);
    });
    if (!groupActive && !group.completed) {
      group.completed = true;
      group.items.forEach((item) => {
        item.target.style.willChange = "";
      });
      if (group.onComplete) group.onComplete();
    }
    if (!groupActive) animationGroups.splice(index, 1);
  }
  if (animationGroups.length) animationFrame = requestAnimationFrame(renderAnimations);
};
const animate = (targets, config) => {
  const items = Array.from(targets || []).filter(Boolean);
  if (!items.length) return;
  const startAt = performance.now();
  const duration = config.duration === undefined ? 950 : config.duration;
  const group = {
    duration,
    ease: config.ease,
    onComplete: config.onComplete,
    completed: false,
    items: items.map((target, index) => {
      const resolve = (property) => {
        const value = typeof config[property] === "function" ? config[property](target, index) : config[property];
        return Array.isArray(value) ? value : [0, 0];
      };
      const translateX = resolve("translateX");
      const translateY = resolve("translateY");
      const rotate = resolve("rotate");
      const hasTranslation = config.translateX !== undefined || config.translateY !== undefined;
      const delay = typeof config.delay === "function" ? config.delay(target, index) : config.delay || 0;
      target.style.willChange = "transform";
      return {
        target,
        startAt: startAt + delay,
        transform: (progress) => {
          const x = translateX[0] + (translateX[1] - translateX[0]) * progress;
          const y = translateY[0] + (translateY[1] - translateY[0]) * progress;
          const rotation = rotate[0] + (rotate[1] - rotate[0]) * progress;
          return hasTranslation
            ? `translate3d(${x}px,${y}px,0) rotate(${rotation}deg)`
            : `rotate(${rotation}deg)`;
        }
      };
    })
  };
  animationGroups.push(group);
  if (!animationFrame) animationFrame = requestAnimationFrame(renderAnimations);
};
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
    startupLoader.addEventListener("animationend", (event) => {
      if (event.target === startupLoader && event.animationName === "startup-exit") {
        startupLoader.remove();
      }
    }, { once: true });
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
Object.assign(copy.en, { createAccount: "Join the founding group", createProfile: "Create your profile ↗", heroTitle: '<span class="hero-title-line">Build with AI.</span><em class="hero-title-line">Make it real.</em>', heroLede: "A beginner-friendly student club for building websites, apps, games, tools, and experiments with AI.", heroProof: "Weekly 40-minute sessions · Flexible teams · Open to beginners", joinClub: "Join the founding group <span>↗</span>", seeHow: "See how it works ↓", navHow: "How it works", firstPrizeLabel: "GIFT CARD · FIRST PRIZE", secondPrizeLabel: "GIFT CARD · SECOND PRIZE", thirdPrizeLabel: "GIFT CARD · THIRD PRIZE", termsTitle: "Membership terms", termsRequired: "Terms acceptance required", termsAcceptedStatus: "Terms accepted", reviewTerms: "Review terms", wechatHelp: "Any questions? Add unoxyrich on WeChat.", contactText: "For questions about the club, membership, or the first competition, contact the organizer directly on WeChat.", sectionJoin: "JOIN THE FOUNDING GROUP", joinTitle: "Build your<br><span>first thing.</span>", joinText: "The first eight members will help shape the club before Club Fair. Bring an idea, an interest, or just the willingness to try.", whenLabel: "WHEN", whenText: "Weekly · 40 minutes", whereLabel: "WHERE", whereText: "On campus · room shared in the WeChat group", whoLabel: "WHO CAN JOIN", whoText: "Any student · beginners welcome", registerInterest: "Register interest <span>↗</span>", joinWeChat: "Join the WeChat group", firstMeetLabel: "FIRST MEETING", firstMeetText: "Date and room will be announced in the founding group.", firstMeetNote: "Register interest now and we will share the Club Fair plan, first-meeting time, and room as soon as they are confirmed.", joinNowLabel: "JOIN NOW", joinNowText: "1. Register interest<br>2. Join the group<br>3. Bring one idea", makeKicker: "WHAT YOU CAN MAKE", makeTitle: "Small ideas.<br><span>Real outputs.</span>", makeWebsites: "Websites", makeTools: "AI tools", makeGames: "Games", makeAutomation: "Automation scripts", makeCreative: "Creative experiments", rhythmNote: "A focused weekly reset for making progress with other students.", groupSize: "FLEXIBLE TEAMS", monthlyCycles: "MONTHLY PROJECT CYCLES", announcementsText: "Club updates, deadlines, opportunities, and quick wins.", openWork: "PROJECT WORK", prizeLabel: "PRIZES + RECOGNITION", prizeText: "Prizes and recognition to be announced after approval.", prizeNote: "The format and awards will be shared once the school has approved the competition.", competitionLocked: "Registration opens after club formation, school approval, and teacher confirmation.", interestTitle: "Register your interest", interestIntro: "Two quick details. No password, account, or commitment yet.", interestName: "Your name", interestWeChat: "WeChat ID", interestIdea: "What would you like to make?", privacyNotice: "We use your name and WeChat ID only to contact you about the founding group and meeting details. We do not publish them. You can ask us to delete them at any time.", readyForAccount: "Ready to create a member account? ↗", wechatTitle: "Join the founding group", wechatIntro: "Scan the QR code in WeChat. The current invite is valid through September 20.", wechatQrNote: "If the QR code has expired, register your interest and we will send the current invite.", signupTitle: "Create your member account", signupIntro: "This is the optional account step after you decide to join.", accountPrivacyNotice: "Your account details are stored securely for member access. We keep your WeChat ID and class private from public profiles.", submitSignup: "Create account", createFullAccount: "Create a member account ↗" });
Object.assign(copy.zh, { createAccount: "加入创始群", createProfile: "创建社团档案 ↗", heroTitle: '<span class="hero-title-line">用 AI 做东西。</span><em class="hero-title-line">把想法变成现实。</em>', heroLede: "一个欢迎零基础学生的创作社团，用 AI 制作网站、应用、游戏、工具和各种实验。", heroProof: "每周 40 分钟 · 灵活组队 · 欢迎零基础", joinClub: "加入创始群 <span>↗</span>", seeHow: "了解活动方式 ↓", navHow: "活动方式", firstPrizeLabel: "礼品卡 · 一等奖", secondPrizeLabel: "礼品卡 · 二等奖", thirdPrizeLabel: "礼品卡 · 三等奖", termsTitle: "成员条款", termsRequired: "需要接受条款", termsAcceptedStatus: "已接受条款", reviewTerms: "查看条款", wechatHelp: "有问题？请在微信添加 unoxyrich。", contactText: "如果你对社团、成员身份或第一次竞赛有问题，请直接在微信联系组织者。", sectionJoin: "加入创始群", joinTitle: "做出你的<br><span>第一个作品。</span>", joinText: "最初的 8 名成员将在 Club Fair 前一起塑造社团。带着想法、兴趣，或愿意尝试的心来就好。", whenLabel: "时间", whenText: "每周 · 40 分钟", whereLabel: "地点", whereText: "校园内 · 地点将在微信群公布", whoLabel: "谁可以加入", whoText: "所有学生 · 欢迎零基础", registerInterest: "报名意向 <span>↗</span>", joinWeChat: "加入微信群", firstMeetLabel: "第一次活动", firstMeetText: "时间和教室将在创始群公布。", firstMeetNote: "现在登记意向，Club Fair 计划、第一次活动时间和教室确认后会第一时间通知。", joinNowLabel: "现在加入", joinNowText: "1. 登记意向<br>2. 加入群聊<br>3. 带一个想法", makeKicker: "你可以做什么", makeTitle: "小小的想法。<br><span>真实的作品。</span>", makeWebsites: "网站", makeTools: "AI 工具", makeGames: "游戏", makeAutomation: "自动化脚本", makeCreative: "创意实验", rhythmNote: "每周用一段专注时间，和其他同学一起推进作品。", groupSize: "灵活组队", monthlyCycles: "每月项目周期", announcementsText: "社团动态、截止日期、机会和每周小进展。", openWork: "项目创作", prizeLabel: "奖项与认可", prizeText: "奖项与认可将在审批后公布。", prizeNote: "学校批准竞赛后，我们会公布具体形式和奖项。", competitionLocked: "社团成立、学校批准并确定指导老师后开放报名。", interestTitle: "登记报名意向", interestIntro: "只需要两项信息。暂时不需要密码、账号，也不代表必须加入。", interestName: "你的名字", interestWeChat: "微信号", interestIdea: "你想做什么？", privacyNotice: "我们只会用你的名字和微信号联系创始群及活动信息，不会公开。你可以随时要求我们删除这些信息。", readyForAccount: "准备好创建成员账号？↗", wechatTitle: "加入创始微信群", wechatIntro: "使用微信扫描二维码。目前的邀请二维码有效至 9 月 20 日。", wechatQrNote: "如果二维码过期，请先登记报名意向，我们会发送最新邀请。", signupTitle: "创建成员账号", signupIntro: "这是你决定加入之后的可选账号步骤。", accountPrivacyNotice: "你的账号信息会被安全保存，用于成员访问。微信号和班级不会显示在公开档案中。", submitSignup: "创建账号", createFullAccount: "创建成员账号 ↗", navClub: "社团介绍", navCompetition: "竞赛" });
Object.assign(copy.en, { heroQrKicker: "JOIN THE FOUNDING GROUP", heroQrTitleText: "Scan in WeChat.<br><span>Start here.</span>", heroQrText: "Join the first group directly, see the Club Fair plan, and get the first-meeting details when they are confirmed.", heroQrAction: "Register interest ↗", heroQrMeta: "Current invite · valid through September 20" });
Object.assign(copy.zh, { heroQrKicker: "加入创始群", heroQrTitleText: "用微信扫码。<br><span>从这里开始。</span>", heroQrText: "直接加入创始群，查看 Club Fair 计划，并在第一次活动确认后收到时间和教室信息。", heroQrAction: "登记报名意向 ↗", heroQrMeta: "当前邀请 · 有效至 9 月 20 日" });
Object.assign(copy.en, { createAccount: "Create account", mobileJoin: "Join the founding group" });
Object.assign(copy.zh, { createAccount: "创建账号", mobileJoin: "加入创始群" });
let lang = (() => { try { const saved = localStorage.getItem("nvnc-language"); if (saved === "en" || saved === "zh") return saved; } catch {} return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"; })();
const setLanguage = () => { document.documentElement.lang = lang === "zh" ? "zh-CN" : "en"; try { localStorage.setItem("nvnc-language", lang); } catch {} document.querySelectorAll("[data-i18n]").forEach((el) => { const value = copy[lang][el.dataset.i18n]; if (value !== undefined) el.innerHTML = value; }); };
document.getElementById("langToggle").onclick = () => { lang = lang === "en" ? "zh" : "en"; setLanguage(); onLanguageChange(); };
setLanguage();
/* ---------- Motion engine ---------- */
/* Everything enters by flying in from outside the viewport. No opacity fades anywhere. */
const animeReady = !reduceMotion;
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
    node.style.transform = `translate3d(${states[index].x}px,${states[index].y}px,0) rotate(${states[index].rotate}deg)`;
  });
  return { items, states };
};

const playFly = (prepared, config) => {
  if (!prepared) return;
  const items = prepared.items;
  const states = prepared.states;
  animate(items, {
    translateX: (target, index) => [states[index].x, 0],
    translateY: (target, index) => [states[index].y, 0],
    rotate: (target, index) => [states[index].rotate, 0],
    duration: config.duration === undefined ? 950 : config.duration,
    delay: stagger(config.stagger === undefined ? 14 : config.stagger, { start: config.delay || 0 }),
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
  const getParticleCount = () => {
    const area = window.innerWidth * window.innerHeight;
    const density = window.innerWidth <= 640 ? 0.00014 : window.innerWidth <= 1024 ? 0.00017 : 0.0002;
    return Math.round(Math.min(220, Math.max(72, area * density)));
  };
  const COUNT = getParticleCount();
  const NOZZLE = { x: -0.18, y: 0.46 };
  const homeX = new Float32Array(COUNT);
  const homeY = new Float32Array(COUNT);
  const pointSize = new Uint8Array(COUNT);
  const depth = new Float32Array(COUNT);
  const phaseX = new Float32Array(COUNT);
  const phaseY = new Float32Array(COUNT);
  const speedX = new Float32Array(COUNT);
  const speedY = new Float32Array(COUNT);
  const ampX = new Float32Array(COUNT);
  const ampY = new Float32Array(COUNT);
  const startX = new Float32Array(COUNT);
  const startY = new Float32Array(COUNT);
  const controlX = new Float32Array(COUNT);
  const controlY = new Float32Array(COUNT);
  const delay = new Float32Array(COUNT);
  const span = new Float32Array(COUNT);
  const alpha = new Float32Array(COUNT);
  for (let index = 0; index < COUNT; index += 1) {
    const hx = Math.random();
    const hy = Math.random();
    const opacity = 0.14 + Math.random() * 0.25;
    const spread = randomBetween(-0.17, 0.17);
    homeX[index] = hx;
    homeY[index] = hy;
    pointSize[index] = index % 4 === 0 ? 5 : 3;
    depth[index] = 0.25 + Math.random() * 0.95;
    phaseX[index] = randomBetween(0, Math.PI * 2);
    phaseY[index] = randomBetween(0, Math.PI * 2);
    speedX[index] = randomBetween(0.05, 0.15);
    speedY[index] = randomBetween(0.05, 0.15);
    ampX[index] = randomBetween(0.004, 0.018);
    ampY[index] = randomBetween(0.012, 0.05);
    startX[index] = NOZZLE.x + randomBetween(-0.05, 0.02);
    startY[index] = NOZZLE.y + randomBetween(-0.05, 0.05);
    controlX[index] = NOZZLE.x + (hx - NOZZLE.x) * 0.32 + spread * 0.18;
    controlY[index] = NOZZLE.y + (hy - NOZZLE.y) * 0.26 + spread;
    delay[index] = Math.pow(Math.random(), 1.6) * 0.55;
    span[index] = randomBetween(0.85, 1.5);
    alpha[index] = opacity;
  }
  const xs = new Float32Array(COUNT);
  const ys = new Float32Array(COUNT);
  const radii = new Float32Array(COUNT);
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const linkReach = 118;
  const linkBuckets = 32;
  const linkPaths = Array.from({ length: linkBuckets }, () => []);
  const gridOffset = linkReach;
  const gridNext = new Int32Array(COUNT);
  const gridCellX = new Int32Array(COUNT);
  const gridCellY = new Int32Array(COUNT);
  const linkReachSquared = linkReach * linkReach;
  const linkReachInverse = 1 / linkReach;
  let gridColumns = 0;
  let gridRows = 0;
  let gridHead = new Int32Array(0);
  let pixelRatio = 1;
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  const resizeGrid = (width, height) => {
    gridColumns = Math.ceil((width + gridOffset * 2) / linkReach);
    gridRows = Math.ceil((height + gridOffset * 2) / linkReach);
    gridHead = new Int32Array(gridColumns * gridRows);
  };
  const resizeCanvas = () => {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    field.width = Math.round(viewportWidth * pixelRatio);
    field.height = Math.round(viewportHeight * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    resizeGrid(viewportWidth, viewportHeight);
  };
  resizeCanvas();
  let resizeFrame = 0;
  const queueResize = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      resizeCanvas();
    });
  };
  window.addEventListener("resize", queueResize, { passive: true });
  const easeOut = (value) => 1 - Math.pow(1 - value, 3);
  const bezier = (from, control, to, t) => {
    const inverse = 1 - t;
    return inverse * inverse * from + 2 * inverse * t * control + t * t * to;
  };
  const paint = (linkFactor) => {
    context.clearRect(0, 0, viewportWidth, viewportHeight);
    context.fillStyle = "#216b9b";
    for (let index = 0; index < COUNT; index += 1) {
      context.globalAlpha = alpha[index];
      context.beginPath();
      context.arc(xs[index], ys[index], radii[index], 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    if (linkFactor <= 0) return;
    for (let bucket = 0; bucket < linkBuckets; bucket += 1) linkPaths[bucket].length = 0;
    gridHead.fill(-1);
    for (let index = 0; index < COUNT; index += 1) {
      let cellX = Math.floor((xs[index] + gridOffset) / linkReach);
      let cellY = Math.floor((ys[index] + gridOffset) / linkReach);
      if (cellX < 0) cellX = 0;
      else if (cellX >= gridColumns) cellX = gridColumns - 1;
      if (cellY < 0) cellY = 0;
      else if (cellY >= gridRows) cellY = gridRows - 1;
      gridCellX[index] = cellX;
      gridCellY[index] = cellY;
      const cell = cellY * gridColumns + cellX;
      gridNext[index] = gridHead[cell];
      gridHead[cell] = index;
    }
    for (let index = 0; index < COUNT; index += 1) {
      const cellX = gridCellX[index];
      const cellY = gridCellY[index];
      const rowStart = cellY > 0 ? cellY - 1 : 0;
      const rowEnd = cellY < gridRows - 1 ? cellY + 1 : cellY;
      const columnStart = cellX > 0 ? cellX - 1 : 0;
      const columnEnd = cellX < gridColumns - 1 ? cellX + 1 : cellX;
      for (let row = rowStart; row <= rowEnd; row += 1) {
        for (let column = columnStart; column <= columnEnd; column += 1) {
          for (let other = gridHead[row * gridColumns + column]; other !== -1; other = gridNext[other]) {
            if (other <= index) continue;
            const dx = xs[index] - xs[other];
            const dy = ys[index] - ys[other];
            const squared = dx * dx + dy * dy;
            if (squared >= linkReachSquared) continue;
            const fade = (1 - Math.sqrt(squared) * linkReachInverse) * linkFactor;
            const bucket = Math.min(linkBuckets - 1, Math.floor(fade * linkBuckets));
            if (bucket <= 0) continue;
            linkPaths[bucket].push(xs[index], ys[index], xs[other], ys[other]);
          }
        }
      }
    }
    for (let bucket = 1; bucket < linkBuckets; bucket += 1) {
      const path = linkPaths[bucket];
      if (!path.length) continue;
      context.strokeStyle = `rgba(33,107,155,${0.075 * (bucket + 0.5) / linkBuckets})`;
      context.beginPath();
      for (let offset = 0; offset < path.length; offset += 4) {
        context.moveTo(path[offset], path[offset + 1]);
        context.lineTo(path[offset + 2], path[offset + 3]);
      }
      context.stroke();
    }
  };
  if (reduceMotion) {
    for (let index = 0; index < COUNT; index += 1) {
      xs[index] = homeX[index] * viewportWidth;
      ys[index] = homeY[index] * viewportHeight;
      radii[index] = pointSize[index];
    }
    paint(1);
  } else {
    let inkStart = null;
    let lastPointerActivity = performance.now();
    let renderFrame = 0;
    window.addEventListener("pointermove", (event) => {
      pointer.targetX = event.clientX / window.innerWidth - 0.5;
      pointer.targetY = event.clientY / window.innerHeight - 0.5;
      lastPointerActivity = performance.now();
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => {
      pointer.targetX = 0;
      pointer.targetY = 0;
    });
    const render = (now) => {
      renderFrame = 0;
      if (document.visibilityState !== "visible") return;
      const seconds = now / 1000;
      const movementMultiplier = now - lastPointerActivity > 800 ? 3 : 1;
      pointer.x += (pointer.targetX - pointer.x) * 0.06;
      pointer.y += (pointer.targetY - pointer.y) * 0.06;
      const inkTime = inkStart === null ? null : (now - inkStart) / 1000;
      const pointerOffsetX = pointer.x * 95;
      const pointerOffsetY = pointer.y * 62;
      for (let index = 0; index < COUNT; index += 1) {
        const particleHomeX = homeX[index] + Math.sin(seconds * speedX[index] * movementMultiplier + phaseX[index]) * ampX[index];
        const particleHomeY = homeY[index] + Math.sin(seconds * speedY[index] * movementMultiplier + phaseY[index]) * ampY[index];
        let nx = particleHomeX;
        let ny = particleHomeY;
        let grow = 1;
        if (inkTime === null || inkTime < 0) {
          nx = startX[index];
          ny = startY[index];
          grow = 0.2;
        } else if (inkTime < delay[index] + span[index]) {
          const local = Math.max(0, Math.min(1, (inkTime - delay[index]) / span[index]));
          const eased = easeOut(local);
          nx = bezier(startX[index], controlX[index], particleHomeX, eased);
          ny = bezier(startY[index], controlY[index], particleHomeY, eased);
          grow = 0.2 + 0.8 * Math.min(1, local * 2.2);
        }
        xs[index] = nx * viewportWidth - pointerOffsetX * depth[index];
        ys[index] = ny * viewportHeight - pointerOffsetY * depth[index];
        radii[index] = pointSize[index] * grow;
      }
      const linkFactor = inkTime === null ? 0 : Math.max(0, Math.min(1, (inkTime - 0.55) / 0.85));
      paint(linkFactor);
      renderFrame = requestAnimationFrame(render);
    };
    const scheduleRender = () => {
      if (!renderFrame && document.visibilityState === "visible") renderFrame = requestAnimationFrame(render);
    };
    document.addEventListener("visibilitychange", scheduleRender, { passive: true });
    onIntro(() => {
      inkStart = performance.now() + 90;
      scheduleRender();
    });
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
    animate([globe], { rotate: [-540, 0], duration: 1700, delay: 180, ease: "out(4)" });
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
    { selector: ".prize-note", mode: "block", dir: () => "right", config: { duration: 900, ease: "out(3)" } },
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
    const prepareLimit = window.innerHeight * 1.5;
    let pending = 0;
    for (let index = units.length - 1; index >= 0; index -= 1) {
      const unit = units[index];
      const rect = unit.element.getBoundingClientRect();
      if (!unit.prepared && rect.top < prepareLimit) prepareUnit(unit);
      /* No bottom check: anything already scrolled past must still be released. */
      if (rect.top < limit) {
        playFly(unit.prepared, unit.config);
        units.splice(index, 1);
        continue;
      }
      pending += 1;
    }
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
      const unit = { element, mode: plan.mode, config: Object.assign({}, plan.config, { dir: plan.dir(index) }) };
      units.push(unit);
    });
  });
  window.addEventListener("scroll", queueCheck, { passive: true });
  window.addEventListener("resize", queueCheck, { passive: true });
  queueCheck();

  onLanguageChange = () => {
    units.forEach((unit) => {
      if (unit.mode !== "text") return;
      prepareUnit(unit);
    });
  };
});
const mobileTilt = window.matchMedia("(max-width: 800px), (pointer: coarse)").matches;
const heroTilt = document.querySelector(".hero-tilt");
if (heroTilt && !reduceMotion && !mobileTilt) {
  const tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let tiltFrame = 0;
  const updateHeroTilt = () => {
    tiltFrame = 0;
    tilt.x += (tilt.targetX - tilt.x) * 0.075;
    tilt.y += (tilt.targetY - tilt.y) * 0.075;
    heroTilt.style.transform = `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translate3d(0, 0, 18px)`;
    if (Math.abs(tilt.targetX - tilt.x) > 0.01 || Math.abs(tilt.targetY - tilt.y) > 0.01) {
      tiltFrame = requestAnimationFrame(updateHeroTilt);
    }
  };
  const queueHeroTilt = () => {
    if (!tiltFrame) tiltFrame = requestAnimationFrame(updateHeroTilt);
  };
  window.addEventListener("pointermove", (event) => {
    tilt.targetY = ((event.clientX / window.innerWidth) - 0.5) * 48;
    tilt.targetX = (0.5 - (event.clientY / window.innerHeight)) * 40;
    queueHeroTilt();
  }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => {
    tilt.targetX = 0;
    tilt.targetY = 0;
    queueHeroTilt();
  });
  updateHeroTilt();
}
const prizeStage = document.querySelector(".prize-stage");
const prizeStack = document.querySelector(".prize-stack");
if (prizeStage && prizeStack && !reduceMotion && !mobileTilt) {
  const cardTilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let prizeBounds = prizeStage.getBoundingClientRect();
  let prizeBoundsFrame = 0;
  const queuePrizeBounds = () => {
    if (prizeBoundsFrame) return;
    prizeBoundsFrame = requestAnimationFrame(() => {
      prizeBoundsFrame = 0;
      prizeBounds = prizeStage.getBoundingClientRect();
    });
  };
  window.addEventListener("resize", queuePrizeBounds, { passive: true });
  window.addEventListener("scroll", queuePrizeBounds, { passive: true });
  let cardTiltFrame = 0;
  const updateCardTilt = () => {
    cardTiltFrame = 0;
    cardTilt.x += (cardTilt.targetX - cardTilt.x) * 0.08;
    cardTilt.y += (cardTilt.targetY - cardTilt.y) * 0.08;
    prizeStack.style.transform = `rotateX(${cardTilt.x}deg) rotateY(${cardTilt.y}deg)`;
    if (Math.abs(cardTilt.targetX - cardTilt.x) > 0.01 || Math.abs(cardTilt.targetY - cardTilt.y) > 0.01) {
      cardTiltFrame = requestAnimationFrame(updateCardTilt);
    }
  };
  const queueCardTilt = () => {
    if (!cardTiltFrame) cardTiltFrame = requestAnimationFrame(updateCardTilt);
  };
  window.addEventListener("pointermove", (event) => {
    const horizontal = (event.clientX - (prizeBounds.left + prizeBounds.width / 2)) / Math.max(prizeBounds.width / 2, 1);
    const vertical = (event.clientY - (prizeBounds.top + prizeBounds.height / 2)) / Math.max(prizeBounds.height / 2, 1);
    cardTilt.targetY = Math.max(-1, Math.min(1, horizontal)) * 13;
    cardTilt.targetX = Math.max(-1, Math.min(1, -vertical)) * 10;
    queueCardTilt();
  }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => {
    cardTilt.targetX = 0;
    cardTilt.targetY = 0;
    queueCardTilt();
  });
  updateCardTilt();
}
const csrfToken = () => { const existing = document.cookie.match(/(?:^|;\s*)nvnc_csrf=([^;]+)/)?.[1]; if (existing) return existing; const token = crypto.randomUUID(); document.cookie = `nvnc_csrf=${token}; SameSite=Lax; Path=/; Max-Age=86400${location.protocol === "https:" ? "; Secure" : ""}`; return token; };
const post = async (url, data) => { const response = await fetch(url, { method:"POST", headers:{"content-type":"application/json","x-csrf-token":csrfToken()}, body:JSON.stringify(data) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Request failed"); return result; };
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
const interestDialog = document.getElementById("interestDialog");
const wechatDialog = document.getElementById("wechatDialog");
const openInterest = () => { if (!interestDialog.open) interestDialog.showModal(); document.body.classList.add("signup-dialog-open"); };
const openSignup = () => { if (!signupDialog.open) signupDialog.showModal(); document.body.classList.add("signup-dialog-open"); };
const openWeChat = () => { if (!wechatDialog.open) wechatDialog.showModal(); };
const openTerms = () => { if (!termsDialog.open) termsDialog.showModal(); };
document.getElementById("createAccountButton").onclick = openSignup;
const joinSectionButton = document.getElementById("joinSectionButton");
if (joinSectionButton) joinSectionButton.onclick = openInterest;
document.getElementById("mobileJoinButton").onclick = openInterest;
document.getElementById("joinWeChatButton").onclick = openWeChat;
document.querySelectorAll('a[href="#join"]').forEach((link) => link.onclick = (event) => { event.preventDefault(); openInterest(); });
document.getElementById("interestClose").onclick = () => interestDialog.close();
document.getElementById("wechatClose").onclick = () => wechatDialog.close();
interestDialog.addEventListener("close", () => document.body.classList.remove("signup-dialog-open"));
document.getElementById("interestForm").onsubmit = async (event) => { event.preventDefault(); const message = document.getElementById("interestMessage"); const submit = event.target.querySelector("[type=submit]"); submit.disabled = true; message.textContent = ""; try { await post("/api/contact", Object.fromEntries(new FormData(event.target))); message.textContent = lang === "zh" ? "已登记！请加入微信群，我们会在那里分享下一步。" : "You’re on the list. Join the WeChat group for the next update."; event.target.reset(); } catch (error) { message.textContent = error.message; } finally { submit.disabled = false; } };
document.getElementById("fullSignupLink").onclick = () => { interestDialog.close(); openSignup(); };
document.getElementById("openSignupFromAccount").onclick = () => { dialog.close(); openSignup(); };
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
const publicView = new URLSearchParams(location.search).get("public") === "1";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[character]);
const requestJson = async (url, options = {}) => {
  const headers = new Headers(options.headers || {});
  if (!["GET", "HEAD"].includes((options.method || "GET").toUpperCase())) headers.set("x-csrf-token", csrfToken());
  const response = await fetch(url, { ...options, headers });
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
    location.replace("/home.html");
  } catch (error) {
    message.textContent = error.message;
  }
};
const restoreAccount = () => requestJson("/api/me").then(({ user }) => {
  if (!user) return;
  if (publicView) {
    accountButton.removeAttribute("data-i18n");
    accountButton.textContent = user.display_name;
    accountButton.setAttribute("aria-label", `${user.display_name} account`);
    accountButton.onclick = () => location.assign("/home.html");
    return;
  }
  location.replace("/home.html");
}).catch((error) => console.error("Could not restore account session", error));
if (document.readyState === "complete") {
  window.setTimeout(restoreAccount, 0);
} else {
  window.addEventListener("load", () => window.setTimeout(restoreAccount, 0), { once: true });
}

import { marked, Renderer, type Tokens } from "marked";

const GITHUB_API = "https://api.github.com";
const GITHUB_USER_AGENT = "NoVibeNoCode/1.0";
const MAX_README_CHARS = 300_000;

export type GithubProfileRef = {
  username: string;
  profileUrl: string;
};

type GithubRenderContext = {
  rawBase: string;
  webBase: string;
};

export type GithubSnapshot = {
  username: string;
  profileUrl: string;
  defaultBranch: string;
  avatarUrl: string;
  name: string;
  bio: string;
  etag: string;
  html: string;
  syncedAt: string;
};

export type GithubPreviousSnapshot = {
  etag?: string;
  html?: string;
  defaultBranch?: string;
  avatarUrl?: string;
  name?: string;
  bio?: string;
};

const allowedTags = new Set([
  "a", "blockquote", "br", "code", "del", "details", "div", "em", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "img", "li", "ol", "p", "pre", "s", "small", "span", "strong", "summary", "table", "tbody", "td",
  "tfoot", "th", "thead", "tr", "u", "ul",
]);
const voidTags = new Set(["br", "hr", "img"]);
const globalAttributes = new Set(["align", "height", "rowspan", "title", "width"]);
const tagAttributes: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel", "title"]),
  code: new Set(["class"]),
  details: new Set(["open"]),
  img: new Set(["src", "alt", "height", "loading", "title", "width"]),
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

const encodePath = (value: string) => value.split("/").map((part) => encodeURIComponent(part)).join("/");

export function parseGithubProfileUrl(value: unknown): GithubProfileRef | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    const username = parts[0] || "";
    if (url.protocol !== "https:" || !["github.com", "www.github.com"].includes(hostname) || parts.length !== 1) return null;
    if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username)) return null;
    return { username, profileUrl: `https://github.com/${username}` };
  } catch {
    return null;
  }
}

function renderContext(username: string, repo: string, branch: string): GithubRenderContext {
  const branchPath = encodePath(branch);
  return {
    rawBase: `https://raw.githubusercontent.com/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/${branchPath}/`,
    webBase: `https://github.com/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/blob/${branchPath}/`,
  };
}

function resolveImageUrl(href: string, context: GithubRenderContext) {
  if (!href || /^data:|^javascript:/i.test(href)) return null;
  try {
    const url = new URL(href, context.rawBase);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function resolveLinkUrl(href: string, context: GithubRenderContext) {
  if (!href) return null;
  if (/^#[a-z\d:_-]+$/i.test(href)) return href;
  try {
    const url = new URL(href, context.rawBase);
    if (url.protocol === "mailto:") return url.toString();
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (!/^https?:\/\//i.test(href)) {
      const base = new URL(context.rawBase);
      if (url.origin === base.origin && url.pathname.startsWith(base.pathname)) {
        const path = url.pathname.slice(base.pathname.length);
        return `${context.webBase}${path}${url.search}${url.hash}`;
      }
    }
    return url.toString();
  } catch {
    return null;
  }
}

function attributeValue(attributes: Record<string, string>, name: string) {
  return attributes[name] || "";
}

function parseAttributes(source: string) {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  return attributes;
}

function safeAttribute(name: string, value: string) {
  if (name === "align") return /^(?:left|center|right|absmiddle)$/i.test(value) ? value.toLowerCase() : "";
  if (["width", "height"].includes(name)) return /^(?:\d{1,4}(?:\.\d+)?%?|auto)$/i.test(value) ? value : "";
  if (["colspan", "rowspan"].includes(name)) return /^\d{1,2}$/.test(value) ? value : "";
  if (name === "loading") return /^(?:lazy|eager)$/i.test(value) ? value.toLowerCase() : "";
  if (name === "class") return /^language-[a-z\d+_.-]+$/i.test(value) ? value : "";
  return value.slice(0, 100);
}

function sanitizeHtml(source: string, context: GithubRenderContext) {
  const withoutDangerousBlocks = source.replace(/<(?:script|style|iframe|object|embed|template|svg|math)\b[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|embed|template|svg|math)>/gi, "");
  return withoutDangerousBlocks.replace(/<!--[\s\S]*?-->|<\/?([a-z][\w:-]*)(?:\s+([^<>]*?))?\s*\/?>/gi, (tag, rawName, rawAttributes) => {
    if (!rawName) return "";
    const name = String(rawName).toLowerCase();
    if (!allowedTags.has(name)) return "";
    const closing = /^<\//.test(tag);
    if (closing) return voidTags.has(name) ? "" : `</${name}>`;
    if (name === "img" && !resolveImageUrl(attributeValue(parseAttributes(rawAttributes || ""), "src"), context)) return "";
    const attributes = parseAttributes(rawAttributes || "");
    const allowed = new Set([...(tagAttributes[name] || []), ...globalAttributes]);
    const output: string[] = [];
    for (const [attribute, rawValue] of Object.entries(attributes)) {
      if (!allowed.has(attribute)) continue;
      if (attribute === "href") {
        const value = resolveLinkUrl(rawValue, context);
        if (value) output.push(`href="${escapeHtml(value)}"`);
        continue;
      }
      if (attribute === "src") {
        const value = resolveImageUrl(rawValue, context);
        if (value) output.push(`src="${escapeHtml(value)}"`);
        continue;
      }
      if (attribute === "target") {
        output.push('target="_blank"');
        continue;
      }
      if (attribute === "rel") {
        output.push('rel="noopener noreferrer"');
        continue;
      }
      if (attribute === "open" && name === "details") {
        output.push("open");
        continue;
      }
      const value = safeAttribute(attribute, rawValue);
      if (value) output.push(`${attribute}="${escapeHtml(value)}"`);
    }
    return `<${name}${output.length ? ` ${output.join(" ")}` : ""}${voidTags.has(name) ? " /" : ""}>`;
  });
}

export function renderGithubReadme(source: string, context: GithubRenderContext) {
  const renderer = new Renderer();
  renderer.image = ({ href, title, text }: Tokens.Image) => {
    const src = resolveImageUrl(href, context);
    return src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ""} loading="lazy" decoding="async" />` : "";
  };
  renderer.link = function (this: Renderer, { href, title, text, tokens }: Tokens.Link) {
    const value = resolveLinkUrl(href, context);
    const label = tokens ? this.parser.parseInline(tokens) : escapeHtml(text);
    return value ? `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer"${title ? ` title="${escapeHtml(title)}"` : ""}>${label}</a>` : label;
  };
  const html = marked.parse(source, { gfm: true, renderer });
  return sanitizeHtml(String(html), context);
}

async function githubJson(url: string) {
  const response = await fetch(url, { headers: { accept: "application/vnd.github+json", "user-agent": GITHUB_USER_AGENT } });
  if (!response.ok) throw new Error(response.status === 404 ? "That GitHub profile or profile README was not found." : "GitHub is temporarily unavailable.");
  return response.json<any>();
}

export async function fetchGithubSnapshot(profileUrl: string, previous: GithubPreviousSnapshot = {}): Promise<GithubSnapshot> {
  const profile = parseGithubProfileUrl(profileUrl);
  if (!profile) throw new Error("Use a public GitHub profile URL such as https://github.com/UnoxyRich.");
  const encodedUsername = encodeURIComponent(profile.username);
  let githubUser: any = { avatar_url: previous.avatarUrl || "", name: previous.name || "", bio: previous.bio || "" };
  let branch = previous.defaultBranch || "";
  if (!branch) {
    const [fetchedUser, repository] = await Promise.all([
      githubJson(`${GITHUB_API}/users/${encodedUsername}`),
      githubJson(`${GITHUB_API}/repos/${encodedUsername}/${encodedUsername}`),
    ]);
    if (repository.private || repository.archived) throw new Error("The matching GitHub profile repository must be public and active.");
    githubUser = fetchedUser;
    branch = String(repository.default_branch || "main");
  }
  let context = renderContext(profile.username, profile.username, branch);
  let headers: Record<string, string> = { "user-agent": GITHUB_USER_AGENT };
  if (previous.etag) headers["if-none-match"] = previous.etag;
  let response = await fetch(`${context.rawBase}README.md`, { headers });
  if (response.status === 404 && previous.defaultBranch) {
    const repository = await githubJson(`${GITHUB_API}/repos/${encodedUsername}/${encodedUsername}`);
    if (repository.private || repository.archived) throw new Error("The matching GitHub profile repository must be public and active.");
    branch = String(repository.default_branch || "main");
    context = renderContext(profile.username, profile.username, branch);
    headers = { "user-agent": GITHUB_USER_AGENT };
    response = await fetch(`${context.rawBase}README.md`, { headers });
  }
  const syncedAt = new Date().toISOString();
  if (response.status === 304 && previous.html) {
    return {
      username: profile.username,
      profileUrl: profile.profileUrl,
      defaultBranch: branch,
      avatarUrl: String(githubUser.avatar_url || ""),
      name: String(githubUser.name || ""),
      bio: String(githubUser.bio || ""),
      etag: previous.etag || "",
      html: previous.html,
      syncedAt,
    };
  }
  if (response.status === 404) throw new Error("Create a public README.md in your GitHub profile repository first.");
  if (!response.ok) throw new Error("GitHub is temporarily unavailable.");
  const markdown = await response.text();
  if (markdown.length > MAX_README_CHARS) throw new Error("That GitHub README is too large to mirror.");
  return {
    username: profile.username,
    profileUrl: profile.profileUrl,
    defaultBranch: branch,
    avatarUrl: String(githubUser.avatar_url || ""),
    name: String(githubUser.name || ""),
    bio: String(githubUser.bio || ""),
    etag: response.headers.get("etag") || "",
    html: renderGithubReadme(markdown, context),
    syncedAt,
  };
}

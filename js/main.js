/* ============================================================
   RST 竞赛 · 在线简历 —— 渲染与交互
   结构：①工具函数 ②电路 SVG 生成 ③导航
        ④Hero 渲染 ⑤各区块渲染 ⑥主题/菜单/打印
        ⑦视差/滚动 ⑧入场动画 ⑨启动
   ============================================================ */
'use strict';

/* ---------- ① 工具函数 ---------- */
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast = msg => {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 1800);
};

/* ---------- ② 电路 SVG 生成（Hero 背景，程序化 PCB 走线） ---------- */
function buildCircuit(){
  const svg = document.getElementById("heroCircuit");
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg";
  const W = 1200, H = 620;
  const mk = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };
  // 种子随机数：每次刷新图案一致
  let seed = 20260815;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const snap = v => Math.round(v / 18) * 18;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const g = mk("g", {});

  // 走线
  for (let i = 0; i < 14; i++){
    let x = snap(ri(30, W - 30));
    let y = snap(ri(30, H - 30));
    const d = ["M", x, y];
    const segs = ri(2, 4);
    for (let s = 0; s < segs; s++){
      const horiz = rnd() < 0.5;
      if (horiz){
        x = clamp(snap(x + (rnd() < 0.5 ? -1 : 1) * ri(40, 190)), 12, W - 12);
        d.push("H", x);
      } else {
        y = clamp(snap(y + (rnd() < 0.5 ? -1 : 1) * ri(40, 170)), 12, H - 12);
        d.push("V", y);
      }
    }
    const p = mk("path", { d: d.join(" ") });
    p.setAttribute("class", "tr" + (i % 3 === 0 ? " tr-flow" : i % 5 === 0 ? " tr-dim" : ""));
    g.appendChild(p);
    // 端点节点
    const nd = mk("circle", { cx: x, cy: y, r: 2.4 });
    nd.setAttribute("class", "nd" + (rnd() < 0.4 ? " pulse" : ""));
    g.appendChild(nd);
  }

  // 芯片（偏向右侧，避免与内容重叠）
  for (let i = 0; i < 3; i++){
    const cw = ri(54, 86), ch = ri(30, 46);
    const cx = snap(ri(Math.round(W * 0.42), W - 80));
    const cy = snap(ri(40, H - 60));
    g.appendChild(mk("rect", { x: cx, y: cy, width: cw, height: ch, rx: 5, "class": "chip" }));
    const pins = 5;
    for (let p = 0; p < pins; p++){
      const px = cx + cw * (p + 0.5) / pins;
      g.appendChild(mk("line", { x1: px, y1: cy, x2: px, y2: cy - 7, "class": "pin" }));
      g.appendChild(mk("line", { x1: px, y1: cy + ch, x2: px, y2: cy + ch + 7, "class": "pin" }));
    }
    const t = mk("text", { x: cx + cw / 2, y: cy + ch / 2 + 3, "text-anchor": "middle", "class": "chip-txt" });
    t.textContent = "IC·" + (i + 1);
    g.appendChild(t);
  }

  svg.appendChild(g);
}

/* ---------- ③ 导航 ---------- */
function renderNav(){
  const links = [
    { id: "highlights", label: "亮点" },
    { id: "projects", label: "项目" },
    { id: "experience", label: "实践" },
    { id: "skills", label: "技能" },
    { id: "education", label: "教育" },
    { id: "interests", label: "兴趣" },
    { id: "certificates", label: "证书" }
  ];
  const box = $("#navLinks");
  box.innerHTML = "";
  links.forEach(l => {
    const a = el("a", null, esc(l.label));
    a.href = "#" + l.id;
    a.dataset.target = l.id;
    box.appendChild(a);
  });
  // 滚动高亮当前区块
  const secs = [...document.querySelectorAll("main section[id]")];
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting){
        box.querySelectorAll("a").forEach(a => a.classList.toggle("active", a.dataset.target === e.target.id));
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  secs.forEach(s => io.observe(s));

  // 移动端菜单
  const btn = $("#menuBtn"), nav = box;
  btn.addEventListener("click", e => {
    e.stopPropagation();
    const open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", e => {
    if (e.target.closest("a")) closeMenu();
  });
  document.addEventListener("click", e => {
    if (!e.target.closest("#topbar")) closeMenu();
  });
  function closeMenu(){ nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); }
}

/* ---------- ④ Hero 渲染 ---------- */
function renderHero(){
  const r = window.resume;
  // 打字机效果
  const typeEl = $("#typeText");
  const phrases = r.titleTags && r.titleTags.length ? r.titleTags : [r.title];
  let pi = 0, pos = 0, deleting = false;
  (function type(){
    const cur = phrases[pi];
    typeEl.textContent = cur.slice(0, pos);
    if (!deleting){
      pos++;
      if (pos > cur.length){ deleting = true; setTimeout(type, 1700); return; }
      setTimeout(type, 62);
    } else {
      pos--;
      if (pos < 0){ deleting = false; pi = (pi + 1) % phrases.length; setTimeout(type, 380); return; }
      setTimeout(type, 30);
    }
  })();

  $("#heroIntro").textContent = r.intro;

  const badgeBox = $("#heroBadges");
  badgeBox.innerHTML = "";
  r.badges.forEach(b => badgeBox.appendChild(el("span", "badge", esc(b))));

  const act = $("#heroActions");
  act.innerHTML = "";
  // 在线试玩（主打，链接到坦克大战）
  const play = el("a", "btn btn-primary",
    "<svg width='15' height='15' viewBox='0 0 24 24' fill='currentColor' style='vertical-align:-2px'><path d='M8 5v14l11-7z'/></svg> 在线试玩 · 坦克大战");
  play.href = r.gameUrl;
  play.target = "_blank";
  play.rel = "noopener";
  // 电话
  const tel = el("button", "btn btn-ghost",
    "<svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' style='vertical-align:-2px'><path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z'/></svg> 电话");
  tel.addEventListener("click", () => { location.href = "tel:" + r.contact.phone; });
  // 复制邮箱
  const email = el("button", "btn btn-ghost",
    "<svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' style='vertical-align:-2px'><rect x='2' y='4' width='20' height='16' rx='2'/><path d='m22 7-10 6L2 7'/></svg> 复制邮箱");
  email.addEventListener("click", copyEmail);
  // 导出 PDF
  const pdf = el("button", "btn btn-ghost",
    "<svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' style='vertical-align:-2px'><polyline points='6 9 6 2 18 2 18 9'/><path d='M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2'/><rect x='6' y='14' width='12' height='8'/></svg> 导出 PDF");
  pdf.addEventListener("click", () => window.print());
  act.append(play, tel, email, pdf);
}

/* 复制邮箱（含降级方案） */
function copyEmail(){
  const r = window.resume;
  const addr = r.contact.emailLocal + "@" + r.contact.emailDomain;
  const done = () => toast("邮箱已复制：" + addr);
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(addr).then(done).catch(() => fallbackCopy(addr, done));
  } else fallbackCopy(addr, done);
}
function fallbackCopy(text, done){
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch(e){ prompt("请手动复制邮箱：", text); }
  document.body.removeChild(ta);
}

/* ---------- ⑤ 各区块渲染 ---------- */
function renderHighlights(){
  const grid = $("#hlGrid");
  window.resume.highlights.forEach(h => {
    const c = el("div", "hl-card fade");
    c.appendChild(el("div", "hl-num", esc(h.num) + "<span class='hl-unit'>" + esc(h.unit) + "</span>"));
    c.appendChild(el("div", "hl-label", esc(h.label)));
    grid.appendChild(c);
  });
}

function renderProjects(){
  const grid = $("#projectGrid");
  window.resume.projects.forEach((p, i) => {
    const win = el("article", "window fade");
    // 标题栏（终端窗口红绿灯）
    const head = el("div", "window-head");
    head.appendChild(el("span", "window-dot r"));
    head.appendChild(el("span", "window-dot y"));
    head.appendChild(el("span", "window-dot g"));
    head.appendChild(el("span", "window-title", "~/projects/" + String(i + 1).padStart(2, "0")));
    win.appendChild(head);
    // 正文
    const body = el("div", "window-body");
    const pj = el("div", "pj-head");
    pj.appendChild(el("span", "pj-name", esc(p.name)));
    if (p.tag) pj.appendChild(el("span", "pj-tag", esc(p.tag)));
    body.appendChild(pj);
    if (p.tech) body.appendChild(el("div", "pj-tech", "◤ " + esc(p.tech)));
    const ul = el("ul", "pj-points");
    p.points.forEach(x => ul.appendChild(el("li", null, esc(x))));
    body.appendChild(ul);
    if (p.actions && p.actions.length){
      const acts = el("div", "pj-actions");
      p.actions.forEach(a => {
        const btn = el("a", "btn " + (a.primary ? "btn-primary" : "btn-ghost") + " btn-sm", esc(a.text));
        const url = a.useGameUrl ? window.resume.gameUrl : a.url;
        if (url){ btn.href = url; btn.target = "_blank"; btn.rel = "noopener"; }
        acts.appendChild(btn);
      });
      body.appendChild(acts);
    }
    win.appendChild(body);
    grid.appendChild(win);
  });
}

function renderExperience(){
  const box = $("#expList");
  window.resume.experience.forEach(e => {
    const card = el("article", "exp-card fade");
    const head = el("div", "exp-head");
    head.appendChild(el("span", "exp-role", esc(e.role)));
    head.appendChild(el("span", "exp-time", esc(e.time)));
    card.appendChild(head);
    if (e.org) card.appendChild(el("div", "exp-org", esc(e.org)));
    const ul = el("ul", "exp-points");
    e.points.forEach(p => ul.appendChild(el("li", null, esc(p))));
    card.appendChild(ul);
    box.appendChild(card);
  });
}

function renderSkills(){
  const grid = $("#skillGrid");
  window.resume.skills.forEach(g => {
    const panel = el("div", "skill-panel fade");
    panel.appendChild(el("h3", null, esc(g.group)));
    g.items.forEach(it => {
      const item = el("div", "skill-item");
      const top = el("div", "skill-top");
      top.appendChild(el("span", "skill-name", esc(it.name)));
      top.appendChild(el("span", "skill-note", esc(it.note || "")));
      top.appendChild(el("span", "skill-pct", it.level + "%"));
      const bar = el("div", "bar");
      const fill = el("i");
      bar.appendChild(fill);
      item.appendChild(top);
      item.appendChild(bar);
      panel.appendChild(item);
      bar._fill = fill;
      bar._level = it.level;
    });
    grid.appendChild(panel);
  });
}

function renderEducation(){
  const box = $("#eduList");
  window.resume.education.forEach(e => {
    const card = el("article", "edu-card fade");
    card.appendChild(el("span", "edu-node"));
    const body = el("div", "edu-body");
    const head = el("div", "edu-head");
    head.appendChild(el("span", "edu-school", esc(e.school)));
    head.appendChild(el("span", "edu-time", esc(e.time)));
    body.appendChild(head);
    body.appendChild(el("div", "edu-major", esc(e.major) + " · " + esc(e.degree)));
    const ul = el("ul", "edu-points");
    e.points.forEach(p => ul.appendChild(el("li", null, esc(p))));
    body.appendChild(ul);
    card.appendChild(body);
    box.appendChild(card);
  });
}

function renderInterests(){
  const grid = $("#interestGrid");
  window.resume.interests.forEach(it => {
    const card = el("div", "interest-card fade");
    card.appendChild(el("div", "interest-ico", esc(it.icon)));
    card.appendChild(el("h3", null, esc(it.title)));
    card.appendChild(el("p", null, esc(it.desc)));
    grid.appendChild(card);
  });
}

function renderCertificates(){
  const list = $("#certList");
  const sum = el("div", "cert-summary fade");
  window.resume.certificates.forEach(c => {
    const pill = el("div", "cert-pill");
    const logo = el("span", "cert-logo", esc(c.vendor.charAt(0)));
    const info = el("div", "cert-info");
    info.appendChild(el("div", "cert-title", esc(c.vendor) + " · " + esc(c.title)));
    info.appendChild(el("div", "cert-note", "AI 技能认证 · 2026 年"));
    pill.appendChild(logo);
    pill.appendChild(info);
    pill.appendChild(el("span", "cert-count", esc(c.count)));
    sum.appendChild(pill);
  });
  list.appendChild(sum);

  // 证书画廊（assets/certs/cert1~N.webp）
  const gallery = $("#certGallery");
  gallery.classList.add("fade");
  const n = window.resume.certCount || 9;
  for (let i = 1; i <= n; i++){
    const fig = el("figure", null);
    const img = el("img");
    img.src = "assets/certs/cert" + i + ".webp";
    img.alt = window.resume.certPrefix + " " + i;
    img.loading = "lazy";
    fig.appendChild(img);
    fig.appendChild(el("figcaption", null, window.resume.certPrefix + " · " + i + "/" + n));
    fig.addEventListener("click", () => openLightbox(img.src, img.alt));
    gallery.appendChild(fig);
  }
}

/* 灯箱 */
function openLightbox(src, caption){
  $("#lbImg").src = src;
  $("#lbCaption").textContent = caption;
  $("#lightbox").classList.add("show");
}
function closeLightbox(){ $("#lightbox").classList.remove("show"); }

/* 页脚 */
function renderFooter(){
  const r = window.resume;
  $("#footerCopy").textContent = r.footer.copyright;
  $("#footerTime").textContent = r.footer.updated;
  const link = $("#footerLink");
  if (r.footer.linkUrl){
    const a = el("a", null, esc(r.footer.linkText) + " ↗");
    a.href = r.footer.linkUrl;
    a.target = "_blank";
    a.rel = "noopener";
    link.appendChild(a);
  }
}

/* ---------- ⑥ 主题切换 / 菜单 / 打印 ---------- */
function applyTheme(dark){
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  const btn = $("#themeBtn");
  btn.innerHTML = dark
    ? "<svg width='17' height='17' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round'><circle cx='12' cy='12' r='5'/><line x1='12' y1='1' x2='12' y2='3'/><line x1='12' y1='21' x2='12' y2='23'/><line x1='4.22' y1='4.22' x2='5.64' y2='5.64'/><line x1='18.36' y1='18.36' x2='19.78' y2='19.78'/><line x1='1' y1='12' x2='3' y2='12'/><line x1='21' y1='12' x2='23' y2='12'/><line x1='4.22' y1='19.78' x2='5.64' y2='18.36'/><line x1='18.36' y1='5.64' x2='19.78' y2='4.22'/></svg>"
    : "<svg width='17' height='17' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'/></svg>";
  btn.setAttribute("aria-label", dark ? "切换为浅色" : "切换为深色");
}
function initTheme(){
  const saved = localStorage.getItem("rst-resume-theme");
  applyTheme(saved ? saved === "dark" : true); // 默认深色（展示最佳观感）
}
$("#themeBtn").addEventListener("click", () => {
  const dark = document.documentElement.getAttribute("data-theme") !== "dark";
  applyTheme(dark);
  try { localStorage.setItem("rst-resume-theme", dark ? "dark" : "light"); } catch(e){}
});

$("#printBtn").addEventListener("click", () => window.print());
$("#backTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
$("#lightbox").addEventListener("click", closeLightbox);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeLightbox(); });

/* ---------- ⑦ 滚动视差 / 返回顶部 ---------- */
let ticking = false;
window.addEventListener("scroll", () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const y = window.scrollY;
    const circuit = $("#heroCircuit");
    if (circuit) circuit.style.transform = "translate3d(0, " + (y * 0.25).toFixed(1) + "px, 0)";
    $("#backTop").classList.toggle("show", y > 420);
    ticking = false;
  });
}, { passive: true });

/* ---------- ⑧ 入场动画 ---------- */
function initAnimations(){
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce){
    document.querySelectorAll(".bar i").forEach(f => { f.style.width = f.parentElement._level + "%"; });
    document.querySelectorAll(".fade").forEach(n => n.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      // 技能条填充
      e.target.querySelectorAll(".bar i").forEach(f => { f.style.width = f.parentElement._level + "%"; });
      io.unobserve(e.target);
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".fade").forEach(n => io.observe(n));
  // 不在视口内的技能条保持动画触发（skillGrid 自身含 fade）
}

/* ---------- ⑨ 启动 ---------- */
buildCircuit();
renderNav();
renderHero();
renderHighlights();
renderProjects();
renderExperience();
renderSkills();
renderEducation();
renderInterests();
renderCertificates();
renderFooter();
initTheme();
initAnimations();

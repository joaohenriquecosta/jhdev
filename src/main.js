import "./styles.css";
import { en, ui } from "./i18n.js";

const root = document.documentElement;
root.classList.add("js");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ── language ───────────────────────────────── */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const pt = {};
$$("[data-i18n]").forEach((el) => { pt[el.dataset.i18n] = el.innerHTML; });
$$("[data-i18n-aria]").forEach((el) => { pt[el.dataset.i18nAria] = el.getAttribute("aria-label"); });
$$("[data-i18n-alt]").forEach((el) => { pt[el.dataset.i18nAlt] = el.alt; });

let lang = "pt";
function setLang(next) {
  lang = next;
  const dict = next === "en" ? en : pt;
  $$("[data-i18n]").forEach((el) => {
    const v = dict[el.dataset.i18n] ?? pt[el.dataset.i18n];
    if (v != null && el.innerHTML !== v) el.innerHTML = v;
  });
  $$("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", dict[el.dataset.i18nAria] ?? pt[el.dataset.i18nAria]);
  });
  $$("[data-i18n-alt]").forEach((el) => { el.alt = dict[el.dataset.i18nAlt] ?? pt[el.dataset.i18nAlt]; });
  root.lang = next === "en" ? "en" : "pt-BR";
  store.set("lang", next);
}
const param = new URLSearchParams(location.search).get("lang");
const initial = param || store.get("lang") || (navigator.language?.toLowerCase().startsWith("pt") ? "pt" : "en");
if (initial === "en") setLang("en");
$(".lang").addEventListener("click", () => setLang(lang === "en" ? "pt" : "en"));

/* ── intro ──────────────────────────────────── */
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("is-ready")));

/* ── nav state ──────────────────────────────── */
const nav = $(".nav");
const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 24);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

const links = new Map($$(".nav__links a").map((a) => [a.hash.slice(1), a]));
const spy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      links.forEach((a) => a.classList.remove("is-active"));
      links.get(e.target.id)?.classList.add("is-active");
    }
  }
}, { rootMargin: "-45% 0px -50% 0px" });
links.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });

/* ── reveal on scroll ───────────────────────── */
const groups = new Map();
$$(".reveal").forEach((el) => {
  const parent = el.parentElement;
  const i = groups.get(parent) ?? 0;
  groups.set(parent, i + 1);
  el.style.setProperty("--d", `${Math.min(i, 6) * 0.07}s`);
});
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); }
  }
}, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
$$(".reveal").forEach((el) => io.observe(el));

/* ── count up ───────────────────────────────── */
const counter = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    counter.unobserve(e.target);
    const el = e.target, to = Number(el.dataset.to);
    if (reduced) { el.textContent = to; continue; }
    const t0 = performance.now(), dur = 1400;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}, { threshold: 0.6 });
$$(".count").forEach((el) => counter.observe(el));

/* ── business card: tilt, foil, flip ────────── */
const card = $(".card");
const stage = $(".stage");
const shadow = $(".card__shadow");
let raf = 0;
function tilt(x, y) {
  const r = card.getBoundingClientRect();
  const px = Math.max(0, Math.min(1, (x - r.left) / r.width));
  const py = Math.max(0, Math.min(1, (y - r.top) / r.height));
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    card.style.setProperty("--ry", `${(px - 0.5) * 26}deg`);
    card.style.setProperty("--rx", `${(0.5 - py) * 20}deg`);
    card.style.setProperty("--px", `${px * 100}%`);
    card.style.setProperty("--py", `${py * 100}%`);
    shadow.style.setProperty("--sx", ((px - 0.5) * -40).toFixed(1));
  });
}
function resetTilt() {
  card.classList.remove("is-tracking");
  card.style.setProperty("--rx", "0deg");
  card.style.setProperty("--ry", "0deg");
  card.style.setProperty("--px", "50%");
  card.style.setProperty("--py", "50%");
  shadow.style.setProperty("--sx", "0");
}
if (!reduced) {
  stage.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    card.classList.add("is-tracking");
    tilt(e.clientX, e.clientY);
  });
  stage.addEventListener("pointerleave", resetTilt);

  // Touch devices: gentle idle sway + device orientation if allowed without a prompt.
  if (!finePointer) {
    let t = 0;
    const sway = () => {
      t += 0.012;
      card.style.setProperty("--ry", `${Math.sin(t) * 9}deg`);
      card.style.setProperty("--rx", `${Math.cos(t * 0.8) * 5}deg`);
      card.style.setProperty("--px", `${50 + Math.sin(t) * 40}%`);
      card.style.setProperty("--py", `${50 + Math.cos(t * 0.8) * 30}%`);
      requestAnimationFrame(sway);
    };
    requestAnimationFrame(sway);
  }
}
card.addEventListener("click", () => {
  const flipped = card.getAttribute("aria-pressed") === "true";
  card.setAttribute("aria-pressed", String(!flipped));
});

/* ── ambient aura follows pointer ───────────── */
if (finePointer && !reduced) {
  addEventListener("pointermove", (e) => {
    root.style.setProperty("--mx", `${e.clientX}px`);
    root.style.setProperty("--my", `${e.clientY}px`);
  }, { passive: true });
}

/* ── magnetic buttons + fill origin ─────────── */
$$(".btn").forEach((b) => {
  b.addEventListener("pointermove", (e) => {
    const r = b.getBoundingClientRect();
    b.style.setProperty("--cx", `${e.clientX - r.left}px`);
    b.style.setProperty("--cy", `${e.clientY - r.top}px`);
    if (finePointer && !reduced && b.classList.contains("magnetic")) {
      b.style.setProperty("--tx", `${(e.clientX - r.left - r.width / 2) * 0.18}px`);
      b.style.setProperty("--ty", `${(e.clientY - r.top - r.height / 2) * 0.28}px`);
    }
  });
  b.addEventListener("pointerleave", () => { b.style.setProperty("--tx", "0px"); b.style.setProperty("--ty", "0px"); });
});

/* ── project spotlight ──────────────────────── */
$$(".project").forEach((p) => {
  p.addEventListener("pointermove", (e) => {
    const r = p.getBoundingClientRect();
    p.style.setProperty("--gx", `${e.clientX - r.left}px`);
    p.style.setProperty("--gy", `${e.clientY - r.top}px`);
  });
});

/* ── live clock (São Carlos) ────────────────── */
const clock = $(".clock");
const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const tickClock = () => { clock.textContent = fmt.format(new Date()); };
tickClock();
setInterval(tickClock, 1000);
$(".year").textContent = new Date().getFullYear();

/* ── footer wordmark fills while scrolling ──── */
const big = $(".foot__big");
const fill = () => {
  const r = big.getBoundingClientRect();
  const p = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight * 0.7)));
  big.style.setProperty("--fill", `${(p * 100).toFixed(1)}%`);
};
addEventListener("scroll", fill, { passive: true });
fill();

/* ── copy email ─────────────────────────────── */
const copyBtn = $(".copy");
copyBtn.addEventListener("click", async () => {
  const state = $(".copy__state", copyBtn);
  try {
    await navigator.clipboard.writeText(copyBtn.dataset.copy);
    copyBtn.classList.add("is-done");
    state.textContent = ui[lang].copied;
    setTimeout(() => { copyBtn.classList.remove("is-done"); state.textContent = lang === "en" ? en.copy : pt.copy; }, 1800);
  } catch {
    location.href = `mailto:${copyBtn.dataset.copy}`;
  }
});

/* ── contact form ───────────────────────────── */
const form = $(".form");
const status = $(".form__status", form);
const sendBtn = $(".btn--send", form);
const startedAt = Date.now();

function validate() {
  let ok = true;
  for (const el of $$("input[required], textarea[required]", form)) {
    const bad = !el.checkValidity() || el.value.trim().length < (Number(el.minLength) > 0 ? el.minLength : 1);
    el.closest(".field")?.classList.toggle("is-invalid", bad);
    if (bad && ok) { el.focus(); ok = false; }
  }
  return ok;
}
form.addEventListener("input", (e) => e.target.closest(".field")?.classList.remove("is-invalid"));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  status.className = "form__status";
  if (!validate()) { status.textContent = ui[lang].fields; status.classList.add("is-err"); return; }

  const data = Object.fromEntries(new FormData(form));
  data.t = startedAt;
  data.lang = lang;
  sendBtn.disabled = true;
  status.textContent = ui[lang].sending;

  try {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) throw new Error(body.error || res.status);
    form.classList.add("is-sent");
    $(".btn__label", sendBtn).textContent = ui[lang].sentBtn;
    status.textContent = ui[lang].sent;
    status.classList.add("is-ok");
    form.reset();
  } catch (err) {
    sendBtn.disabled = false;
    status.textContent = String(err.message) === "fields" ? ui[lang].fields : ui[lang].error;
    status.classList.add("is-err");
  }
});

/* ── ticker: duplicate track for a seamless loop ── */
const track = $(".ticker__track");
track.append(...[...track.children].map((n) => n.cloneNode(true)));

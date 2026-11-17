// Hero laptop: opens on load, closes on click, and its little terminal answers
// whatever you type. This file owns the state; the look comes from laptop3d.js
// (WebGL, loaded on demand) or, when that can't run, the CSS laptop in the markup.

const COPY = {
  pt: {
    open: "Abrir o notebook",
    close: "Fechar o notebook",
    boot: [["cmd", "whoami"], ["out", "joão henrique costa"], ["dim", "founder · hub smart home · southbridge"], ["cmd", "help"], ["dim", "tente: whoami · contato · projetos · clear"]],
    whoami: [["out", "joão henrique costa"], ["dim", "founder · hub smart home · southbridge"]],
    help: [["dim", "tente: whoami · contato · projetos · clear"]],
    contact: [["out", "contato@joaohenriquecosta.dev"], ["dim", "abrindo o formulário ↓"]],
    work: [["dim", "indo para o portfólio ↓"]],
    hello: [["out", "oi! bom te ver por aqui."]],
    sudo: [["dim", "boa tentativa."]],
    unknown: (c) => [["dim", `comando não encontrado: ${c} · tente help`]],
  },
  en: {
    open: "Open the laptop",
    close: "Close the laptop",
    boot: [["cmd", "whoami"], ["out", "joão henrique costa"], ["dim", "founder · hub smart home · southbridge"], ["cmd", "help"], ["dim", "try: whoami · contact · work · clear"]],
    whoami: [["out", "joão henrique costa"], ["dim", "founder · hub smart home · southbridge"]],
    help: [["dim", "try: whoami · contact · work · clear"]],
    contact: [["out", "contato@joaohenriquecosta.dev"], ["dim", "opening the form ↓"]],
    work: [["dim", "heading to the work ↓"]],
    hello: [["out", "hi! good to see you here."]],
    sudo: [["dim", "nice try."]],
    unknown: (c) => [["dim", `command not found: ${c} · try help`]],
  },
};

export const ROWS = [
  ["`", ..."1234567890-=", "backspace"],
  ["tab", ..."qwertyuiop[]", "\\"],
  ["capslock", ..."asdfghjkl;'", "enter"],
  ["shift", ..."zxcvbnm,./", "shift"],
  ["fn", "control", "alt", "meta", " ", "meta", "alt", "arrowleft", "arrowup", "arrowright"],
];
export const WIDE = { backspace: 1.6, tab: 1.5, "\\": 1.1, capslock: 1.8, enter: 1.8, shift: 2.35, " ": 5.4, meta: 1.25 };
const MAX_LINES = 8;

export function mountLaptop({ stage, getLang, reduced }) {
  const laptop = stage.querySelector(".laptop");
  const t = () => COPY[getLang()] ?? COPY.pt;

  /* shared state + tiny event bus */
  const st = { open: false, lines: [], input: "" };
  const subs = new Set();
  const emit = (type, data) => subs.forEach((fn) => fn(type, data));
  const on = (fn) => subs.add(fn);

  const line = (kind, text) => {
    st.lines.push({ kind, text });
    if (st.lines.length > MAX_LINES) st.lines.splice(0, st.lines.length - MAX_LINES);
    emit("term");
  };
  const print = (lines) => lines.forEach(([k, s]) => line(k, s));
  const setInput = (v) => { st.input = v; emit("input"); };
  const press = (k) => emit("key", k);

  /* terminal */
  let typing = 0; // bumps on every reset so stale timers stop
  function boot() {
    const id = ++typing;
    st.lines = []; st.input = ""; emit("term");
    if (reduced) { print(t().boot); return; }
    const script = t().boot;
    let i = 0;
    const next = () => {
      if (id !== typing || i >= script.length) return;
      const [kind, text] = script[i++];
      if (kind !== "cmd") { line(kind, text); setTimeout(next, 260); return; }
      let n = 0;
      const type = () => {
        if (id !== typing) return;
        setInput(text.slice(0, ++n));
        press(text[n - 1]);
        if (n < text.length) setTimeout(type, 70 + Math.random() * 70);
        else setTimeout(() => { if (id !== typing) return; press("enter"); st.input = ""; line("cmd", text); setTimeout(next, 180); }, 320);
      };
      setTimeout(type, 500);
    };
    setTimeout(next, 1100);
  }

  const goTo = (id) => setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }), 700);
  function run(raw) {
    const cmd = raw.trim().toLowerCase();
    line("cmd", raw);
    if (!cmd) return;
    const c = t();
    if (cmd === "clear") { st.lines = []; emit("term"); return; }
    if (["help", "ajuda", "?", "ls"].includes(cmd)) return print(c.help);
    if (["whoami", "quem", "sobre", "about"].includes(cmd)) return print(c.whoami);
    if (/^(oi|olá|ola|hi|hello|hey)\b/.test(cmd)) return print(c.hello);
    if (cmd.startsWith("sudo")) return print(c.sudo);
    if (["contato", "contact", "email", "mail"].includes(cmd)) { print(c.contact); goTo("contato"); return; }
    if (["projetos", "portfolio", "portfólio", "work", "trabalhos"].includes(cmd)) { print(c.work); goTo("portfolio"); return; }
    print(c.unknown(cmd.slice(0, 24)));
  }

  /* open / close */
  const setOpen = (next) => {
    st.open = next;
    laptop.setAttribute("aria-pressed", String(!next));
    laptop.setAttribute("aria-label", next ? t().close : t().open);
    emit("open", next);
    if (next) boot(); else { typing++; }
  };
  const toggle = () => setOpen(!st.open);
  laptop.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") e.preventDefault(); }); // keep focus off, so typed Enter doesn't toggle
  laptop.addEventListener("click", toggle);
  addEventListener("langchange", () => { laptop.setAttribute("aria-label", st.open ? t().close : t().open); if (st.open) boot(); });

  /* typing: only while the hero is on screen and nothing else wants the keys */
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; emit("visible", visible); }, { threshold: 0.2 }).observe(stage);
  addEventListener("keydown", (e) => {
    if (!st.open || !visible || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target;
    if (el !== document.body && el !== laptop) return;
    const k = e.key.toLowerCase();
    if (el === laptop && (k === "enter" || k === " ")) return; // keyboard users toggle the lid
    let v = st.input;
    if (k === "backspace") { if (!v) return; v = v.slice(0, -1); }
    else if (k === "enter") { if (!v) return; typing++; e.preventDefault(); press(k); st.input = ""; run(v); return; }
    else if (e.key.length === 1) {
      if (k === " " && !v) return; // leave space-to-scroll alone until they start typing
      if (v.length >= 28) return;
      if (!v) typing++; // interrupt the intro
      v += e.key;
    } else { press(k); return; }
    e.preventDefault();
    press(k);
    setInput(v);
  });

  /* CSS view (fallback, and the accessible control in both modes) */
  cssView({ stage, laptop, st, on });

  /* WebGL view */
  const probe = document.createElement("canvas");
  const gl = !!(probe.getContext("webgl2") || probe.getContext("webgl"));
  if (gl) {
    stage.classList.add("is-gl");
    import("./laptop3d.js")
      .then(({ mount3d }) => mount3d({ stage, st, on, toggle, reduced }))
      .catch((err) => { console.warn("3D laptop unavailable", err); stage.querySelector(".laptop3d")?.remove(); stage.classList.remove("is-gl"); });
  }

  setTimeout(() => setOpen(true), reduced ? 0 : 900);
}

function cssView({ stage, laptop, st, on }) {
  const term = stage.querySelector(".term");
  const keysEl = stage.querySelector(".laptop__keys");
  const keyMap = new Map();
  for (const row of ROWS) {
    const r = document.createElement("span");
    r.className = "laptop__row";
    for (const k of row) {
      const key = document.createElement("span");
      key.className = "laptop__key";
      key.style.flexGrow = WIDE[k] ?? 1;
      if (k === "arrowup") key.classList.add("is-half");
      r.append(key);
      if (!keyMap.has(k)) keyMap.set(k, []);
      keyMap.get(k).push(key);
    }
    keysEl.append(r);
  }
  keysEl.addEventListener("animationend", (e) => e.target.classList.remove("is-down"));

  const prompt = document.createElement("span");
  prompt.className = "term__line term__line--cmd term__prompt";
  const promptText = document.createTextNode("");
  const caret = document.createElement("b");
  caret.className = "term__caret";
  prompt.append(promptText, caret);
  const cache = new WeakMap();

  on((type, data) => {
    if (type === "open") laptop.classList.toggle("is-open", data);
    if (type === "key") {
      for (const el of keyMap.get(data?.toLowerCase()) ?? []) {
        el.classList.remove("is-down"); void el.offsetWidth; el.classList.add("is-down");
      }
    }
    if (type === "term") { // reuse nodes so only new lines animate in
      const nodes = st.lines.map((ln) => {
        let l = cache.get(ln);
        if (!l) {
          l = document.createElement("span");
          l.className = `term__line term__line--${ln.kind}`;
          l.textContent = ln.text;
          cache.set(ln, l);
        }
        return l;
      });
      term.replaceChildren(...nodes, prompt);
    }
    if (type === "term" || type === "input") promptText.data = st.input;
  });
}

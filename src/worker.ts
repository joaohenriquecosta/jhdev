import { EmailMessage } from "cloudflare:email";

interface Env {
  ASSETS: Fetcher;
  MAILER: SendEmail;
  MAIL_FROM: string;
  MAIL_TO_HEADER: string;
  MAIL_DEST: string;
}

const MAX = { name: 120, email: 200, subject: 160, message: 5000 };
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim().slice(0, max) : "";

// Header-safe: strip CR/LF so visitors cannot inject headers.
const oneLine = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

const encodeHeader = (s: string) => `=?UTF-8?B?${b64(s)}?=`;

const wrap76 = (s: string) => s.replace(/.{1,76}/g, "$&\r\n");

function buildMime(env: Env, f: { name: string; email: string; subject: string; message: string; lang: string; ip: string }) {
  const subject = `[joaohenriquecosta.dev] ${f.subject || "Nova mensagem"} · ${f.name}`;
  const body = [
    `Nome: ${f.name}`,
    `Email: ${f.email}`,
    `Assunto: ${f.subject || "(sem assunto)"}`,
    `Idioma da página: ${f.lang}`,
    "",
    f.message,
    "",
    "—",
    `Enviado pelo formulário de joaohenriquecosta.dev · ${new Date().toISOString()} · ${f.ip}`,
  ].join("\n");

  const domain = env.MAIL_FROM.split("@")[1];
  return [
    `From: ${encodeHeader("joaohenriquecosta.dev")} <${env.MAIL_FROM}>`,
    `To: <${env.MAIL_TO_HEADER}>`,
    `Reply-To: ${encodeHeader(f.name)} <${f.email}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(body)),
  ].join("\r\n");
}

async function contact(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);

  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ ok: false, error: "origin" }, 403);
  }

  let data: Record<string, unknown>;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }

  // Bots: honeypot field filled, or form submitted faster than a human could.
  const started = Number(data.t);
  if (clean(data.website, 200) || !Number.isFinite(started) || Date.now() - started < 2500) {
    return json({ ok: true });
  }

  const f = {
    name: oneLine(clean(data.name, MAX.name)),
    email: oneLine(clean(data.email, MAX.email)),
    subject: oneLine(clean(data.subject, MAX.subject)),
    message: clean(data.message, MAX.message),
    lang: data.lang === "en" ? "en" : "pt",
    ip: request.headers.get("cf-connecting-ip") ?? "?",
  };

  if (f.name.length < 2 || !EMAIL_RE.test(f.email) || f.message.length < 10) {
    return json({ ok: false, error: "fields" }, 422);
  }

  try {
    const raw = buildMime(env, f);
    await env.MAILER.send(new EmailMessage(env.MAIL_FROM, env.MAIL_DEST, raw));
    return json({ ok: true });
  } catch (err) {
    console.error("contact send failed", err);
    return json({ ok: false, error: "send" }, 502);
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === "www.joaohenriquecosta.dev") {
      url.hostname = "joaohenriquecosta.dev";
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname === "/api/contact") return contact(request, env);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

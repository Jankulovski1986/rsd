import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) {
    // Fallback: log-only transport (no SMTP needed)
    return nodemailer.createTransport({ jsonTransport: true });
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = String(process.env.SMTP_SECURE ?? "false").toLowerCase() === "true"; // true only for 465
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export function mailer() {
  if (!transporter) transporter = createTransport();
  return transporter!;
}

export async function sendInvite(email: string, link: string) {
  const from = process.env.MAIL_FROM || "no-reply@example.com";
  const html = `
    <p>Hallo,</p>
    <p>Sie wurden für <b>Ausschreibungsliste R.S.D. plus</b> eingeladen.</p>
    <p><a href="${link}">Klicken Sie hier, um Ihr Passwort zu setzen</a> (Link 24h gültig).</p>
    <p>Falls der Link nicht klickbar ist: ${link}</p>`;
  await mailer().sendMail({ from, to: email, subject: "Ihre Einladung", html, text: html.replace(/<[^>]+>/g, "") });
}

export async function sendReset(email: string, link: string) {
  const from = process.env.MAIL_FROM || "no-reply@example.com";
  const html = `
    <p>Passwort zurücksetzen für <b>Ausschreibungsliste R.S.D. plus</b></p>
    <p><a href="${link}">Neues Passwort setzen</a> (Link 60 Min. gültig).</p>
    <p>Falls der Link nicht klickbar ist: ${link}</p>`;
  await mailer().sendMail({ from, to: email, subject: "Passwort zurücksetzen", html, text: html.replace(/<[^>]+>/g, "") });
}


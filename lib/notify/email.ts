import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

export type EmailMessage = { to: string; subject: string; heading: string; body: string; ctaHref?: string; ctaLabel: string };

/** Branded transactional email; silently skipped when RESEND_API_KEY is unset. */
export async function sendEmail(msg: EmailMessage): Promise<void> {
  const apiKey = env.resend.apiKey;
  if (!apiKey) return;
  const url = msg.ctaHref ? new URL(msg.ctaHref, env.appUrl).toString() : env.appUrl;
  const logo = new URL("/brand/logo.png", env.appUrl).toString();
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = `<!doctype html><html><body style="margin:0;background:#F4F1DE;font-family:Inter,Arial,sans-serif;color:#1e2736">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
  <tr><td style="background:#1B263B;padding:20px 28px"><img src="${logo}" alt="Lumora Solar" height="44" style="background:#fff;border-radius:8px;padding:4px"/></td></tr>
  <tr><td style="padding:28px"><h1 style="margin:0 0 12px;font-size:20px;color:#1B263B">${esc(msg.heading)}</h1>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.6">${esc(msg.body)}</p>
  <a href="${url}" style="display:inline-block;background:#1B263B;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${esc(msg.ctaLabel)}</a>
  </td></tr><tr><td style="border-top:3px solid #C6A75E;padding:16px 28px;font-size:12px;color:#586274">Lumora Solar Private Limited · Raipur, Chhattisgarh</td></tr>
  </table></td></tr></table></body></html>`;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from: env.resend.from, to: msg.to, subject: msg.subject, html });
    if (error) console.warn("[email] send failed", error.message);
  } catch (err) {
    console.warn("[email] send error", err);
  }
}

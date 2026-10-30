/** Looks like a credential: never sent or kept, and the person is told which text holds it. Shared by the client checks and
 * the domain, so a pasted record cannot come in by any path (paste box, backup import) while it holds one. */
const SECRET = /\bsk-[A-Za-z0-9_-]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bAKIA[0-9A-Z]{16}\b|\bxox[abpr]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bAIza[0-9A-Za-z_-]{30,}/;
export const secretLike = (text: string) => SECRET.test(text);
/** Hides each credential-like part of a text (a private key block whole) so the rest can be kept; count says how many. */
export function redactSecrets(text: string): { text: string; count: number } {
  let count = 0;
  const hide = () => { count++; return '[가려진 비밀값]'; };
  const out = text.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, hide).replace(new RegExp(SECRET.source, 'g'), hide);
  return { text: out, count };
}

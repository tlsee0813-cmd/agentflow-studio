/** Looks like a credential: never sent or kept, and the person is told which text holds it. Shared by the client checks and
 * the domain, so a pasted record cannot come in by any path (paste box, backup import) while it holds one. */
const SECRET = /\bsk-[A-Za-z0-9_-]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bAKIA[0-9A-Z]{16}\b|\bxox[abpr]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bAIza[0-9A-Za-z_-]{30,}/;
export const secretLike = (text: string) => SECRET.test(text);

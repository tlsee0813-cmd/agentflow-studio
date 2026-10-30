/** Looks like a credential: never sent or kept, and the person is told which text holds it. Shared by the client checks and
 * the domain, so a pasted record cannot come in by any path (paste box, backup import) while it holds one. */
const SECRET = /\bsk-[A-Za-z0-9_-]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bAKIA[0-9A-Z]{16}\b|\bxox[abpr]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bAIza[0-9A-Za-z_-]{30,}/;
export const secretLike = (text: string) => SECRET.test(text);

const HIDDEN = '[가려진 비밀값]';
// A value already hidden is not hidden again (and not counted twice).
const NOT_HIDDEN = '(?!\\[가려진 비밀값\\])';
// A value that only names where the secret comes from (an environment variable, a template) is not a secret itself.
const NOT_REF = `${NOT_HIDDEN}(?![$%{<]|process\\.|os\\.environ|import\\.meta|env[.(\\[])`;
const NAME = '(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIALS?)', LOWER = '(?:password|passwd|passphrase|secret|token|(?:api|access|private|secret)[_-]?key|credentials?)';
/** What redactSecrets hides, beyond what secretLike refuses: a session can hold any credential the person pasted into the tool,
 * and what is taken from it is kept and read by the AI without a person reading it first. Each pattern's `keep` group (a name,
 * an `Authorization: Bearer ` or a URL's user) stays, so the record still says what was there; the rest is hidden. These are
 * broader than secretLike on purpose: the paste box refuses on secretLike alone, so ordinary text about keys can still be pasted. */
const HIDE: RegExp[] = [
  // Private key blocks (PEM, OpenSSH, PGP) whole, up to their end line or the end of the text.
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|$)/g,
  // A PuTTY key file's private lines.
  /(?<keep>Private-Lines: *\d+[ \t]*\r?\n)(?:[A-Za-z0-9+/=]+[ \t]*(?:\r?\n|$))+/g,
  new RegExp(SECRET.source, 'g'),
  // Tokens with a known shape: JWTs, Stripe, npm, GitLab, Hugging Face, Google OAuth, Slack webhooks, Telegram bots.
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b(?:[sr]k_(?:live|test)|whsec)_[A-Za-z0-9]{10,}/g,
  /\bnpm_[A-Za-z0-9]{20,}/g, /\bglpat-[A-Za-z0-9_-]{16,}/g, /\bhf_[A-Za-z0-9]{20,}/g, /\bya29\.[A-Za-z0-9_-]{20,}/g,
  /(?<keep>https:\/\/hooks\.slack\.com\/)(?:services|workflows|triggers)\/[A-Za-z0-9_/-]+/g,
  /\b\d{6,12}:AA[A-Za-z0-9_-]{30,}/g,
  // An Authorization header's value, and a bearer or basic credential anywhere (one with a digit, so prose stays).
  new RegExp(`(?<keep>\\bAuthorization["']?\\s*[:=]\\s*["']?(?:(?:Bearer|Basic|Token|Bot|Digest)\\s+)?)${NOT_REF}(?!(?:Bearer|Basic|Token|Bot|Digest)\\b)[^\\s"',;]{6,}`, 'gi'),
  new RegExp(`(?<keep>\\b(?:Bearer|Basic)\\s+)${NOT_HIDDEN}(?=[A-Za-z0-9._~+/-]*\\d)[A-Za-z0-9._~+/-]{16,}=*`, 'gi'),
  // A password in a URL (scheme://user:password@host).
  /(?<keep>\b[a-z][a-z0-9+.-]{0,20}:\/\/[^\s:@/]{1,200}:)(?!\[가려진 비밀값\])[^\s@/]+(?=@)/gi,
  // Settings whose name says what they hold: KEY=, DB_PASSWORD: … (.env, shell, YAML), "apiKey": "…" (JSON, code), token=…
  new RegExp(`(?<keep>\\b[A-Z0-9_]{0,40}${NAME}[A-Z0-9_]{0,40}["']?[ \\t]*[:=][ \\t]*["']?)${NOT_REF}(?!\\d{1,6}\\b)[^\\s"'\`]+`, 'g'),
  new RegExp(`(?<keep>\\b[A-Za-z0-9_]{0,40}${LOWER}["']?[ \\t]*[:=][ \\t]*["'\`])${NOT_REF}[^"'\`\\s]{4,}(?=["'\`])`, 'gi'),
  new RegExp(`(?<keep>\\b[A-Za-z0-9_]{0,40}${LOWER}[ \\t]*=[ \\t]*)${NOT_REF}(?=[^\\s"'&;,]*\\d)[^\\s"'&;,]{6,}`, 'gi')
];
/** Hides each credential-like part of a text (a private key block whole) so the rest can be kept; count says how many. */
export function redactSecrets(text: string): { text: string; count: number } {
  let count = 0, out = text;
  // The last argument is the named groups when the pattern has any (its `keep`), else the whole text.
  for (const re of HIDE) out = out.replace(re, (...m) => { count++; const g = m.at(-1); return `${typeof g === 'object' && g?.keep || ''}${HIDDEN}`; });
  return { text: out, count };
}

/** Looks like a credential: never sent or kept, and the person is told which text holds it. Shared by the client checks and
 * the domain, so a pasted record cannot come in by any path (paste box, backup import) while it holds one. */
const SECRET = /\bsk-[A-Za-z0-9_-]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bAKIA[0-9A-Z]{16}\b|\bxox[abpr]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bAIza[0-9A-Za-z_-]{30,}/;
export const secretLike = (text: string) => SECRET.test(text);

const HIDDEN = '[가려진 비밀값]';
// A value already hidden is not hidden again (and not counted twice).
const NOT_HIDDEN = '(?!\\[가려진 비밀값\\])';
// A value that only names where the secret comes from (an environment variable, a template) is not a secret itself.
const NOT_REF = `${NOT_HIDDEN}(?![$%{<]|process\\.|os\\.environ|import\\.meta|env[.(\\[])`;
// A value: no spaces, quotes, brackets or '&' (code, calls, prose and the next query parameter are not part of it), not a path.
const V = `[^\\s"'\`,;&()<>]`, NOT_PATH = '(?![./~])';
// A key, secret or token's value: letters with digits (8 or more), or long (16 or more); a camelCase word with no digit is a name.
const KEY_VALUE = `${NOT_REF}${NOT_PATH}(?![a-z]+(?:[A-Z][a-z]*)+(?!${V}))(?=${V}*[A-Za-z])(?:(?=${V}*\\d)${V}{8,}|${V}{16,})`;
// A password's value: letters with digits (6 or more), or one lowercase word of 8 or more (a passphrase), but not a type or a
// placeholder. A password may hold '&'.
const P = `[^\\s"'\`,;()<>]`;
const PASSWORD_VALUE = `${NOT_REF}${NOT_PATH}(?!(?:undefined|null|true|false|required|optional|string|number|boolean|none|empty|hidden|password|secret)\\b)(?:(?=${P}*\\d)(?=${P}*[A-Za-z])${P}{6,}|[a-z][a-z!@#$%^&*_+-]{7,}(?![A-Za-z0-9.(]))`;
// A setting named for what it holds, its name ending in the word (apiKey, DB_PASSWORD, x-api-key, client_secret, "token"), then
// ':' or '=' (not '==' or '::'), maybe quoted: .env, shell, YAML, JSON, code, headers. MAX_TOKENS or API_KEY_NAME do not end so.
const SETTING = (word: string) => `(?<keep>\\b[A-Za-z0-9_.-]{0,40}?${word}["']?[ \\t]*[:=](?![=:])[ \\t]*["'\`]?)`;
/** What redactSecrets hides, beyond what secretLike refuses: a session can hold any credential the person pasted into the tool,
 * and what is taken from it is kept and read by the AI without a person reading it first. Each pattern's `keep` group (a name,
 * an `Authorization: Bearer ` or a URL's user) stays, so the record still says what was there; the rest is hidden. These are
 * broader than secretLike on purpose: the paste box refuses on secretLike alone, so ordinary text about keys can still be pasted.
 * Values are told by their shape as well as their name, so limits (MAX_TOKENS=4096), names (SORT_KEY=createdAt), paths and prose
 * stay readable. */
const HIDE: RegExp[] = [
  // Private key blocks (PEM, OpenSSH, PGP) whole, up to their end line or the end of the text.
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|$)/g,
  // A PuTTY key file's private lines.
  /(?<keep>Private-Lines: *\d+[ \t]*\r?\n)(?:[A-Za-z0-9+/=]+[ \t]*(?:\r?\n|$))+/g,
  new RegExp(SECRET.source, 'g'),
  // Tokens with a known shape: JWTs, Stripe, npm, GitLab, Hugging Face, Google OAuth, Slack webhooks, Telegram and Discord bots.
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b(?:[sr]k_(?:live|test)|whsec)_[A-Za-z0-9]{10,}/g,
  /\bnpm_[A-Za-z0-9]{20,}/g, /\bglpat-[A-Za-z0-9_-]{16,}/g, /\bhf_[A-Za-z0-9]{20,}/g, /\bya29\.[A-Za-z0-9_-]{20,}/g,
  /(?<keep>https:\/\/hooks\.slack\.com\/)(?:services|workflows|triggers)\/[A-Za-z0-9_/-]+/g,
  /\b\d{6,12}:AA[A-Za-z0-9_-]{30,}/g,
  /\b[MN][A-Za-z\d_-]{17,27}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,}/g,
  // An Authorization header's value: after a scheme anything token-like, without one only a value shaped like a key.
  new RegExp(`(?<keep>\\bAuthorization["']?\\s*[:=]\\s*["']?(?:Bearer|Basic|Token|Bot|Digest)\\s+)${NOT_REF}[^\\s"',;]{8,}`, 'gi'),
  new RegExp(`(?<keep>\\bAuthorization["']?\\s*[:=]\\s*["']?)(?!(?:Bearer|Basic|Token|Bot|Digest)\\b)${KEY_VALUE}`, 'gi'),
  // A bearer or basic credential anywhere: the scheme as written, a value with a digit, not a file path.
  new RegExp(`(?<keep>\\b(?:Bearer|Basic) )${NOT_HIDDEN}(?![^\\s]*/[^\\s]*\\.)(?=[A-Za-z0-9._~+/-]*\\d)[A-Za-z0-9._~+/-]{16,}=*`, 'g'),
  // A password in a URL (scheme://user:password@host), and on a command line (mysql -pPASSWORD, --password VALUE).
  /(?<keep>\b[a-z][a-z0-9+.-]{0,20}:\/\/[^\s:@/]{1,200}:)(?!\[가려진 비밀값\])[^\s@/]+(?=@)/gi,
  /(?<keep>\bmysql(?:dump|admin)?\b[^\n]*?\s-p)(?!\[가려진 비밀값\])(?=\S*\d)\S{6,}/g,
  new RegExp(`(?<keep>--password[= ]["']?)${NOT_REF}[^\\s"']{4,}`, 'g'),
  // Settings whose name says what they hold.
  new RegExp(`${SETTING('(?:password|passwd|passphrase|pwd)')}${PASSWORD_VALUE}`, 'gi'),
  new RegExp(`${SETTING('(?:key|secret|token|credentials?)')}${KEY_VALUE}`, 'gi')
];
/** Hides each credential-like part of a text (a private key block whole) so the rest can be kept; count says how many. */
export function redactSecrets(text: string): { text: string; count: number } {
  let count = 0, out = text;
  // The last argument is the named groups when the pattern has any (its `keep`), else the whole text.
  for (const re of HIDE) out = out.replace(re, (...m) => { count++; const g = m.at(-1); return `${typeof g === 'object' && g?.keep || ''}${HIDDEN}`; });
  return { text: out, count };
}

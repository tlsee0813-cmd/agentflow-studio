/** Looks like a credential: never sent or kept, and the person is told which text holds it. Shared by the client checks and
 * the domain, so a pasted record cannot come in by any path (paste box, backup import) while it holds one. */
const SECRET = /\bsk-[A-Za-z0-9_-]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bAKIA[0-9A-Z]{16}\b|\bxox[abpr]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bAIza[0-9A-Za-z_-]{30,}/;
export const secretLike = (text: string) => SECRET.test(text);

const HIDDEN = '[가려진 비밀값]';
// A value already hidden is not hidden again (and not counted twice).
const NOT_HIDDEN = '(?!\\[가려진 비밀값\\])';
// A value that only names where the secret comes from (an environment variable, a template) is not a secret itself.
const NOT_REF = `${NOT_HIDDEN}(?![$%{<]|process\\.|os\\.environ|import\\.meta|env[.(\\[])`;
const REF = /^(?:\[가려진|[$%{<]|process\.|os\.environ|import\.meta|env[.(\[]|secrets\.)|\$\{|\{\{/;

/* ---------- what a value after a name is: told in code, not in one pattern (a pattern that weighs a value's shape backtracks) ---------- */
// Words a value can be without holding a secret: types, empty values, placeholders and words of prose.
const PLAIN = /^(?:string|str|number|int|integer|float|bool|boolean|bytes|any|unknown|object|none|null|nil|undefined|true|false|required|optional|empty|hidden|password|passwd|secret|token|key|value|option|flag|argument|arg|parameter|param|prompt|field|input|text|here|yes|no)$/i;
// A type written where a value could be (password: SecretStr, password: Annotated[str, Form()]).
const TYPE = /^(?:SecretStr|SecretBytes|Optional|Annotated|Union|Literal|List|Dict|Field|Mapped|Column|Option|Record|Partial|Readonly|Array|Promise|Buffer|Uint8Array)\b/;
// One name in code: camelCase, PascalCase or UPPER_SNAKE (createdAt, hashedPassword, DATABASE_PASSWORD), and lower_snake
// (hashed_password), which a secret set in a file can also be (super_secret_value).
const IDENT = /^(?:[a-z]+(?:[A-Z][a-z]+)+\d{0,2}|(?:[A-Z][a-z]+){2,}\d{0,2}|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)$/, SNAKE = /^[a-z]+(?:_[a-z]+)+$/;
// Code: a member path (config.openai.apiKey, settings.SECRET_KEY, req.headers.authorization?.split), maybe called or indexed, or a
// call of a named function with its arguments (crypto.randomBytes(32), create_access_token(identity=user.id), getToken()).
const MEMBER = /^(?:new\s+)?[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)+(?:[([?]|$)/, CALL = /^[A-Za-z_$][\w$]{2,}\(.*\)/;
const PATH_SHAPE = /^(?:[A-Za-z]:[\\/]|\\\\|\.{1,2}[\\/]|~[\\/]|\/)?(?:[\w.@ -]+[\\/])+[\w.@ -]*$/;
/** A piece of a value that is not a word: long, and mixing letter case or letters and digits (FAKEfakeFAKEfake, a0b1c2d3e4f5). */
const random = (s: string) => s.length >= 12 && (+/\d/.test(s) + +/[a-z]/.test(s) + +/[A-Z]/.test(s)) >= 2;
/** A file path (/etc/ssl/key.pem, ./certs/dev.key, C:\keys\a.pem, uploads/user123/avatar.png), not a key that holds a '/'. */
const pathLike = (v: string) => PATH_SHAPE.test(v) && !v.split(/[\\/]/).some(random);
/** A dotted or colon-joined name of words (settings.profile.title, agentflow.autosync.v1), not a key. */
const wordy = (v: string) => /[.:/]/.test(v) && v.split(/[.:/]/).every(s => s.length <= 20 && !random(s));
/** A name whose value is a credential whatever it looks like: a password, a secret, an environment setting, a key or token said to
 * be one (apiKey, x-api-key, accessToken, _authToken). Other names (key, cacheKey, sortKey, nextToken) are as often code. */
const STRONG = /pass|pwd|secret|credential|(?:api|access|private|auth|client|master|encryption|signing|service|admin|app|bot|refresh|session|bearer|id|github|gitlab|slack|discord|npm|hf|openai|anthropic|stripe|license)[_-]?(?:key|token)$/i;
/** The part of a value that is a secret and what follows it, or null when it holds none. raw: as written after the name (quoted:
 * between its quotes); strong: the name says it holds one; config: a setting on a line of its own (.env, YAML), not code or prose. */
function secretPart(raw: string, quoted: boolean, strong: boolean, config: boolean): [string, string] | null {
  let v = raw, rest = '';
  // Unquoted, what ends a statement or closes a bracket opened before the value is not part of it.
  if (!quoted) for (let c = v.at(-1); c && /[,;)\]}]/.test(c); c = v.at(-1)) {
    const open = ({ ')': '(', ']': '[', '}': '{' } as Record<string, string>)[c];
    if (open && v.split(open).length > v.split(c).length - 1) break;
    rest = c + rest; v = v.slice(0, -1);
  }
  if (!v || REF.test(v) || !/[A-Za-z0-9]/.test(v) || PLAIN.test(v) || TYPE.test(v) || IDENT.test(v)) return null;
  if (SNAKE.test(v) && !(strong && (quoted || config))) return null;
  if (!quoted && (MEMBER.test(v) || CALL.test(v))) return null;
  if (pathLike(v) || /^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return null;
  if (/^\d+$/.test(v)) return v.length >= (strong ? 6 : 10) ? [v, rest] : null;
  const digit = /\d/.test(v), letter = /[A-Za-z]/.test(v), symbol = /[^A-Za-z0-9]/.test(v), mixed = /[a-z]/.test(v) && /[A-Z]/.test(v);
  // Said to be a credential: a quoted or set value of some length is one (keyboardcat, changeme); in code or prose a word with no
  // digit or sign is a name (password: newpassword) or a word.
  if (strong) return (quoted || config ? v.length >= 6 || (v.length >= 4 && (digit || symbol)) : v.length >= 6 && (digit || symbol || (v.length >= 16 && mixed))) ? [v, rest] : null;
  // Another name: only a value that looks made by a machine (letters with digits, or long and mixed), not words joined.
  return v.length >= 8 && !wordy(v) && ((digit && letter) || (v.length >= 16 && mixed)) ? [v, rest] : null;
}
// A name ending in what it holds (apiKey, DB_PASSWORD, x-api-key, client_secret, "token", EMAIL_PASS), then ':', '=', ':=' or '=>'
// (not '==' or '::'), maybe quoted (JSON escaped too): .env, shell, YAML, JSON, code, PHP, Go, headers. MAX_TOKENS does not end so.
const SETTING = new RegExp(`(?<keep>\\b(?<name>[A-Za-z0-9_.-]{0,40}?(?:password|passwd|passphrase|pwd|pass|secret|token|key|credentials?))\\\\?["']?[ \\t]*(?::=|=>|[:=](?![=:]))[ \\t]*)(?:(?<q>\\\\?["'\`])(?<qv>(?:(?!\\k<q>)[^\\n]){1,500}?)\\k<q>|(?<uv>[^\\s"'\`]{1,2000}))`, 'gi');
// An Authorization header's value with no scheme before it.
const AUTH = /(?<keep>\bAuthorization\\?["']?\s*[:=]\s*)(?:(?<q>\\?["'])(?!(?:Bearer|Basic|Token|Bot|Digest)\s)(?<qv>(?:(?!\k<q>)[^\n]){1,2000}?)\k<q>|(?!(?:Bearer|Basic|Token|Bot|Digest)\s)(?<uv>[^\s"'`]{1,2000}))/gi;
/** What redactSecrets hides, beyond what secretLike refuses: a session can hold any credential the person pasted into the tool,
 * and what is taken from it is kept and read by the AI without a person reading it first. Each pattern's `keep` group (a name,
 * an `Authorization: Bearer ` or a URL's user) stays, so the record still says what was there; the rest is hidden. These are
 * broader than secretLike on purpose: the paste box refuses on secretLike alone, so ordinary text about keys can still be pasted.
 * Values are told by their shape as well as their name, so limits (MAX_TOKENS=4096), names (SORT_KEY=createdAt), code
 * (token = authHeader.split(" ")[1]), paths and prose stay readable. */
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
  /\b[MNO][A-Za-z\d_-]{17,27}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,}/g,
  // An Authorization header's value after a scheme: anything token-like.
  new RegExp(`(?<keep>\\bAuthorization\\\\?["']?\\s*[:=]\\s*\\\\?["']?(?:Bearer|Basic|Token|Bot|Digest)\\s+)${NOT_REF}[^\\s"'\\\\,;]{8,}`, 'gi'),
  // A password in a URL (scheme://user:password@host, the user may be empty), and on a command line (mysql -pPASSWORD).
  /(?<keep>\b[a-z][a-z0-9+.-]{0,20}:\/\/[^\s:@/]{0,200}:)(?!\[가려진 비밀값\])[^\s@/]+(?=@)/gi,
  /(?<keep>\bmysql(?:dump|admin)?\b[^\n]*?\s-p)(?!\[가려진 비밀값\])(?=\S*[A-Za-z])(?=\S*\d)\S{6,}/g,
  /(?<keep>\bcurl\b[^\n]*?\s(?:-u|--user)[ =]?["']?[^\s:"'@]{1,100}:)(?!\[가려진 비밀값\])[^\s"'@]{4,}/g
];
// Patterns whose value is weighed in code (secretPart) before it is hidden.
type Weighed = { re: RegExp; strong(g: Record<string, string | undefined>): boolean };
const WEIGHED: Weighed[] = [
  { re: AUTH, strong: () => true },
  // A bearer or basic credential anywhere: the scheme as written, a value with a digit (not prose), not a file path.
  { re: /(?<keep>\b(?:Bearer|Basic) )(?<uv>(?=[A-Za-z0-9._~+/-]*\d)[A-Za-z0-9._~+/-]{16,2000}=*)/g, strong: () => true },
  { re: /(?<keep>--password[= ]["']?)(?<uv>[^\s"']{1,500})/g, strong: () => true },
  { re: SETTING, strong: g => STRONG.test(g.name ?? '') || /^[A-Z0-9_]+$/.test(g.name ?? '') }
];
/** Hides each credential-like part of a text (a private key block whole) so the rest can be kept; count says how many. */
export function redactSecrets(text: string): { text: string; count: number } {
  let count = 0, out = text;
  // The last argument is the named groups when the pattern has any (its `keep`), else the whole text.
  for (const re of HIDE) out = out.replace(re, (...m) => { count++; const g = m.at(-1); return `${typeof g === 'object' && g?.keep || ''}${HIDDEN}`; });
  for (const { re, strong } of WEIGHED) out = out.replace(re, (...m) => {
    const g = m.at(-1) as Record<string, string | undefined>, all = m[0] as string, at = m.at(-3) as number, src = m.at(-2) as string;
    const quoted = g.qv !== undefined, raw = g.qv ?? g.uv ?? '';
    // A value in a query string ends at the next parameter; a setting alone on its line is a setting, not code or prose (only the
    // text just before it is looked at: a long text is not read again for each name in it).
    const query = /[?&]/.test(src[at - 1] ?? ''), near = src.slice(Math.max(0, at - 80), at), line = near.slice(near.lastIndexOf('\n') + 1);
    const cut = query && !quoted ? raw.search(/[&#]/) : -1, value = cut > 0 ? raw.slice(0, cut) : raw;
    const config = /^[ \t]*(?:export[ \t]+|set[ \t]+|-[ \t]+)?["']?$/.test(line) || /^[A-Z][A-Z0-9_]*$/.test(g.name ?? '');
    const part = secretPart(value, quoted, strong(g), config);
    if (!part) return all;
    count++;
    const q = quoted ? g.q ?? '' : '';
    return `${g.keep ?? ''}${q}${HIDDEN}${part[1]}${quoted ? q : ''}${cut > 0 ? raw.slice(cut) : ''}`;
  });
  return { text: out, count };
}

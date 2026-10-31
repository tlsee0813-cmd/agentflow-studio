/** Looks like a credential: never sent or kept, and the person is told which text holds it. Shared by the client checks and
 * the domain, so a pasted record cannot come in by any path (paste box, backup import) while it holds one. */
const SECRET = /\bsk-[A-Za-z0-9_-]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bAKIA[0-9A-Z]{16}\b|\bxox[abpr]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bAIza[0-9A-Za-z_-]{30,}/;
export const secretLike = (text: string) => SECRET.test(text);

const HIDDEN = '[가려진 비밀값]';
// A value already hidden is not hidden again (and not counted twice).
const NOT_HIDDEN = '(?!\\[가려진 비밀값\\])';
// A value that only names where the secret comes from (an environment variable, a template, a placeholder) is not a secret
// itself: one that starts so (os.environ…, $DB_PASSWORD, $_ENV['…'], $request->password) or holds a template (${…}, {{…}}), or a
// placeholder as the whole value (%API_KEY%, %(password)s, {password}, <your-key>). A value that merely starts with $ % { or < (a
// generated password, a WordPress salt) is weighed.
const NOT_REF = `${NOT_HIDDEN}(?![$%{<]|process\\.|os\\.environ|import\\.meta|env[.(\\[])`;
const REF = /^(?:\[가려진|process\.|os\.environ|import\.meta|env[.(\[]|secrets\.|\$[A-Za-z_]\w*(?:$|\[|->|::|\.)|\$\()|\$\{|\{\{|^(?:%[A-Za-z_]\w*%|%\([A-Za-z_]\w*\)[sd]|\{[A-Za-z_][\w.]*\}|<[^<>]{1,60}>)$/;

/* ---------- what a value after a name is: told in code, not in one pattern (a pattern that weighs a value's shape backtracks) ---------- */
// Words a value can be without holding a secret: types, empty values, placeholders, fetch's credentials modes and words of prose.
const PLAIN = /^(?:string|str|number|int|integer|float|bool|boolean|bytes|any|unknown|object|none|null|nil|undefined|true|false|required|optional|empty|hidden|password|passwd|secret|token|key|value|option|flag|argument|arg|parameter|param|prompt|field|input|text|here|yes|no|include|same-origin|omit)$/i;
// A hash, cipher or encoding named where a value could be (비밀번호는 argon2로 해시, password: sha256).
const SCHEME = /^(?:sha-?\d{1,3}|sha3-\d{3}|md5|s?crypt|bcrypt|argon2(?:id|i|d)?|pbkdf2(?:-sha\d{3})?|aes-?\d{3}(?:-[a-z]{2,3})?|[hre]s\d{3}|ed25519|base64(?:url)?|utf-?8)$/i;
// A type written where a value could be (password: SecretStr, password: Annotated[str, Form()]).
const TYPE = /^(?:SecretStr|SecretBytes|Optional|Annotated|Union|Literal|List|Dict|Field|Mapped|Column|Option|Record|Partial|Readonly|Array|Promise|Buffer|Uint8Array)\b/;
// One name in code: camelCase, PascalCase or UPPER_SNAKE (createdAt, hashedPassword, DATABASE_PASSWORD), and lower_snake
// (hashed_password). Where a value is written as it is (quoted, a .env or YAML line) these are what a password can look like too.
const IDENT = /^(?:[a-z]+(?:[A-Z][a-z]+)+\d{0,2}|(?:[A-Z][a-z]+){2,}\d{0,2}|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)$/, SNAKE = /^[a-z]+(?:_[a-z]+)+$/;
// Code: a member path (config.openai.apiKey, settings.SECRET_KEY, req.headers.authorization?.split, Hash::make, $user->password),
// maybe called or indexed, a call of a named function with its arguments (create_access_token(identity=user.id), getToken()), or
// a call whose first argument is quoted (config('SECRET_KEY'), getenv("API_KEY")).
const MEMBER = /^(?:new\s+)?[A-Za-z_$\\][\w$\\]*(?:(?:\??\.|::|->)[A-Za-z_$][\w$]*)+(?:[([?]|$)/, MEMBER_PART = /\??\.|::|->|[([]/;
const CALL = /^[A-Za-z_$][\w$]{2,}\(.*\)$/, OPEN_CALL = /^[A-Za-z_$][\w$.:>-]*\($/;
// A type named after what it holds (access_token: AccessToken, password: PasswordHash), written where a value could be.
const TYPE_END = /(?:Token|Key|Secret|Hash|Str|String|Bytes|Type|Field|Model|Schema|Id|Config|Settings|Header|Credentials?)$/;
const PATH_SHAPE = /^(?:[A-Za-z]:[\\/]|\\\\|\.{1,2}[\\/]|~[\\/]|\/)?(?:[\w.@ -]+[\\/])+[\w.@ -]*$/;
/** A piece of a value that is not a word: long, and mixing letter case or letters and digits (FAKEfakeFAKEfake, a0b1c2d3e4f5). */
const random = (s: string) => s.length >= 12 && (+/\d/.test(s) + +/[a-z]/.test(s) + +/[A-Z]/.test(s)) >= 2;
/** A piece made by a machine, not a name in code: long, letters and digits interleaved again and again (aBcD1234EfGh5678,
 * FAKE0123fake0123), not a name holding a number (Ed25519PrivateKey, OAuth2Session). */
const machine = (s: string) => s.length >= 12 && (s.match(/[A-Za-z](?=\d)|\d(?=[A-Za-z])/g) ?? []).length >= 3;
/** A file path (/etc/ssl/key.pem, ./certs/dev.key, C:\keys\a.pem, uploads/user123/avatar.png), not a key that holds a '/'. */
const pathLike = (v: string) => PATH_SHAPE.test(v) && !v.split(/[\\/]/).some(random);
/** A dotted or colon-joined name of words (settings.profile.title, agentflow.autosync.v1), not a key. */
const wordy = (v: string) => /[.:/]/.test(v) && v.split(/[.:/]/).every(s => s.length <= 20 && !random(s));
/** A name whose value is a credential whatever it looks like: a password, a secret, a key or token said to be one (apiKey,
 * x-api-key, accessToken, _authToken). Other names (key, cacheKey, sortKey, nextToken) are as often code. */
const SECRET_NAME = /pass|pwd|secret|credential|salt|sess(?:ion)?[_-]?id$|(?:api|access|private|auth|client|master|encryption|signing|service|admin|app|bot|refresh|session|bearer|id|github|gitlab|slack|discord|npm|hf|openai|anthropic|stripe|license|sendgrid|mapbox|doppler)[_-]?(?:key|token)$/i;
/** Where a value stands. secret: its name says it holds a credential; env: an environment name that does not (SORT_KEY);
 * literal: written as it is, not code (a .env or YAML line, a query string, a command-line flag, a cookie); lineStart: a setting's
 * name starts the line (an INI or Python assignment too); colon: set with ':' (YAML, or a property in code); keyQuoted: the name
 * is quoted (JSON, a Python dict: a value written as it is there is quoted too); name: the setting's own name; next: the
 * characters after it; dotenv: an environment name set with '=' alone on its line (a .env or shell line, never code); said: the
 * name is said in a sentence (비밀번호는 …, token은 …, password …). */
interface Where { secret: boolean; env: boolean; quoted: boolean; literal: boolean; lineStart: boolean; colon: boolean; keyQuoted: boolean; dotenv: boolean; name: string; next: string; said?: boolean }
const PAIR: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
/** The part of a value that is a secret and what follows it, or null when it holds none. raw: as written after the name (quoted:
 * between its quotes). */
function secretPart(raw: string, w: Where): [string, string] | null {
  let v = raw, rest = '';
  // Unquoted, what ends a statement or closes a bracket opened before the value is not part of it (brackets counted once).
  if (!w.quoted) {
    const n: Record<string, number> = {};
    for (const c of v) if ('()[]{}'.includes(c)) n[c] = (n[c] ?? 0) + 1;
    for (let c = v.at(-1); c && /[,;)\]}]/.test(c); c = v.at(-1)) {
      const open = PAIR[c];
      if (open) { if ((n[open] ?? 0) >= (n[c] ?? 0)) break; n[c]!--; }
      rest = c + rest; v = v.slice(0, -1);
    }
  }
  // A value followed by ',' or ';' on a line of its own is code (a property, a statement), not a setting; so is one left unquoted
  // under a quoted name.
  const literal = w.quoted || (w.literal && !rest), code = !(w.secret && literal) || (w.keyQuoted && !w.quoted);
  if (!v || REF.test(v) || !/[A-Za-z0-9]/.test(v) || PLAIN.test(v) || SCHEME.test(v) || TYPE.test(v) || /^![A-Za-z][\w:-]*$/.test(v)) return null;
  // Under a quoted name (JSON, a dict) a value as written is quoted: a bare name is a variable ("password": user_password). A type
  // followed by its default (api_key: APIKey = Security(…)) is no value either.
  if ((w.keyQuoted && !w.quoted && /^[A-Za-z_$][\w$]*$/.test(v)) || (w.colon && /^[ \t]*=(?!=)/.test(w.next))) return null;
  // A variable passed under its own name (api_key=api_key) is code.
  if (v.toLowerCase() === w.name.toLowerCase() || v.toLowerCase().endsWith(`.${w.name.toLowerCase()}`)) return null;
  // A name in code: camelCase or UPPER_SNAKE wherever it stands unquoted (password: confirmPassword, api_key=OPENAI_API_KEY alone on
  // its line); PascalCase in code, or after ':' when it ends as a type does, since a password can be capitalized so
  // (DB_PASSWORD=MySecretPassword, password: SuperSecret99).
  if (IDENT.test(v) && (code || (!w.quoted && (!/^[A-Z][a-z]/.test(v) || (w.colon && TYPE_END.test(v)))))) return null;
  if (SNAKE.test(v) && (code || !((w.secret || w.env) && literal))) return null;
  // Unquoted, a member path, a call or a call of a quoted argument is code (api_key=os.getenv("…") alone on its line too), except
  // a member path or call on a .env line (DB_PASSWORD=P4ss.w0rd); a dotted value with a machine-made piece is a key (SG.…, dp.st.…).
  if (!w.quoted && ((!w.dotenv && ((MEMBER.test(v) && !v.split(MEMBER_PART).some(machine)) || CALL.test(v))) || (OPEN_CALL.test(v) && /^["'`]/.test(w.next)))) return null;
  if (pathLike(v) || /^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return null;
  const strong = w.secret || w.env;
  // In a sentence what follows a name is as often what the request is about: a file (docker-compose.yml, .env.local), a setting
  // or a route (type=password, /reset-password), or words joined by '-', '_' or '+' (next-auth, confirm-password, cl100k_base,
  // sha256+salt; after a token's name claude-sonnet-4-5 too, while a password's name keeps hunter-22 a password).
  if (w.said && (/^[./]|=|\.[a-z]{1,5}$/.test(v) || (/^[a-z][a-z0-9]*(?:[-_+][a-z0-9]+)+$/i.test(v) && !machine(v) && !(strong && /[-_+]\d+(?![a-z])/i.test(v))))) return null;
  // After a token's or key's name, or an English name and a space, a value unquoted is one only when it looks made by a machine
  // (abcd1234EFGH5678ijkl, a hex digest; FakePass123 mixes case and digits), not a word holding a number (refresh2token).
  if (w.said && !strong && !w.quoted && !machine(v) && !(v.length >= 10 && /\d/.test(v) && /[a-z]/.test(v) && /[A-Z]/.test(v)) && !/^(?=.*\d)(?=.*[a-f])[a-f\d]{16,}$/i.test(v)) return null;
  if (/^\d+$/.test(v)) return v.length >= (strong ? 6 : 10) ? [v, rest] : null;
  const digit = /\d/.test(v), letter = /[A-Za-z]/.test(v), symbol = /[^A-Za-z0-9]/.test(v), mixed = /[a-z]/.test(v) && /[A-Z]/.test(v);
  // Said to be a credential: a value written as it is (keyboardcat, changeme, an INI line) is one from 6 characters, or 4 with a
  // digit or sign; in code or prose a word with no digit or sign is a name (password: newpassword) or a word.
  if (strong) return (literal || (w.lineStart && w.secret) ? v.length >= 6 || (v.length >= 4 && (digit || symbol)) : v.length >= 6 && (digit || symbol || (v.length >= 16 && mixed))) ? [v, rest] : null;
  // Another name: only a value that looks made by a machine (letters with digits, or long and mixed), not words joined.
  return v.length >= 8 && !wordy(v) && ((digit && letter) || (v.length >= 16 && mixed)) ? [v, rest] : null;
}
const QUOTED = `(?<q>\\\\?["'\`])(?<qv>(?:(?!\\k<q>)[^\\n]){1,500}?)\\k<q>`;
// A name ending in what it holds (apiKey, DB_PASSWORD, x-api-key, client_secret, "token", EMAIL_PASS, client-key-data,
// os.environ["X_API_KEY"]), then ':', '=', ':=' or '=>' (not '==' or '::'), maybe quoted (JSON escaped too): .env, shell, YAML,
// JSON, code, PHP, Go, headers, kubeconfig. MAX_TOKENS does not end so.
const SETTING = new RegExp(`(?<keep>\\b(?<name>[A-Za-z0-9_.-]{0,40}?(?:password|passwd|passphrase|pwd|pw|pass|secret|token|key|key_base|key-data|credentials?|sess(?:ion)?_?id))\\\\?["']?\\]?[ \\t]*(?::=|=>|[:=](?![=:]))[ \\t]*)(?:${QUOTED}|(?<uv>[^\\s"'\`]{1,2000}))`, 'gi');
// A value given in a sentence. Unquoted it is ASCII only, so the Korean after it ends it (FakePass123!이고), and it never runs into
// a value hidden already. The name may take a Korean topic, subject or object particle (비밀번호는, token은).
const SAID = `(?:${QUOTED}|(?<uv>[!-~]{1,500})(?![!-~]|가려진 비밀값\\]))`, PARTICLE = '(?:은|는|이|가|을|를)';
// A name said in Korean (비밀번호는 …, 토큰: …, API 키 …); 암호화 (encryption) is no name.
const KOREAN_NAME = new RegExp(`(?<keep>(?<name>비밀\\s?번호|비번|패스워드|암호(?!화)|토큰|시크릿|인증\\s?키|비밀\\s?키|액세스\\s?키|API\\s?키)값?${PARTICLE}?[ \\t]*(?:[:=：][ \\t]*)?)${SAID}`, 'gi');
// An English name followed by a Korean particle (token은 …), or by a space as in a sentence (password …).
const SAID_NAME = new RegExp(`(?<keep>\\b(?<name>[A-Za-z0-9_.-]{0,40}?(?:password|passwd|pwd|pw|secret|token|(?:api|access)[ _-]?key))(?<then>${PARTICLE}[ \\t]*(?:[:=：][ \\t]*)?|[ \\t]+))${SAID}`, 'gi');
// PHP's define('DB_PASSWORD', '…') (wp-config.php): a quoted value is one as written; an unquoted one is code (getenv('…'), a
// constant).
const DEFINE = new RegExp(`(?<keep>\\bdefine\\(\\s*["'](?<name>[A-Za-z0-9_]{0,40}?(?:password|passwd|pass|secret|key|token|salt))["']\\s*,\\s*)(?:${QUOTED}|(?<uv>[^\\s,)"']{1,500}))`, 'gi');
// An Authorization header's name and what sets it (JSON escaped too), and the schemes HIDE takes whole (AUTH_SCHEME weighs the others).
const AUTH_HEAD = `\\bAuthorization\\\\?["']?[ \\t]*[:=][ \\t]*`, AUTH_KNOWN = 'Bearer|Basic|Token|Bot|Digest';
// An Authorization header's value: after a scheme not in AUTH_KNOWN (ApiKey, SSWS, Negotiate; maybe as a parameter, SSWS
// token="…"), and with no scheme at all. A scheme is a word of letters followed by another word; a credential holds digits.
const AUTH_SCHEME = new RegExp(`(?<keep>${AUTH_HEAD}\\\\?["']?(?!(?:${AUTH_KNOWN})\\s)[A-Za-z][A-Za-z-]{1,30}[ \\t]+(?:[A-Za-z_][\\w-]{0,40}=(?!=))?)(?:(?<q>\\\\?["'])(?<qv>(?:(?!\\k<q>)[^\\n]){1,2000}?)\\k<q>|(?<uv>[^\\s"'\\\\,;]{1,2000}))`, 'gi');
const AUTH = new RegExp(`(?<keep>${AUTH_HEAD})(?:(?<q>\\\\?["'])(?![A-Za-z][A-Za-z-]{1,30}\\s)(?<qv>(?:(?!\\k<q>)[^\\n]){1,2000}?)\\k<q>|(?![A-Za-z][A-Za-z-]{1,30}[ \\t]+\\S)(?<uv>[^\\s"'\`]{1,2000}))`, 'gi');
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
  // Tokens with a known shape: JWTs, Stripe, npm, GitLab, Hugging Face, Google OAuth, Groq, SendGrid, Shopify, DigitalOcean,
  // Replicate, Perplexity, Atlassian, Linear, Notion, Slack apps and webhooks, Discord webhooks, Telegram and Discord bots.
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\b(?:[sr]k_(?:live|test)|whsec)_[A-Za-z0-9]{10,}/g,
  /\bnpm_[A-Za-z0-9]{20,}/g, /\bglpat-[A-Za-z0-9_-]{16,}/g, /\bhf_[A-Za-z0-9]{20,}/g, /\bya29\.[A-Za-z0-9_-]{20,}/g, /\bGOCSPX-[\w-]{20,}/g,
  /\bgsk_[A-Za-z0-9]{20,}/g, /\bSG\.[\w-]{16,}\.[\w-]{16,}/g, /\bshp(?:at|ss|ca|pa)_[A-Fa-f0-9]{32}/g, /\bdop_v1_[a-f0-9]{64}/g, /\br8_[A-Za-z0-9]{30,}/g,
  /\bpplx-[A-Za-z0-9]{40,}/g, /\bATATT[\w=-]{20,}/g, /\blin_api_[A-Za-z0-9]{30,}/g, /\bntn_[A-Za-z0-9]{30,}/g, /\bxapp-\d-[A-Z0-9]+-\d+-[a-z0-9]+/g,
  /(?<keep>https:\/\/hooks\.slack\.com\/)(?:services|workflows|triggers)\/[A-Za-z0-9_/-]+/g,
  /(?<keep>https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/)\d+\/[\w-]+/g,
  /\b\d{6,12}:AA[A-Za-z0-9_-]{30,}/g,
  /\b[MNO][A-Za-z\d_-]{17,27}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,}/g,
  // An Authorization header's value after a known scheme: anything token-like.
  new RegExp(`(?<keep>${AUTH_HEAD}\\\\?["']?(?:${AUTH_KNOWN})[ \\t]+)${NOT_REF}[^\\s"'\\\\,;]{8,}`, 'gi'),
  // A password in a URL (scheme://user:password@host, the user may be empty), and on a command line (mysql -pPASSWORD, curl -u).
  // In a URL it runs to the last '@' followed by a host, so a '/' or '@' in it (an unencoded one) is hidden too; a port followed
  // by a path (http://localhost:3000/@me) is no password.
  /(?<keep>\b[a-z][a-z0-9+.-]{0,20}:\/\/[^\s:@/"'`,]{0,200}:)(?!\[가려진 비밀값\])(?!\d{1,5}(?:[/?#]|$))[^\s"'`]{1,500}(?=@[A-Za-z0-9.-]+(?::\d{1,5})?(?:[/?#"'`\s,;)]|$))/gi,
  /(?<keep>\bmysql(?:dump|admin)?\b[^\n]{0,500}?\s-p)(?!\[가려진 비밀값\])(?=\S*[A-Za-z])(?=\S*\d)\S{6,}/g,
  /(?<keep>\bcurl\b[^\n]{0,500}?\s(?:-u|--user)[ =]?["']?[^\s:"'@]{1,100}:)(?!\[가려진 비밀값\])[^\s"'@]{4,}/g
];
// Patterns whose value is weighed in code (secretPart) before it is hidden. where: what the match says of its value; setting: a
// name alone on its line makes its value written as it is (a header name alone on its line is as often a property in code:
// Authorization: this.auth.getToken()).
type Groups = Record<string, string | undefined>;
interface Weighed { re: RegExp; where(g: Groups): { secret: boolean; env: boolean; literal: boolean }; setting?: boolean; said?: boolean; min?: number }
const WEIGHED: Weighed[] = [
  // After a scheme of its own a credential is long (an API key, a Kerberos ticket); a short word is prose (Authorization: via OAuth2).
  { re: AUTH_SCHEME, min: 16, where: () => ({ secret: true, env: false, literal: false }) },
  { re: AUTH, where: () => ({ secret: true, env: false, literal: false }) },
  // A bearer or basic credential anywhere: the scheme as written, a value with a digit (not prose), not a file path.
  { re: /(?<keep>\b(?:Bearer|Basic) )(?<uv>(?=[A-Za-z0-9._~+/-]*\d)[A-Za-z0-9._~+/-]{16,2000}=*)/g, where: () => ({ secret: true, env: false, literal: false }) },
  // A flag that names a credential, its value after '=' or a space, or as the next element of an args array (an MCP server's
  // config: "--api-key", "…"). --max-tokens, --token-file and --password-stdin hold none.
  { re: /(?<keep>(?<![\w-])--(?<name>[\w-]{0,40}?(?:password|passwd|secret|token|api[-_]?key|access[-_]?key))(?:[= ][ \t]*["']?|\\?["'][ \t]*,[ \t]*\\?["']))(?<uv>[^\s"'\\]{1,500})/gi,
    where: () => ({ secret: true, env: false, literal: true }) },
  // Other command lines that take a password as an argument, aws configure's prompt, Windows' setx NAME value, and an XML element
  // that holds one (Maven's settings.xml, NuGet).
  { re: /(?<keep>\b(?:sshpass\b[^\n]{0,100}?\s-p|redis-cli\b[^\n]{0,200}?\s-a|docker[ \t]+login\b[^\n]{0,200}?\s-p)[ \t]*["']?)(?<uv>[^\s"']{1,500})/g,
    where: () => ({ secret: true, env: false, literal: true }) },
  { re: /(?<keep>\bAWS Secret Access Key \[[^\]\n]{0,40}\]:[ \t]*)(?<uv>\S{1,500})/g, where: () => ({ secret: true, env: false, literal: true }) },
  { re: /(?<keep>\bsetx[ \t]+(?<name>[A-Za-z0-9_]{0,40}?(?:password|passwd|pass|pwd|secret|token|key))[ \t]+["']?)(?<uv>[^\s"']{1,500})/gi,
    where: () => ({ secret: true, env: false, literal: true }) },
  { re: /(?<keep><(?<name>[\w:.-]{0,40}?(?:password|passwd|passphrase|secret|token|apikey|api_key|api-key))>)(?<uv>[^<\n]{1,500})(?=<\/)/gi,
    where: () => ({ secret: true, env: false, literal: true }) },
  { re: DEFINE, where: g => ({ secret: true, env: false, literal: g.qv !== undefined }) },
  { re: SETTING, setting: true, where: g => { const secret = SECRET_NAME.test(g.name ?? ''); return { secret, env: !secret && /^[A-Z][A-Z0-9_]*$/.test(g.name ?? ''), literal: false }; } },
  // In a sentence a password is said to be one (비밀번호는 bcrypt로 해시 stays); a token or key named so is hidden only when it
  // looks made by a machine (컨텍스트 토큰 200000개 stays), and so is a value after an English name and a space (Go's
  // Password []byte, SQL's token TEXT); a file, a route or words joined by '-' stay (said).
  { re: KOREAN_NAME, said: true, where: g => ({ secret: /비밀\s?번호|비번|패스워드|암호/.test(g.name ?? ''), env: false, literal: false }) },
  { re: SAID_NAME, said: true, where: g => ({ secret: /\S/.test(g.then ?? '') && (SECRET_NAME.test(g.name ?? '') || /pw$/i.test(g.name ?? '')), env: false, literal: false }) }
];
/** One weighed pattern over a text; count is told of each part hidden. */
function weigh(rule: Weighed, text: string, hid: () => void): string {
  return text.replace(rule.re, (...m) => {
    const g = m.at(-1) as Groups, all = m[0] as string, at = m.at(-3) as number, src = m.at(-2) as string;
    const quoted = g.qv !== undefined, raw = g.qv ?? g.uv ?? '', name = g.name ?? '', keep = g.keep ?? '';
    // Only the text just before a match is looked at (a long text is not read again for each name in it).
    const near = src.slice(Math.max(0, at - 200), at), line = near.slice(near.lastIndexOf('\n') + 1);
    // A value in a query string or a URL fragment ends at the next parameter, one in a ';'-joined connection string at the next ';'
    // (a password there can hold & or #), and the parameters after it are weighed in turn.
    const before = src[at - 1] ?? '', query = /[?&#;]/.test(before), cut = query && !quoted ? raw.search(before === ';' ? /;/ : /[&#;]/) : -1;
    const value = cut >= 0 ? raw.slice(0, cut) : raw, tail = cut >= 0 ? weigh(rule, raw.slice(cut), hid) : '';
    // A setting on a line of its own (.env, YAML, also after a diff's or a quote's mark) or an environment name set without spaces is
    // written as it is; 'name = value' is as often code.
    const setting = !!rule.setting, said = !!rule.said, spaced = /[ \t](?::=|=>|=)[ \t]/.test(keep), kind = rule.where(g), upper = /^[A-Z][A-Z0-9_]*$/.test(name);
    const lineStart = setting && /^[ \t]*(?:[-+>][ \t]*)*(?:export[ \t]+|set[ \t]+)?["']?$/.test(line);
    const part = value.length < (rule.min ?? 0) ? null : secretPart(value, { ...kind, quoted, name, next: src.slice(at + all.length, at + all.length + 4), lineStart, said,
      colon: /:[ \t]*$/.test(keep), keyQuoted: setting && /["']\]?[ \t]*(?::=|=>|[:=])[ \t]*$/.test(keep), dotenv: lineStart && upper && !spaced && /(?<![:=!<>])=$/.test(keep),
      literal: kind.literal || query || (setting && !spaced && (lineStart || upper)) });
    if (!part && cut < 0) return all;
    if (part) hid();
    const q = quoted ? g.q ?? '' : '';
    return `${keep}${q}${part ? `${HIDDEN}${part[1]}` : value}${q}${tail}`;
  });
}
// A Cookie or Set-Cookie header, or curl's -b and --cookie (curl copied from the browser carries them), to the end of its line or
// quote: each cookie in it whose name says it holds a session is weighed; the others and the attributes (Path=/) stay.
// The header may be a key of JSON or a dict ("Cookie": "…", 'set-cookie': [ '…' ]), and curl's argument quoted for cmd (^"…^") or
// bash ($'…').
const COOKIES = /(?<keep>\b(?:set-)?cookie\\?["']?[ \t]*[:=][ \t]*(?:\[[ \t]*)?\\?["']?|(?<![\w-])(?:-b|--cookie)(?:[ \t]+|=)(?:\^?\\?["']|\$')?)(?<v>[^\n"'\\]{1,8000})/gi;
const COOKIE = /(^|;[ \t]*)([^=;\s]{1,200})=([^;\s]{1,4000})/g;
const SESSION_COOKIE = /sess|sid(?![a-z])|(?<![a-z])auth(?![a-z])|aspxauth|token|jwt|remember|login|logged_?in|identity|aspnetcore|wordpress_sec|^li_at$/i;
function cookies(text: string, hid: () => void): string {
  return text.replace(COOKIES, (_all, keep: string, v: string) => keep + v.replace(COOKIE, (pair, pre: string, name: string, value: string) => {
    if (!SESSION_COOKIE.test(name)) return pair;
    const part = secretPart(value, { secret: true, env: false, quoted: false, literal: true, lineStart: false, colon: false, keyQuoted: false, dotenv: true, name, next: '' });
    if (!part) return pair;
    hid(); return `${pre}${name}=${HIDDEN}${part[1]}`;
  }));
}
/** Hides each credential-like part of a text (a private key block whole) so the rest can be kept; count says how many. */
export function redactSecrets(text: string): { text: string; count: number } {
  let count = 0, out = text;
  // The last argument is the named groups when the pattern has any (its `keep`), else the whole text.
  for (const re of HIDE) out = out.replace(re, (...m) => { count++; const g = m.at(-1); return `${typeof g === 'object' && g?.keep || ''}${HIDDEN}`; });
  out = cookies(out, () => count++);
  for (const rule of WEIGHED) out = weigh(rule, out, () => count++);
  return { text: out, count };
}

// Session records the automatic connection takes: credential-like text hidden (the header too), control characters taken out, a
// reply taken while it was still being written continued without repeating it, turns a reading left out said so, a draft holding
// several sessions kept as one record each, and the look itself (each session saved on its own, limits, marks). All values fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import { redactSecrets, secretLike } from '../dist/public/shared/secret.js';
import { sessionText, sessionChunks, newTurns, markAfter, leftSince, recordParts, NEXT_RECORD, readSessionDetail, stamp } from '../dist/public/shared/session-import.js';
import { sessionDetail, within } from '../dist/public/shared/session-parse.js';
import { sessionOrigin, partSessions } from '../dist/public/shared/handover.js';
import { PASTED_TEXT_LIMIT } from '../dist/public/shared/types.js';

globalThis.document = { getElementById: () => null, visibilityState: 'visible', addEventListener() {} };
const { createAutoSync, AUTOSYNC_KEY } = await import('../dist/public/client/auto-sync.js');

const ID = 'claude-0123456789abcdef01234567', OLD = 'claude-89abcdef0123456789abcdef';
const T = m => new Date(Date.parse('2026-10-30T09:00:00.000Z') + m * 60000).toISOString();
const session = (turns, extra = {}) => ({ id: ID, tool: 'claude', label: '', title: null, cwd: '/work/salon', branch: 'main', startedAt: null, turns, omitted: 0, ...extra });
const hidden = '[가려진 비밀값]';
// Fake credentials, put together at run time so no file holds one whole.
const f = (...p) => p.join('');
const JWT = f('eyJ', 'hbGciOiJIUzI1NiJ9', '.', 'eyJyb2xlIjoic2VydmljZSJ9', '.', 'FAKEsignatureFAKEsig');

test('SESSIONS-RD1 redaction hides the common credentials a session can hold, keeps their names and leaves ordinary text alone', () => {
  const cases = [
    [`SUPABASE_SERVICE_ROLE_KEY=${JWT}`, JWT, 'SUPABASE_SERVICE_ROLE_KEY='],
    ['curl -H "Authorization: Bearer abc.FAKE-token-0123456789" https://api.example.test', 'abc.FAKE-token-0123456789', 'Authorization: Bearer '],
    ['Authorization: Basic ZmFrZTpmYWtlcGFzcw==', 'ZmFrZTpmYWtlcGFzcw==', 'Authorization: Basic '],
    ['DATABASE_URL=postgres://admin:FakePassw0rd!@db.example.test:5432/app', 'FakePassw0rd!', 'postgres://admin:'],
    [f('STRIPE_SECRET_KEY=', 'sk_', 'live_', 'FAKE'.repeat(6)), f('sk_', 'live_'), 'STRIPE_SECRET_KEY='],
    [f('결제 키는 ', 'rk_', 'test_', 'FAKE'.repeat(4), ' 이에요'), 'FAKEFAKE', '결제 키는 '],
    ['AWS_SECRET_ACCESS_KEY=FAKEfakeFAKEfake/FAKEfakeFAKEfake0123', 'FAKEfakeFAKEfake/', 'AWS_SECRET_ACCESS_KEY='],
    ['aws_secret_access_key = FAKEfakeFAKEfake/FAKEfake0123', 'FAKEfakeFAKEfake/', 'aws_secret_access_key = '],
    [f('//registry.npmjs.org/:_authToken=', 'npm_', 'FAKE'.repeat(9)), 'npm_', '_authToken='],
    [f('토큰 ', 'glpat-', 'FAKE'.repeat(5), ' 으로 푸시'), 'glpat-', '으로 푸시'],
    [f('모델 받을 때 ', 'hf_', 'FAKE'.repeat(8)), 'hf_', '모델 받을 때 '],
    [f('알림은 ', 'https://hooks.slack.com/', 'services/T000FAKE/B000FAKE/', 'FAKE'.repeat(6)), 'T000FAKE', 'https://hooks.slack.com/'],
    [f('봇 ', '123456789:', 'AA', 'FAKE'.repeat(8)), '123456789:AA', '봇 '],
    ['DB_PASSWORD=Fake&pass123', 'Fake&pass123', 'DB_PASSWORD='],
    ['{"apiKey": "fake-api-key-0000", "password": "fakepass1"}', 'fake-api-key-0000', '"apiKey": "'],
    ['{"apiKey": "fake-api-key-0000", "password": "fakepass1"}', 'fakepass1', '"password": "'],
    ["settings = { secret_key: 'fake-secret-value', client_secret: `fake-client-0000` }", 'fake-secret-value', "secret_key: '"],
    ["settings = { secret_key: 'fake-secret-value', client_secret: `fake-client-0000` }", 'fake-client-0000', 'client_secret: `'],
    ['https://example.test/cb?token=fake0123token&next=1', 'fake0123token', '&next=1'],
    ['-----BEGIN PGP PRIVATE KEY BLOCK-----\nFAKEBODY\n-----END PGP PRIVATE KEY BLOCK-----\n끝', 'FAKEBODY', '\n끝'],
    ['-----BEGIN OPENSSH PRIVATE KEY-----\nFAKEBODY\n-----END OPENSSH PRIVATE KEY-----', 'FAKEBODY', ''],
    ['PuTTY-User-Key-File-3: ssh-ed25519\nPublic-Lines: 1\nAAAAC3FAKEPUBLIC\nPrivate-Lines: 1\nAAAAIFAKEPRIVATEBODY\nPrivate-MAC: 00ff', 'FAKEPRIVATEBODY', 'Private-MAC: 00ff']
  ];
  for (const [text, secret, keep] of cases) {
    const r = redactSecrets(text);
    assert.ok(!r.text.includes(secret), `${text} -> ${r.text}`); assert.ok(r.text.includes(keep) && r.text.includes(hidden), `${text} -> ${r.text}`);
    assert.ok(r.count >= 1 && !secretLike(r.text));
    assert.deepEqual(redactSecrets(r.text), { text: r.text, count: 0 }, 'hidden once, never again');
  }
  // Talk about keys, code that names them and ordinary links stay as written.
  for (const text of ['Basic authentication is used; the Bearer token goes in the header.', 'interface A { password: string; token: string | null }',
    'const API_KEY = process.env.API_KEY; MAX_TOKENS=4096', 'id INTEGER PRIMARY KEY, KEYBOARD 설정', 'git clone https://github.com/org/repo.git, ssh://git@host:22/x, http://localhost:3000/@me',
    '예약 화면에서 휴무일을 영업시간 설정과 연결해 줘', 'GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}'])
    assert.deepEqual(redactSecrets(text), { text, count: 0 }, text);
});

test('SESSIONS-RD2 a value is weighed by what its name says and what it looks like: secrets in any setting form go, code and names stay, fast', () => {
  const hide = [
    ['JWT_SECRET=thisisaverylongsecretphraseforjwt', 'thisisaverylong'], ['SECRET_KEY=FAKEfakeFAKEfakeFAKEfakeFAKEfake', 'FAKEfake'],
    ['apiKey: "FAKEfakeFAKEfakeFAKEfake"', 'FAKEfake'], ['SESSION_SECRET=keyboardcat', 'keyboardcat'], ['SECRET_KEY=changeme', 'changeme'],
    ['ACCESS_TOKEN: 1234567890123456', '1234567890123456'], ['AWS_SECRET_ACCESS_KEY=/FAKEfakeFAKE0123fakeFAKEfake0123fakeFAKE', 'FAKEfakeFAKE0123'],
    ['DB_PASSWORD=Xy7(kL2!m>Q9', 'Xy7(kL2'], ['POSTGRES_PASSWORD=Kq9,mZ2!xP0', 'Kq9'], ['ADMIN_PASSWORD="Fa(ke)0123"', 'Fa(ke)0123'],
    ['DB_PASSWORD=~Fake0123!', 'Fake0123'], ['DB_PASSWORD=.Fake0123', 'Fake0123'], ['SECRET_KEY=ab(FAKE0123FAKEfake0123)', 'FAKE0123FAKE'],
    ['DB_PASSWORD=Fake01;moreFAKE99', 'moreFAKE99'], ['JWT_SECRET="super_secret_value"', 'super_secret_value'],
    ['{"headers":{"X-Api-Auth":"Bearer FAKEfake0123FAKEfake0123"},"endpoint":"https://api.example.test/v1/items"}', 'FAKEfake0123FAKE'],
    ['token: Bearer FAKEfake0123FAKEfake0123/x.y', 'FAKEfake0123FAKE'],
    [f('client.login("', 'OTk5ODg3NzY2NTU0NDMzMjEx', '.GabcDE.', 'FAKEfake'.repeat(4), '01")'), 'OTk5ODg3'],
    ['apiKey := "FAKEfake0123fakeFAKE"', 'FAKEfake0123'], ["'password' => 'FakePass0123'", 'FakePass0123'],
    ['REDIS_URL=redis://:FakePass0123@redis.example.test:6379/0', 'FakePass0123'], ['EMAIL_PASS=abcdefghijklmnop', 'abcdefghijklmnop'],
    ['curl -u admin:FakePass0123 https://api.example.test', 'FakePass0123'], ['{\\"password\\":\\"FakePass0123\\"}', 'FakePass0123'],
    ['docker run -e DB_PASSWORD=hunterhunter postgres', 'hunterhunter'], ['--password hunter22', 'hunter22'],
    ['docker exec -it db mysql -uroot -pFake0123', 'Fake0123'], ['"Authorization": "FAKEfake0123FAKEfake0123"', 'FAKEfake0123'],
    ['  password: correcthorse', 'correcthorse']
  ];
  for (const [text, secret] of hide) {
    const r = redactSecrets(text);
    assert.ok(!r.text.includes(secret) && r.count >= 1, `${text} -> ${r.text}`);
    assert.deepEqual(redactSecrets(r.text), { text: r.text, count: 0 }, 'hidden once, never again');
  }
  for (const text of ['const token = req.headers.authorization?.split(" ")[1];', 'const key = crypto.randomBytes(32)', 'secret = settings.SECRET_KEY',
    'access_token = create_access_token(identity=user.id)', 'apiKey: config.openai.apiKey', 'const storageKey = "agentflow.autosync.v1"',
    '"key": "settings.profile.title"', 'Key: "uploads/user123/avatar.png"', 'secretKeyRef: { name: db, key: DATABASE_PASSWORD }',
    'const cacheKey = `session:${userId}:${projectId}`', 'Authorization: this.authService.getToken()', 'const user = await User.create({ email, password: hashedPassword });',
    'password: passwordHash,', 'password: SecretStr', 'password: Annotated[str, Form()]', '  -p, --password string   Password', 'use --password option',
    'docker run --name mysql -p3306:3306 -d mysql:8', 'SORT_KEY=createdAt', 'KEY_FILE=/etc/ssl/private/server.key', 'if (password === input) return',
    'API key: 발급받은 키를 넣어 주세요', 'the token: required for every call', 'Bearer tokens/session2.ts', 'password = os.environ["DB_PASSWORD"]',
    'token = jwt.encode(payload, SECRET, algorithm="HS256")'])
    assert.deepEqual(redactSecrets(text), { text, count: 0 }, text);
  // A long name never makes a value slow to weigh, and a long text takes time in proportion to its length.
  for (const n of [30, 60, 5000]) {
    const w = 'authenticationserviceprovider'.repeat(Math.ceil(n / 29)).slice(0, n), t0 = performance.now();
    for (const t of [`headers: { Authorization: ${w}.currentToken }`, `export const token = ${w}.current;`, `password: ${w}.`, `Bearer ${w}1`]) redactSecrets(t);
    assert.ok(performance.now() - t0 < 200, `${n} letters`);
  }
  const big = 'const accessToken = userAuthenticationResponse.data.accessToken; password: hashedPassword, DB_PASSWORD=Fake0123 '.repeat(20000), t1 = performance.now();
  assert.equal(redactSecrets(big).count, 20000); assert.ok(performance.now() - t1 < 3000, 'a 2 MB text');
});

test('SESSIONS-RD3 every parameter of a query, cookie or connection string is weighed on its own; header schemes, env names and literal values are told apart', () => {
  const FAKE = f('FAKEfake', '0123', 'FAKEfake'), FAKE2 = f('FAKEtoken', '0123', 'FAKE');
  const hide = [
    [f('GET https://api.example.test/v1?key=', FAKE, '&token=', FAKE2), [FAKE, FAKE2]],
    [f('POST /oauth?grant_type=refresh_token&client_id=app&client_secret=', 'FakeSecret0123', '&refresh_token=', FAKE2), ['FakeSecret0123', FAKE2]],
    [f('GET /x?sort_key=name&access_token=', FAKE), [FAKE]],
    ['DB_PASSWORD=MyPassword1', ['MyPassword1']], ['DB_PASSWORD=MySecretPassword', ['MySecretPassword']], ['{"password": "HelloWorld1"}', ['HelloWorld1']],
    [f('SENDGRID_API_KEY=SG.', 'aBcD1234EfGh5678IjKl', '.', 'MnOp9012QrSt3456UvWx'), ['aBcD1234EfGh5678IjKl', 'MnOp9012QrSt3456UvWx']],
    [f('DOPPLER_TOKEN=dp.st.dev.', 'Fa1Ke2Fa3Ke4Fa5Ke6Fa7Ke8'), ['Fa1Ke2Fa3Ke4Fa5Ke6Fa7Ke8']],
    ['mysql -u root --password=supersecret mydb', ['supersecret']], ['Server=db;User Id=sa;Password=supersecret;', ['supersecret']],
    ['+    password: supersecret', ['supersecret']],
    [f('os.environ["LANGCHAIN_API_KEY"] = "', FAKE, '"'), [FAKE]], ["define( 'DB_PASSWORD', 'FakePass0123' );", ['FakePass0123']],
    [f('Cookie: connect.sid=s%3A', FAKE), [FAKE]],
    // A session cookie anywhere in a long Cookie header, or given to curl with -b or --cookie.
    [f('Cookie: _ga=GA1.1.1234567890.1700000000; _gcl_au=1.1.1234567890.1700000000; _fbp=fb.1.1700000000000.1234567890; theme=dark; lang=ko-KR; ',
      'ajs_anonymous_id=0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b; sessionid=', FAKE), [FAKE]],
    [f("curl 'https://x.test/api' \\\n  -b 'sessionid=", FAKE, "' \\\n  --compressed"), [FAKE]], [f('curl --cookie "sessionid=', FAKE, '" https://x.test'), [FAKE]],
    [f('Cookie: .AspNetCore.Cookies=CfDJ8', FAKE), [FAKE]],
    // A credential followed by more on its line, a scheme's parameter, a YAML password in capitals, Rails' secret_key_base.
    [f('http GET https://api.example.test/items Authorization:', FAKE, ' Accept:application/json'), [FAKE]], [f('Authorization: ', FAKE, ', Content-Type: application/json'), [FAKE]],
    [f('Authorization: SSWS token="', FAKE, '"'), [FAKE]], ['spring:\n  datasource:\n    password: SuperSecret99', ['SuperSecret99']], ['DB_PASSWORD: MySecretPassword', ['MySecretPassword']],
    [f('SECRET_KEY_BASE=', 'a1b2c3d4e5f6'.repeat(10)), ['a1b2c3d4e5f6a1b2']]
  ];
  for (const [text, secrets] of hide) {
    const r = redactSecrets(text);
    for (const secret of secrets) assert.ok(!r.text.includes(secret) && r.count >= 1, `${text} -> ${r.text}`);
    assert.deepEqual(redactSecrets(r.text), { text: r.text, count: 0 }, 'hidden once, never again');
  }
  // What tells a reader what was there stays: the scheme, the other parameters, the cookie's attributes.
  for (const [text, stays] of [[f('Authorization: ApiKey ', FAKE, '=='), 'Authorization: ApiKey '], [f('Authorization: Negotiate YII', FAKE), 'Authorization: Negotiate '],
    [f('https://x.test/cb#access_token=', FAKE, '&token_type=Bearer&expires_in=3600&state=af93'), '&token_type=Bearer&expires_in=3600&state=af93'],
    [f('Set-Cookie: session=', FAKE, '; Path=/'), '; Path=/'], [f('Authorization: SSWS token="', FAKE, '"'), 'Authorization: SSWS token="'],
    [f('http GET https://x.test Authorization:', FAKE, ' Accept:application/json'), ' Accept:application/json']]) {
    const r = redactSecrets(text);
    assert.ok(r.text.includes(stays) && !r.text.includes(FAKE) && r.count === 1, `${text} -> ${r.text}`);
  }
  for (const text of ["credentials: 'include'", "SECRET_KEY = config('SECRET_KEY')", 'password = input("Password: ")', '    api_key=api_key,',
    'password: confirmPassword', '  password: encryptedPassword }', 'Authorization: this.authService.getToken()',
    // Code on a line of its own: a call, a member path, a variable under an environment name, PHP reading the environment.
    'client = OpenAI(\n    api_key=os.getenv("OPENAI_API_KEY"),\n)', 'password=getpass.getpass("Password: ")', 'new OpenAI({\n  apiKey: config.openaiKey\n})',
    'if(!ok)return;password=form.password.value;', 'return { API_KEY: apiKey };', 'environment: {\n    DB_PASSWORD: dbPassword\n  }', '{"password": hashed_password}',
    "define( 'DB_PASSWORD', getenv_docker('WORDPRESS_DB_PASSWORD', 'example password') );", "define('JWT_AUTH_SECRET_KEY', SECURE_AUTH_KEY);",
    "define('PASSWORD_RESET_URL', '/reset-password');", 'private_key = ed25519.Ed25519PrivateKey.generate()', 'access_token = OAuth2Session.fetch_token(url)',
    // Prose after a header name, and cookies that hold no session.
    'Authorization: Only owners', 'Authorization: Any authenticated user', 'Authorization: Required (401 otherwise)',
    'cookie: sidebar_state=collapsed; authorStyle=compact', 'git checkout -b feature/session-fix'])
    assert.deepEqual(redactSecrets(text), { text, count: 0 }, text);
  // Time stays in proportion to length, however the text is built.
  for (const text of ['Authorization:'.repeat(64000) + ' x', ('Cookie: sid=a' + ')'.repeat(3990) + '\n').repeat(100), ('password=a' + ')'.repeat(1990) + '\n').repeat(200)]) {
    const t0 = performance.now(); redactSecrets(text); assert.ok(performance.now() - t0 < 1500, `${text.slice(0, 20)}… ${(performance.now() - t0).toFixed(0)}ms`);
  }
});

test('SESSIONS-RD4 a password in a connection string, a value starting with $ { % or <, cookies in code and in copied curl commands go; code, types, tags and references stay', () => {
  const FAKE = f('FAKEfake', '0123', 'FAKEfake', '4567');
  const hide = [
    ['Server=db;User Id=sa;Password=Fa#ke0123xyz;', 'Fa#ke0123xyz'], ['Data Source=x;User ID=sa;Password=K9#mP2&qL7;', 'K9#mP2&qL7'],
    ["define( 'AUTH_KEY', '{Kq9!mZ2;xP0@wL7#nB4$vC1%' );", 'Kq9!mZ2'], ["DB_PASSWORD='$Kq9mZ2xP0!'", 'Kq9mZ2xP0'], ['{"password": "{Kq9mZ2xP0!}"}', 'Kq9mZ2xP0'],
    [f('headers = {"Cookie": "sessionid=', FAKE, '; csrftoken=abc"}'), FAKE], [f("'set-cookie': [ 'connect.sid=s%3A", FAKE, "; Path=/' ]"), FAKE],
    [f('curl ^"https://x.test/api^" ^\n  -b ^"sessionid=', FAKE, '; theme=dark^"'), FAKE], [f("curl 'https://x.test/api' -b $'sessionid=", FAKE, "'"), FAKE],
    [f("cookies = {\n    'sessionid': '", FAKE, "',\n}"), FAKE], [f('Cookie: .ASPXAUTH=', FAKE), FAKE],
    ['DB_PASSWORD=P4ss.w0rd', 'P4ss.w0rd'], ['DB_PASSWORD=abc(def)ghi1', 'ghi1'], ['<password>FakePass0123</password>', 'FakePass0123'],
    ['sshpass -p FakePass0123 ssh me@host', 'FakePass0123'], ['redis-cli -h host -a FakePass0123 ping', 'FakePass0123']
  ];
  for (const [text, secret] of hide) {
    const r = redactSecrets(text);
    assert.ok(!r.text.includes(secret) && r.count >= 1, `${text} -> ${r.text}`);
    assert.deepEqual(redactSecrets(r.text), { text: r.text, count: 0 }, 'hidden once, never again');
  }
  for (const text of ['Authorization: via OAuth2', 'Authorization: Okta (OIDC), see docs/auth.md', 'Authorization: through Keycloak22', '\tpassword := hashedPassword',
    'client = OpenAI(\n    api_key=OPENAI_API_KEY\n)', 'app.secret_key=SECRET_KEY', 'class User(BaseModel):\n    password: PasswordHash', '    access_token: AccessToken',
    'payload = {\n    "password": user_password\n}', 'headers:\n  Authorization:\n    schema:\n      type: string', 'Authorization: Bearer\nContent-Type: application/json',
    "    'password' => Hash::make($request->password),", '    MasterUserPassword: !Ref DBPassword', '    token: HTTPAuthorizationCredentials = Depends(bearer_scheme),',
    'password: <your-password>', 'api_key: $OPENAI_API_KEY', "password = $_ENV['DB_PASSWORD'];", 'password: {password}', 'docker run -p 8080:80 nginx', '<key>CFBundleName</key>'])
    assert.deepEqual(redactSecrets(text), { text, count: 0 }, text);
});

test('SESSIONS-RT1 the whole record is hidden and cleaned, its header too, so it can always be kept', () => {
  const d = session([{ role: 'user', at: T(0), text: '색 출력 \u001b[31m빨강\u001b[0m 그리고 제목\u000b부제목\u0007' }, { role: 'assistant', at: T(1), text: '고쳤어요', files: ['src/a.ts'] }],
    { cwd: 'C:\\work\\sk-telecom-portal-renewal', branch: 'feature/sk-1234-fix-login-redirect', title: `키 ${f('sk-', 'proj-', 'FAKE'.repeat(6))} 넣고 테스트` });
  for (const text of [sessionText(d).text, sessionChunks(d, d.turns)[0]]) {
    assert.ok(!secretLike(text) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text), text);
    assert.ok(text.includes('색 출력 빨강 그리고 제목\n부제목'), text);
    assert.doesNotThrow(() => D.pasteRecord(D.createProject(), text, null));
    // Still read as that session's record, the parts that looked like keys hidden.
    const o = sessionOrigin(text);
    assert.equal(o.id, ID); assert.equal(o.cwd, `C:\\work\\${hidden}`); assert.equal(o.branch, `feature/${hidden}`);
  }
  assert.equal(sessionText(d).redacted, 3);
});

const PART1 = 'PART-ONE 먼저 테스트를 돌려 볼게요.', PART2 = 'PART-TWO 다 통과해요.';
test('SESSIONS-RC1 a reply taken while it was being written comes back with only what it gained, as its continuation', () => {
  const look1 = session([{ role: 'user', at: T(0), text: '테스트 고쳐 줘' }, { role: 'assistant', at: T(1), text: PART1, files: ['src/a.ts'] }]);
  assert.equal(newTurns(look1, null).length, 2);
  const mark = markAfter(look1, null, T(2));
  assert.equal(mark.lastAt, T(1)); assert.equal(mark.reply.chars, PART1.length); assert.deepEqual(mark.reply.files, ['src/a.ts']);
  // Read from the mark on: the reply (its time is its first piece's) went on and changed another file; a new prompt followed.
  const grown = [{ role: 'assistant', at: T(1), text: `${PART1}\n\n${PART2}`, files: ['src/a.ts', 'src/b.ts'] }, { role: 'user', at: T(9), text: '다음 것도' }];
  const taken = newTurns(session(grown), mark);
  assert.deepEqual(taken.map(t => [t.role, t.text, t.files ?? null, !!t.cont]), [['assistant', PART2, ['src/b.ts'], true], ['user', '다음 것도', null, false]]);
  const record = sessionChunks(session(grown), taken)[0];
  assert.ok(record.includes(`── Claude Code 답변(이어서) · `) && record.includes(`${PART2}\n(바꾼 파일: src/b.ts)`) && !record.includes('PART-ONE'), record);
  // Taken in full: the same reading again gives nothing.
  assert.deepEqual(newTurns(session(grown), markAfter(session(grown), mark, T(10))), []);
  // A reading whose reply has not gone on gives nothing either.
  assert.deepEqual(newTurns(look1, mark), []);
  // A reply whose time moved with its last piece (an older reading) is still known by how it starts.
  assert.deepEqual(newTurns(session([{ ...grown[0], at: T(5) }, grown[1]]), mark).map(t => [t.text, !!t.cont]), [[PART2, true], ['다음 것도', false]]);
  // A reply cut at its length limit reads differently once it grew: only its new files come in, never its start again.
  const clipped = `${'x'.repeat(50)}\n…(이후 5자 생략)`, cmark = markAfter(session([{ role: 'assistant', at: T(1), text: clipped, files: ['a.ts'] }]), null, T(2));
  assert.deepEqual(newTurns(session([{ role: 'assistant', at: T(1), text: `${'x'.repeat(50)}\n…(이후 900자 생략)`, files: ['a.ts', 'c.ts'] }]), cmark).map(t => [t.text, t.files, !!t.cont]), [['', ['c.ts'], true]]);
  const files = sessionChunks(session([]), [{ role: 'assistant', at: T(1), text: '', files: ['c.ts'], cont: true }])[0];
  assert.ok(files.endsWith(`── Claude Code 답변(이어서) · ${stamp(T(1))} ──\n(바꾼 파일: c.ts)`), files);
  // A subagent's file joins a reply after its own ones: files are told by name, so a new file of the reply's own is never lost
  // behind one taken before, and none is taken twice. A mark kept before (a count) still reads.
  const sub = markAfter(session([{ role: 'assistant', at: T(1), text: PART1, files: ['src/notify.ts'] }]), null, T(2));
  assert.deepEqual(newTurns(session([{ role: 'assistant', at: T(1), text: PART1, files: ['src/booking.ts', 'src/notify.ts'] }]), sub).map(t => t.files), [['src/booking.ts']]);
  assert.deepEqual(newTurns(session(grown), { ...mark, reply: { ...mark.reply, files: 1 } }).map(t => t.files ?? null), [['src/b.ts'], null]);
  // A mark from before (no reply kept): the turn at its time counts as taken, as it did.
  assert.deepEqual(newTurns(session(grown), { lastAt: T(1), count: 2, updatedAt: T(2) }).map(t => t.text), ['다음 것도']);
  // Turns with no times go by count: the reply taken last is the count's last.
  const untimed = turns => session(turns.map(t => ({ ...t, at: null })));
  const umark = markAfter(untimed(look1.turns), null, T(2));
  assert.deepEqual(newTurns(untimed([look1.turns[0], ...grown]), umark).map(t => [t.text, !!t.cont]), [[PART2, true], ['다음 것도', false]]);
});

test('SESSIONS-RC2 turns after the mark that one reading cannot hold are read on from each new mark, oldest first: none is dropped', () => {
  const turns = [{ role: 'user', at: T(0), text: '시작' }, { role: 'assistant', at: T(1), text: '좋아요' }];
  for (let i = 0; i < 10; i++) turns.push({ role: 'user', at: T(10 + 2 * i), text: `요청 ${i}` }, { role: 'assistant', at: T(11 + 2 * i), text: 'r'.repeat(1000) });
  let mark = markAfter(session(turns.slice(0, 2)), null, T(2));
  const parsed = { meta: { cwd: '/work/salon', cwds: ['/work/salon'], branch: 'main', startedAt: null, title: null, thread: null, parent: null }, turns, changes: [] };
  const read = (limits, since) => readSessionDetail(JSON.parse(JSON.stringify(sessionDetail(ID, 'claude', parsed, limits, since))));
  const got = []; let pages = 0;
  for (;;) {
    const d = read({ turnChars: 20000, replyChars: 5000 }, mark.lastAt); pages++;
    assert.equal(d.omitted, 0); assert.equal(leftSince(d, mark), 0, 'a reading from the mark leaves nothing out before what it sends');
    got.push(...sessionChunks(d, newTurns(d, mark)));
    const next = markAfter(d, mark, T(40)); if (!d.rest) break;
    assert.ok(next.lastAt > mark.lastAt, 'each reading moves the mark on'); mark = next;
  }
  assert.ok(pages > 2);
  for (let i = 0; i < 10; i++) assert.equal(got.filter(t => new RegExp(`요청 ${i}(?:\\n|$)`).test(t)).length, 1, `요청 ${i}`);
  // A reading with no time (the paste box) still sends the newest turns and says how many earlier ones were left.
  assert.ok(read({ turnChars: 20000, replyChars: 5000 }, null).omitted > 0);
  assert.equal(leftSince({ ...session(turns.slice(0, 6)), omitted: 2 }, mark), 0, 'a reading from before the mark (no since) has no gap');
  assert.equal(leftSince({ ...session(turns), omitted: 3 }, null), 3, 'with no mark, every turn left out is said');
});

test('SESSIONS-RC3 a long stretch becomes several records within the limit, every turn once and in order', () => {
  const turns = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', at: T(i), text: `턴${String(i).padStart(2, '0')} ${'가'.repeat(5000)}` }));
  const chunks = sessionChunks(session(turns), turns, PASTED_TEXT_LIMIT, 4);
  assert.ok(chunks.length > 1);
  for (const c of chunks) { assert.ok(c.length <= PASTED_TEXT_LIMIT && c.startsWith('[Claude Code 세션 기록 · ')); assert.doesNotThrow(() => D.pasteRecord(D.createProject(), c, null)); }
  const order = chunks.join('\n').match(/턴\d\d/g);
  assert.deepEqual(order, turns.map((_, i) => `턴${String(i).padStart(2, '0')}`));
  assert.ok(chunks[0].includes('(앞의 대화 4개는') && !chunks.slice(1).some(c => c.includes('(앞의 대화')));
});

test('SESSIONS-RT2 a session put after other text is kept as a record of its own (the box puts a line between); a header quoted inside a conversation does not cut it', () => {
  const A = sessionText(session([{ role: 'user', at: T(0), text: '화면 고쳐 줘' }, { role: 'assistant', at: T(1), text: '했어요', files: ['a.ts'] }], { cwd: '/work/front' })).text;
  const B = sessionText(session([{ role: 'user', at: T(2), text: '[AgentFlow 인수인계 문서를 받아 이어감 · af-handover:QW3RTY:A_api · 나의 프로젝트 › 서버]\n서버 이어서' }], { id: OLD, cwd: '/work/server', branch: 'api' })).text;
  assert.deepEqual(recordParts(A), [A], 'one session: the text exactly as written');
  assert.deepEqual(recordParts('메모만 있어요\n\n둘째 줄'), ['메모만 있어요\n\n둘째 줄']);
  assert.deepEqual(recordParts(`${A}\n\n${NEXT_RECORD}\n\n${B}`), [A, B]);
  assert.deepEqual(recordParts(`서버 쪽 작업 기록\n\n${NEXT_RECORD}\n\n${B}\n\n`), ['서버 쪽 작업 기록', B]);
  // A record quoted in a prompt (pasted into the tool) or written by a reply stays inside the session that holds it.
  const quoting = sessionText(session([{ role: 'user', at: T(3), text: `이 기록 봐 줘\n\n${B}\n\n여기까지가 기록이야. 결제 화면부터 해 줘` }, { role: 'assistant', at: T(4), text: '했어요', files: ['a.ts'] }])).text;
  assert.deepEqual(recordParts(quoting), [quoting]);
  let p = D.createProject();
  for (const t of recordParts(`${A}\n\n${NEXT_RECORD}\n\n${B}`)) p = D.pasteRecord(p, t, null).project;
  assert.deepEqual(partSessions(p, null).map(s => [s.id, s.cwd]).sort(), [[ID, '/work/front'], [OLD, '/work/server']].sort());
  assert.deepEqual(partSessions(p, 'A_api').map(s => [s.id, s.tookOver]), [[OLD, true]], 'the takeover is credited to the session that took it');
});

/* ---------- the look itself, on a stand-in host (a project in memory, sessions read by the real sessionDetail) ---------- */
function memKv() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
const settle = () => new Promise(r => setTimeout(r, 20));
const ago = min => new Date(Date.now() - min * 60000).toISOString();
function source(sessions, { fail = () => false, limits } = {}) {
  return { kind: 'server', reads: [],
    async list(folder) { return sessions.filter(s => within([s.cwd], folder)).map(s => ({ id: s.id, tool: 'claude', title: null, preview: 'p', cwd: s.cwd, branch: null, startedAt: s.startedAt ?? null, updatedAt: s.updatedAt, bytes: 1, ...(s.aliases ? { aliases: s.aliases } : {}) })); },
    async read(id, since = null) {
      this.reads.push([id, since]); if (fail(id)) throw Object.assign(new Error('x'), { code: 'NETWORK' });
      const s = sessions.find(x => x.id === id), parsed = { meta: { cwd: s.cwd, cwds: [s.cwd], branch: null, startedAt: null, title: null, thread: null, parent: null }, turns: structuredClone(s.turns), changes: [] };
      return readSessionDetail(JSON.parse(JSON.stringify(sessionDetail(id, 'claude', parsed, limits, since))));
    } };
}
/** One tab: its own open project; save refuses a text holding REFUSE-ME (as a text the domain refuses), and holds at most `limit`. */
function tab(src, { kv = memKv(), limit = Infinity, opened = { key: 'E1', kind: 'saved', project: D.createProject() }, conflict = () => false } = {}) {
  const host = { current: () => opened, kv, sources: { offered: () => true, current: () => src, usesServer: () => true, folderState: () => 'none', folders: () => [] },
    async save(key, texts) {
      if (conflict()) return { error: 'CONFLICT', refused: false };
      if (opened.project.pasted.length + texts.length > limit) return { error: 'FULL', refused: false };
      if (texts.some(t => t.includes('REFUSE-ME'))) return { error: 'REFUSED', refused: true };
      for (const t of texts) opened.project = D.pasteRecord(opened.project, t, null).project;
      return null;
    },
    full: () => (opened.project.pasted.length >= limit ? 'FULL' : null), canRead: () => false, read() {}, readBlocked: () => null };
  return { sync: createAutoSync(host), opened, kv, texts: () => opened.project.pasted.map(r => r.text), binding: () => JSON.parse(kv.getItem(AUTOSYNC_KEY))[opened.key] };
}
const pair = (min, ask, answer) => [{ role: 'user', at: ago(min), text: ask }, { role: 'assistant', at: ago(min - 1), text: answer }];

test('SESSIONS-AS1 each session is saved on its own: a refused one leaves the others in, and only it is read again', async () => {
  const bad = { id: OLD, cwd: '/w', updatedAt: ago(30), turns: pair(40, 'REFUSE-ME', 'x') }, good = { id: ID, cwd: '/w', updatedAt: ago(20), turns: pair(35, 'GOOD-PROMPT', 'ok') };
  const src = source([bad, good]), t = tab(src);
  t.sync.connect('/w'); await settle();
  assert.equal(t.texts().length, 1); assert.ok(t.texts()[0].includes('GOOD-PROMPT'));
  assert.deepEqual(Object.keys(t.binding().marks), [ID]); assert.equal(t.binding().error, 'REFUSED'); assert.equal(t.binding().folders[0].backfilled, false);
  src.reads.length = 0; await t.sync.tick();
  assert.deepEqual(src.reads.map(r => r[0]), [OLD], 'only the refused session is read again');
});

test('SESSIONS-AS2 a project that can take no more stops with one lasting message: nothing is read again until asked', async () => {
  const s1 = { id: OLD, cwd: '/w', updatedAt: ago(30), turns: pair(40, 'ONE', 'x') }, s2 = { id: ID, cwd: '/w', updatedAt: ago(20), turns: pair(35, 'TWO', 'y') };
  const src = source([s1, s2]), t = tab(src, { limit: 1 });
  t.sync.connect('/w'); await settle();
  assert.equal(t.texts().length, 1); assert.deepEqual(Object.keys(t.binding().marks), [OLD], 'only what was kept is marked');
  assert.equal(t.binding().error, 'FULL');
  src.reads.length = 0; for (let i = 0; i < 3; i++) await t.sync.tick();
  assert.equal(src.reads.length, 0, 'no session read again'); assert.equal(t.binding().error, 'FULL');
  // A save that fails for another reason (another tab saved meanwhile) stops this tab's looks too, until '지금 확인'.
  const u = tab(source([{ ...s2 }]), { conflict: () => true });
  u.sync.connect('/w'); await settle();
  assert.equal(u.binding().error, 'CONFLICT'); assert.deepEqual(u.binding().marks, {});
  await u.sync.tick(); await u.sync.tick(true);
  assert.equal(u.binding().error, 'CONFLICT');
});

test('SESSIONS-AS3 a folder\'s first look is done only when every session of it was read: one not read, or still being written, is taken whole later', async () => {
  let failing = true;
  const A = { id: OLD, cwd: '/w', updatedAt: ago(30), turns: pair(300, 'HISTORY-A', 'done A') }, B = { id: ID, cwd: '/w', updatedAt: ago(60), turns: pair(200, 'HISTORY-B', 'done B') };
  const t = tab(source([A, B], { fail: id => id === OLD && failing && !(failing = false) }));
  t.sync.connect('/w'); await settle();
  assert.equal(t.binding().folders[0].backfilled, false); assert.ok(t.binding().error.startsWith('w: '));
  await t.sync.tick();
  assert.ok(t.texts().some(x => x.includes('HISTORY-A')), 'its history before the connection still came in');
  assert.equal(t.binding().folders[0].backfilled, true); assert.equal(t.binding().error, null);
  // Without force a session still being written waits, and the folder's first look waits with it.
  const C = { id: ID, cwd: '/v', updatedAt: ago(0.5), turns: pair(300, 'HISTORY-C', 'done C') }, u = tab(source([C]));
  u.kv.setItem(AUTOSYNC_KEY, JSON.stringify({ E1: { folders: [{ path: '/v', connectedAt: ago(1), since: ago(20000), backfilled: false }], marks: {}, runs: { day: 'x', n: 0, last: null }, taken: 0, lastCheck: null, error: null } }));
  await u.sync.tick();
  assert.equal(u.texts().length, 0); assert.equal(u.binding().folders[0].backfilled, false);
  C.updatedAt = ago(5); await u.sync.tick();
  assert.ok(u.texts()[0].includes('HISTORY-C')); assert.equal(u.binding().folders[0].backfilled, true);
});

test('SESSIONS-AS4 a reply read while being written is continued, reading from the mark on; a gap is said', async () => {
  const S1 = { id: ID, cwd: '/w', updatedAt: ago(30), turns: [{ role: 'user', at: ago(40), text: '마이그레이션 돌려 줘' }, { role: 'assistant', at: ago(39), text: PART1 }] };
  const src = source([S1]), t = tab(src);
  t.sync.connect('/w'); await settle();
  assert.equal(t.texts().length, 1);
  S1.turns[1].text = `${PART1}\n\n${PART2}`; S1.updatedAt = ago(10);
  await t.sync.tick();
  assert.deepEqual(src.reads.at(-1), [ID, S1.turns[1].at], 'read from the mark on');
  assert.equal(t.texts().length, 2); assert.ok(t.texts()[1].includes(PART2) && !t.texts()[1].includes('PART-ONE'), t.texts()[1]);
  // A long stretch after the mark that one reading cannot send whole: it is read on from each new mark, every turn once.
  const S2 = { id: OLD, cwd: '/x', updatedAt: ago(100), turns: pair(120, '시작', '좋아요') }, src2 = source([S2], { limits: { turnChars: 20000, replyChars: 5000 } }), u = tab(src2);
  u.sync.connect('/x'); await settle();
  for (let i = 0; i < 10; i++) S2.turns.push({ role: 'user', at: ago(90 - 2 * i), text: `요청 ${i}` }, { role: 'assistant', at: ago(89 - 2 * i), text: 'r'.repeat(1000) });
  S2.updatedAt = ago(5); await u.sync.tick();
  const later = u.texts().slice(1).join('\n');
  assert.ok(!later.includes('길이 제한으로 넣지 않았어요'), later);
  for (let i = 0; i < 10; i++) assert.equal(u.texts().filter(x => new RegExp(`요청 ${i}(?:\\n|$)`).test(x)).length, 1, `요청 ${i}`);
});

test('SESSIONS-AS5 marks hold across ids, disconnecting and other tabs: nothing is taken twice', async () => {
  // A mark kept under the id the session had before (made from its file's path) is found by the listing's alias and moved.
  const S1 = { id: ID, aliases: [OLD], cwd: '/w', updatedAt: ago(10), turns: [...pair(60, 'PROMPT-ONE', 'one'), ...pair(20, 'PROMPT-TWO', 'two')] };
  const t = tab(source([S1]));
  t.kv.setItem(AUTOSYNC_KEY, JSON.stringify({ E1: { folders: [{ path: '/w', connectedAt: ago(100), since: ago(20000), backfilled: true }], marks: { [OLD]: { lastAt: ago(59), count: 2, updatedAt: ago(50) } }, runs: { day: 'x', n: 0, last: null }, taken: 1, lastCheck: null, error: null } }));
  await t.sync.tick();
  assert.equal(t.texts().length, 1); assert.ok(t.texts()[0].includes('PROMPT-TWO') && !t.texts()[0].includes('PROMPT-ONE'));
  assert.deepEqual(Object.keys(t.binding().marks), [ID]);
  // Disconnecting keeps the marks: connecting again takes nothing already taken.
  t.sync.disconnect();
  assert.equal(t.sync.bindingOf('E1'), null); assert.deepEqual(Object.keys(t.binding().marks), [ID]);
  t.sync.connect('/w'); await settle();
  assert.equal(t.texts().length, 1); assert.equal(t.binding().taken, 2);
  // Another tab whose look ran on an older copy and could not save never takes a session's mark back.
  const B = tab(source([S1]), { kv: t.kv, opened: t.opened, conflict: () => true }), before = t.binding().marks[ID];
  S1.turns.push(...pair(5, 'PROMPT-THREE', 'three')); S1.updatedAt = ago(3);
  const late = B.sync.tick(true); await t.sync.tick(); await late;
  assert.notDeepEqual(t.binding().marks[ID], before); assert.ok(t.binding().marks[ID].lastAt > before.lastAt);
  await t.sync.tick(true);
  assert.equal(t.texts().filter(x => x.includes('PROMPT-THREE')).length, 1);
});

test('SESSIONS-AS6 each session is marked as soon as its records are kept: a look cut short (a tab closed) takes nothing twice', async () => {
  const A = { id: ID, cwd: '/w', updatedAt: ago(30), turns: pair(40, 'A-ONE', 'a') }, B = { id: OLD, cwd: '/w', updatedAt: ago(29), turns: pair(38, 'B-ONE', 'b') };
  const src = source([A, B]), read = src.read.bind(src); let hang = false;
  src.read = (id, since) => (hang && id === OLD ? new Promise(() => {}) : read(id, since));
  const t = tab(src); t.sync.connect('/w'); await settle();
  assert.equal(t.texts().length, 2);
  A.turns.push(...pair(10, 'A-TWO', 'a2')); A.updatedAt = ago(5); B.turns.push(...pair(9, 'B-TWO', 'b2')); B.updatedAt = ago(4);
  hang = true; void t.sync.tick(true); await settle();
  assert.equal(t.texts().filter(x => x.includes('A-TWO')).length, 1);
  assert.ok(t.binding().marks[ID].lastAt >= A.turns.at(-1).at, 'A is marked while B is still being read');
  // The tab is gone; another one opens the project and looks.
  hang = false; const u = tab(src, { kv: t.kv, opened: t.opened }); await u.sync.tick(true);
  assert.equal(u.texts().filter(x => x.includes('A-TWO')).length, 1); assert.equal(u.texts().filter(x => x.includes('B-TWO')).length, 1);
});

test('SESSIONS-RT3 a draft with no next-record line is kept exactly, its last line break too', () => {
  for (const t of ['기록 한 줄\n', '  들여쓴 글\n\n\n', '[Claude Code 세션 기록 · 세션 claude-0123456789abcdef01234567]\n\n── 사용자 요청 ──\n가\n']) assert.deepEqual(recordParts(t), [t]);
});

test('SESSIONS-RC4 turns that share a time are never split between readings: each is taken once, and a reading always moves on', () => {
  const parsed = turns => ({ meta: { cwd: '/work/salon', cwds: ['/work/salon'], branch: 'main', startedAt: null, title: null, thread: null, parent: null }, turns, changes: [] });
  for (const size of [1000, 3000]) {
    // A prompt and its reply written in the same millisecond, at every place a reading could end.
    const turns = [{ role: 'user', at: T(0), text: '시작' }, { role: 'assistant', at: T(1), text: '좋아요' }];
    for (let i = 0; i < 6; i++) turns.push({ role: 'user', at: T(10 + i), text: `요청 ${i}` }, { role: 'assistant', at: T(10 + i), text: `답 ${i} ${'r'.repeat(size)}` });
    let mark = markAfter(session(turns.slice(0, 2)), null, T(2)); const got = [];
    for (let page = 0; page < 20; page++) {
      const d = readSessionDetail(JSON.parse(JSON.stringify(sessionDetail(ID, 'claude', parsed(turns), { turnChars: 20000, replyChars: 2500 }, mark.lastAt))));
      got.push(...newTurns(d, mark).map(t => t.text.split(' ').slice(0, 2).join(' ')));
      const next = markAfter(d, mark, T(40)); if (!d.rest) break;
      assert.ok(next.lastAt > mark.lastAt, 'each reading moves the mark on'); mark = next;
    }
    for (let i = 0; i < 6; i++) { assert.equal(got.filter(x => x === `요청 ${i}`).length, 1, `요청 ${i}`); assert.equal(got.filter(x => x === `답 ${i}`).length, 1, `답 ${i}`); }
  }
});

test('SESSIONS-RC5 a file taken under its whole path is the same file once the session works in its folder: no continuation for it', () => {
  const was = session([{ role: 'assistant', at: T(1), text: PART1, files: ['src/a.ts', '/work/app/api/types.ts'] }]), mark = markAfter(was, null, T(2));
  assert.deepEqual(newTurns(session([{ role: 'assistant', at: T(1), text: PART1, files: ['src/a.ts', 'api/types.ts'] }]), mark), []);
  assert.deepEqual(newTurns(session([{ role: 'assistant', at: T(1), text: PART1, files: ['src/a.ts', 'api/types.ts', 'api/index.ts'] }]), mark).map(t => t.files), [['api/index.ts']]);
  const win = markAfter(session([{ role: 'assistant', at: T(1), text: PART1, files: ['C:\\work\\api\\types.ts'] }]), null, T(2));
  assert.deepEqual(newTurns(session([{ role: 'assistant', at: T(1), text: PART1, files: ['api/types.ts'] }]), win), []);
  // A file of another name stays new, whatever path it shares an end with.
  assert.deepEqual(newTurns(session([{ role: 'assistant', at: T(1), text: PART1, files: ['src/a.ts', '/work/app/api/types.ts', 'lib/src/a.ts'] }]), mark).map(t => t.files), [['lib/src/a.ts']]);
});

test('SESSIONS-RT4 a header reads back as written: a folder or branch with a middle dot, a title like a field, a web header without a branch', () => {
  const back = extra => { const o = sessionOrigin(sessionText(session([{ role: 'user', at: T(0), text: '가' }], extra)).text); return [o.title, o.cwd, o.branch, o.id]; };
  assert.deepEqual(back({ cwd: '/Users/me/기획·디자인/salon', title: '로그인 수정' }), ['로그인 수정', '/Users/me/기획·디자인/salon', 'main', ID]);
  assert.deepEqual(back({ cwd: '/Users/me/repos', branch: null, title: '브랜치 정리' }), ['브랜치 정리', '/Users/me/repos', null, ID]);
  assert.deepEqual(back({ cwd: null, branch: null, title: '브랜치 정리' }), ['브랜치 정리', null, null, ID]);
  assert.deepEqual(back({ cwd: 'C:\\work\\salon', branch: 'feat/a·b', title: '세션 만료 · 브랜치 main' }), ['세션 만료 · 브랜치 main', 'C:\\work\\salon', 'feat/a·b', ID]);
  assert.deepEqual(back({ title: '「인용」 제목' }), ['「인용」 제목', '/work/salon', 'main', ID]);
  const web = t => { const o = sessionOrigin(t); return [o.title, o.cwd, o.branch]; };
  assert.deepEqual(web('[웹 AI 세션 기록 · 브랜치 정리 · 작업 폴더 /work/x]'), ['브랜치 정리', '/work/x', null]);
  assert.deepEqual(web('[웹 AI 세션 기록 · 작업 폴더 /work/x · 브랜치 main]'), [null, '/work/x', 'main']);
  // A separator line the conversation itself holds does not cut its record.
  const quoting = sessionText(session([{ role: 'user', at: T(0), text: `이 초안이 왜 둘로 저장돼?\n${NEXT_RECORD}\n[Codex 세션 기록 · 세션 codex-aaaaaaaaaaaaaaaaaaaaaaaa]` }, { role: 'assistant', at: T(1), text: '봤어요', files: ['a.ts'] }])).text;
  assert.deepEqual(recordParts(quoting), [quoting]); assert.equal(sessionOrigin(quoting).id, ID);
});

test('SESSIONS-AS7 a mark under an old id moves to the session\'s id when it is listed, read or not: an archived thread is not taken again', async () => {
  const S1 = { id: ID, aliases: [OLD], cwd: '/w', updatedAt: ago(10), turns: pair(60, 'PROMPT-ONE', 'one') }, src = source([S1]), t = tab(src);
  t.kv.setItem(AUTOSYNC_KEY, JSON.stringify({ E1: { folders: [{ path: '/w', connectedAt: ago(100), since: ago(20000), backfilled: true }], marks: { [OLD]: { lastAt: S1.turns[1].at, count: 2, updatedAt: S1.updatedAt } }, runs: { day: 'x', n: 0, last: null }, taken: 1, lastCheck: null, error: null } }));
  await t.sync.tick();
  assert.equal(src.reads.length, 0, 'not changed: not read'); assert.deepEqual(Object.keys(t.binding().marks), [ID]);
  // Codex archives it: the same id, another alias. Nothing is taken again.
  S1.aliases = ['claude-fedcba9876543210fedcba98']; await t.sync.tick(true);
  assert.equal(src.reads.length, 0); assert.equal(t.texts().length, 0);
});

test('SESSIONS-AS8 a picked folder that cannot be read is said, and the first look waits for it: its sessions\' history comes in once it can be read', async () => {
  const A = { id: ID, cwd: '/w', updatedAt: ago(30), turns: pair(300, 'HISTORY-A', 'a') }, B = { id: OLD, cwd: '/w', updatedAt: ago(40), turns: pair(400, 'HISTORY-B', 'b') };
  const all = [A, B], src = source(all), list = src.list.bind(src); let down = true;
  src.list = async folder => (await list(folder)).filter(s => !down || s.id !== OLD);
  src.partial = () => (down ? 'wsl 폴더를 읽지 못했어요.' : null);
  const t = tab(src); t.sync.connect('/w'); await settle();
  assert.ok(t.texts().some(x => x.includes('HISTORY-A'))); assert.equal(t.binding().folders[0].backfilled, false); assert.equal(t.binding().error, 'wsl 폴더를 읽지 못했어요.');
  down = false; await t.sync.tick();
  assert.ok(t.texts().some(x => x.includes('HISTORY-B')), 'history from before the connection'); assert.equal(t.texts().filter(x => x.includes('HISTORY-A')).length, 1);
  assert.equal(t.binding().folders[0].backfilled, true); assert.equal(t.binding().error, null);
});

test('SESSIONS-RT5 a title in 「」 holding 」 · 「 reads back whole; a web header\'s empty fields and left placeholders say nothing', () => {
  const text = sessionText(session([{ role: 'user', at: T(0), text: '해 줘' }], { title: '「결제」 · 「알림」 정리' })).text, o = sessionOrigin(text);
  assert.deepEqual([o.title, o.cwd, o.branch, o.id], ['「결제」 · 「알림」 정리', '/work/salon', 'main', ID]);
  const body = '\n\n── 사용자 요청 ──\n결제 버튼 문구 바꿔 줘\n\n── 웹 AI 답변 ──\n바꿨어요';
  for (const head of ['결제 문구 · 작업 폴더 (없음) · 브랜치 없음', '결제 문구 · 작업 폴더 (있으면 경로) · 브랜치 (있으면 이름)', '결제 문구 · 작업 폴더 N/A · 브랜치 -'])
    assert.deepEqual(sessionOrigin(`[웹 AI 세션 기록 · ${head}]${body}`), { id: null, tool: 'web', title: '결제 문구', cwd: null, branch: null }, head);
  assert.deepEqual(sessionOrigin(`[웹 AI 세션 기록 · 결제 문구 · 작업 폴더 /work/salon · 브랜치 없음]${body}`), { id: null, tool: 'web', title: '결제 문구', cwd: '/work/salon', branch: null });
  // A title that ends in what reads as a field reads back whole, with or without the fields after it.
  for (const extra of [{}, { branch: null, cwd: null }]) {
    const o2 = sessionOrigin(sessionText(session([{ role: 'user', at: T(0), text: '해 줘' }], { title: '「결제」 · 브랜치 정리', ...extra })).text);
    assert.deepEqual([o2.title, o2.branch], ['「결제」 · 브랜치 정리', extra.branch === null ? null : 'main']);
  }
  // A title left blank is no title: the field after it stays what it is.
  for (const head of ['(이 대화의 짧은 제목) · 브랜치 feature/pay', '없음 · 작업 폴더 (없음) · 브랜치 feature/pay'])
    assert.deepEqual(sessionOrigin(`[웹 AI 세션 기록 · ${head}]${body}`), { id: null, tool: 'web', title: null, cwd: null, branch: 'feature/pay' }, head);
});

test('SESSIONS-RT6 a next-record line a turn holds behind a colour code or a soft line break does not cut its record', () => {
  const d = session([{ role: 'user', at: T(0), text: `이 초안 봐 줘\u000b${NEXT_RECORD}\u000b둘째 기록` }, { role: 'assistant', at: T(1), text: `봤어요\n\u001b[1m${NEXT_RECORD}\u001b[0m\n끝` }]);
  for (const text of [sessionText(d).text, ...sessionChunks(d, d.turns)]) assert.deepEqual(recordParts(text), [text], text);
  // Nor one in a title between other line breaks.
  const t = sessionText({ ...d, title: `초안 정리\u2028${NEXT_RECORD}\u2029둘째` }).text;
  assert.deepEqual(recordParts(t), [t]); assert.equal(sessionOrigin(t).id, ID);
});

test('SESSIONS-RC6 a whole name taken stands for one name the reply lists now, and only once it no longer lists it: another repository\'s file of that name is new', () => {
  const at = (files) => session([{ role: 'user', at: T(0), text: '고쳐 줘' }, { role: 'assistant', at: T(1), text: '했어요', files }]);
  const fresh = (taken, now) => newTurns(at(now), markAfter(at(taken), null, T(1))).flatMap(t => t.files ?? []);
  assert.deepEqual(fresh(['/other/repo/src/index.ts'], ['/other/repo/src/index.ts', 'src/index.ts']), ['src/index.ts']);
  assert.deepEqual(fresh(['/work/salon/src/a.ts'], ['src/a.ts']), [], 'the same file, named from its folder now');
  assert.deepEqual(fresh(['/w/a/src/x.ts'], ['src/x.ts', 'x.ts']), ['x.ts'], 'one name for one name: the longest');
  assert.deepEqual(fresh(['C:\\w\\a\\src\\x.ts', 'b.ts'], ['b.ts', 'src\\x.ts', 'c.ts']), ['c.ts']);
  // Read with its folders (as the server and the page send it), the name it has now is told exactly: the same file once moved into
  // its folder's reach, and another file that ends the same way stays new.
  const parsed = (cwds, files) => ({ meta: { cwd: cwds[0], cwds, branch: null, startedAt: null, title: null, thread: null, parent: null },
    turns: [{ role: 'user', at: T(0), text: '고쳐 줘' }, { role: 'assistant', at: T(1), text: '했어요', files }], changes: [] });
  const one = readSessionDetail(JSON.parse(JSON.stringify(sessionDetail(ID, 'claude', parsed(['/w/app'], ['/w/lib/index.ts'])))));
  const two = readSessionDetail(JSON.parse(JSON.stringify(sessionDetail(ID, 'claude', parsed(['/w/app', '/w/lib'], ['/w/lib/index.ts', '/w/app/lib/index.ts'])))));
  assert.deepEqual(two.turns[1].files, ['index.ts', 'lib/index.ts']);
  assert.deepEqual(newTurns(two, markAfter(one, null, T(1))).flatMap(t => t.files ?? []), ['lib/index.ts']);
});

test('SESSIONS-AS9 a session begun since the folder was connected is taken from the connection on, even in the first look; one taken before is followed past the first look\'s ten', async () => {
  const connectedAt = ago(100), history = Array.from({ length: 10 }, (_, i) => ({ id: `claude-${String(i).padStart(24, 'a')}`, cwd: '/w', updatedAt: ago(120 + i), turns: pair(300 + i, `HISTORY-${i}`, 'h') }));
  const NEW = { id: 'claude-' + 'b'.repeat(24), cwd: '/w', startedAt: ago(50), updatedAt: ago(5), turns: pair(50, 'NEW-WORK', 'n') };
  const M = { id: 'claude-' + 'c'.repeat(24), cwd: '/w', updatedAt: ago(130), turns: [...pair(400, 'M-OLD', 'old'), ...pair(135, 'M-NEW', 'new')] };
  const src = source([NEW, ...history, M]), t = tab(src);
  t.kv.setItem(AUTOSYNC_KEY, JSON.stringify({ E1: { folders: [{ path: '/w', connectedAt, since: ago(20000), backfilled: false }],
    marks: { [M.id]: { lastAt: M.turns[1].at, count: 2, updatedAt: ago(399) } }, runs: { day: 'x', n: 0, last: null }, taken: 0, lastCheck: null, error: null } }));
  await t.sync.tick();
  assert.deepEqual(src.reads.find(r => r[0] === NEW.id), [NEW.id, connectedAt], 'read from the connection on, not as history');
  assert.ok(t.texts().some(x => x.includes('NEW-WORK')));
  assert.ok(t.texts().some(x => x.includes('M-NEW')) && !t.texts().some(x => x.includes('M-OLD')), 'the session taken before is followed');
  assert.ok(!src.reads.some(r => r[0] === history[9].id), 'the eleventh of the history is not');
});

test('SESSIONS-AS10 a session with nothing new since the connection is marked there: its history before it is never taken later', async () => {
  const connectedAt = ago(100), S = { id: ID, cwd: '/w', updatedAt: ago(10), turns: pair(300, 'HISTORY-S', 'h') };
  const src = source([S]), t = tab(src);
  t.kv.setItem(AUTOSYNC_KEY, JSON.stringify({ E1: { folders: [{ path: '/w', connectedAt, since: ago(20000), backfilled: true }], marks: {}, runs: { day: 'x', n: 0, last: null }, taken: 0, lastCheck: null, error: null } }));
  await t.sync.tick();
  assert.equal(t.texts().length, 0); assert.equal(t.binding().marks[ID].lastAt, connectedAt);
  S.turns.push(...pair(4, 'LATER-WORK', 'l')); S.updatedAt = ago(3); src.reads.length = 0;
  await t.sync.tick();
  assert.deepEqual(src.reads, [[ID, connectedAt]]);
  assert.ok(t.texts().some(x => x.includes('LATER-WORK')) && !t.texts().some(x => x.includes('HISTORY-S')), t.texts().join('\n---\n'));
});

test('SESSIONS-AS11 a history session worked in since the connection gives its history up to it, then every turn since; one past the first look\'s ten is followed from the connection', async () => {
  const connectedAt = ago(100), big = n => `${'x'.repeat(30000)} ${n}`;
  // The session the person drives: history before the connection, then more work after it than one record holds.
  const H = { id: ID, cwd: '/w', updatedAt: ago(5), turns: [...pair(300, 'BEFORE-CONNECTION', 'h'), ...[0, 1, 2, 3].flatMap(i => [{ role: 'user', at: ago(90 - i * 10), text: `AFTER-${i}` }, { role: 'assistant', at: ago(89 - i * 10), text: big(i) }])] };
  const others = Array.from({ length: 9 }, (_, i) => ({ id: `claude-${String(i).padStart(24, 'd')}`, cwd: '/w', updatedAt: ago(4 - i * 0.1), turns: pair(200, `OTHER-${i}`, 'o') }));
  // Past the ten: begun before the connection, worked in after it.
  const L = { id: OLD, cwd: '/w', updatedAt: ago(6), turns: [...pair(500, 'L-HISTORY', 'h'), ...pair(60, 'L-AFTER', 'a')] };
  const src = source([...others, H, L]), t = tab(src);
  t.kv.setItem(AUTOSYNC_KEY, JSON.stringify({ E1: { folders: [{ path: '/w', connectedAt, since: ago(20000), backfilled: false }], marks: {}, runs: { day: 'x', n: 0, last: null }, taken: 0, lastCheck: null, error: null } }));
  for (let i = 0; i < 3; i++) await t.sync.tick(true);
  const all = t.texts().join('\n');
  for (const n of ['BEFORE-CONNECTION', 'AFTER-0', 'AFTER-1', 'AFTER-2', 'AFTER-3', 'L-AFTER']) assert.equal(all.split(n).length - 1, 1, n);
  assert.ok(!all.includes('L-HISTORY'), 'only the first look\'s ten give their history');
});

test('SESSIONS-AS12 a mark of nothing taken, as an earlier version wrote it, reads from the connection: the history before it is not taken', async () => {
  const connectedAt = ago(100), S = { id: ID, cwd: '/w', updatedAt: ago(3), turns: [...pair(300, 'HISTORY-S', 'h'), ...pair(4, 'LATER-WORK', 'l')] };
  const src = source([S]), t = tab(src);
  t.kv.setItem(AUTOSYNC_KEY, JSON.stringify({ E1: { folders: [{ path: '/w', connectedAt, since: ago(20000), backfilled: true }], marks: { [ID]: { lastAt: null, count: 0, updatedAt: ago(50) } }, runs: { day: 'x', n: 0, last: null }, taken: 0, lastCheck: null, error: null } }));
  await t.sync.tick();
  assert.deepEqual(src.reads, [[ID, connectedAt]]);
  assert.ok(t.texts().some(x => x.includes('LATER-WORK')) && !t.texts().some(x => x.includes('HISTORY-S')));
});

test('SESSIONS-AS13 a reply begun before the connection and still written after it goes on from where the history left it', async () => {
  const connectedAt = ago(100), H = { id: ID, cwd: '/w', updatedAt: ago(5), turns: [{ role: 'user', at: ago(115), text: 'LONG-TASK' }, { role: 'assistant', at: ago(110), text: 'PART-A' }] };
  const src = source([H]), t = tab(src);
  t.kv.setItem(AUTOSYNC_KEY, JSON.stringify({ E1: { folders: [{ path: '/w', connectedAt, since: ago(20000), backfilled: false }], marks: {}, runs: { day: 'x', n: 0, last: null }, taken: 0, lastCheck: null, error: null } }));
  await t.sync.tick(true);
  H.turns[1].text = 'PART-A\n\nPART-B'; H.updatedAt = ago(3);
  await t.sync.tick(true);
  const all = t.texts().join('\n');
  for (const n of ['LONG-TASK', 'PART-A', 'PART-B']) assert.equal(all.split(n).length - 1, 1, `${n}\n${all}`);
});

/* ---------- the connection as the person changes it, on the same stand-in host ---------- */
/** A tab like tab()'s whose map reading can always start (`reads` counts the readings started); save keeps every text. */
function readingTab(src, opened = { key: 'E1', kind: 'saved', project: D.createProject() }) {
  const kv = memKv(), t = { reads: 0, opened, kv, texts: () => opened.project.pasted.map(r => r.text), binding: () => JSON.parse(kv.getItem(AUTOSYNC_KEY))[opened.key] };
  t.sync = createAutoSync({ current: () => opened, kv, sources: { offered: () => true, current: () => src, usesServer: () => true, folderState: () => 'none', folders: () => [] },
    async save(key, texts) { for (const x of texts) opened.project = D.pasteRecord(opened.project, x, null).project; return null; },
    full: () => null, canRead: () => true, read() { t.reads++; }, readBlocked: () => null });
  return t;
}
/** Holds the source's readings until the returned function is called: a look still running while the person acts. */
function held(src) { let go; const gate = new Promise(r => { go = r; }), read = src.read.bind(src); src.read = async (id, since) => { await gate; return read(id, since); }; return () => go(); }
const folderLink = path => ({ path, connectedAt: ago(1), since: ago(20000), backfilled: false });

test('SESSIONS-AC1 a connection ended, or a folder left, while a look runs takes nothing more from it, and no map reading starts for it', async () => {
  const A = { id: ID, cwd: '/w', updatedAt: ago(30), turns: pair(40, 'W-ONE', 'a') }, B = { id: OLD, cwd: '/w', updatedAt: ago(29), turns: pair(38, 'W-TWO', 'b') };
  const src = source([A, B]), go = held(src), t = readingTab(src);
  t.sync.connect('/w'); await settle();
  t.sync.disconnect(); assert.equal(t.sync.bindingOf('E1'), null);
  go(); await settle();
  assert.equal(t.texts().length, 0, 'nothing kept after the connection ended'); assert.equal(t.reads, 0, 'no map reading');
  assert.deepEqual(t.binding().marks, {}, 'nothing marked: connecting again takes them');
  t.sync.connect('/w'); await settle();
  assert.equal(t.texts().length, 2); assert.equal(t.reads, 1);
  // Ended and connected again meanwhile: the look that connecting queued takes them, once.
  const src3 = source([A, B]), go3 = held(src3), r = readingTab(src3);
  r.sync.connect('/w'); await settle(); r.sync.disconnect(); r.sync.connect('/w'); go3(); await settle();
  assert.equal(r.texts().length, 2); assert.equal(r.binding().folders.length, 1);
  // One of two folders left meanwhile: the other one's sessions still come in and are read into the map.
  const V = { id: 'claude-fedcba9876543210fedcba98', cwd: '/v', updatedAt: ago(28), turns: pair(37, 'V-ONE', 'v') }, src2 = source([A, V]), go2 = held(src2), u = readingTab(src2);
  u.kv.setItem(AUTOSYNC_KEY, JSON.stringify({ E1: { folders: [folderLink('/w'), folderLink('/v')], marks: {}, runs: { day: 'x', n: 0, last: null }, taken: 0, lastCheck: null, error: null } }));
  void u.sync.tick(true); await settle();
  u.sync.removeFolder('/v'); go2(); await settle();
  assert.ok(u.texts().some(x => x.includes('W-ONE')) && !u.texts().some(x => x.includes('V-ONE')), u.texts().join('\n'));
  assert.deepEqual(Object.keys(u.binding().marks), [ID]); assert.equal(u.reads, 1);
});

test('SESSIONS-AC2 a folder path pasted in quotes (Windows Explorer\'s "copy as path") connects to the folder inside them', async () => {
  for (const typed of ['"C:\\work\\salon"', "  'C:\\work\\salon' "]) {
    const t = tab(source([{ id: ID, cwd: 'C:\\work\\salon', updatedAt: ago(30), turns: pair(40, 'WIN-PROMPT', 'ok') }]));
    t.sync.connect(typed); await settle();
    assert.equal(t.binding().folders[0].path, 'C:\\work\\salon', typed); assert.equal(t.texts().length, 1, typed);
  }
});

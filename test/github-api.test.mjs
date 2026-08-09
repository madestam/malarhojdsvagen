// Integrationstest av GitHub-lagret mot det riktiga datarepot.
// Kör: GITHUB_TOKEN=$(gh auth token) node --test test/github-api.test.mjs
// Utan GITHUB_TOKEN hoppas testerna över (så att `node --test` alltid funkar).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GithubStore, ConflictError, b64EncodeUtf8, b64DecodeUtf8 } from '../js/store/github-store.js';
import { saveWithRetry } from '../js/sync.js';

const token = process.env.GITHUB_TOKEN;
const skip = token ? false : 'GITHUB_TOKEN saknas — integrationstest hoppas över';

const store = token
  ? new GithubStore({ owner: 'madestam', repo: 'malarhojdsvagen-data', branch: 'main', token })
  : null;

const path = `test/it-${Date.now()}.json`;

test('base64-rundresa bevarar å, ä, ö', () => {
  const s = 'Hundpromenad kväll – Mälarhöjden åäö ÅÄÖ 🐕';
  assert.equal(b64DecodeUtf8(b64EncodeUtf8(s)), s);
});

test('skapa, läs, 304, konflikt, merge och städning', { skip, timeout: 60_000 }, async () => {
  // 1. Skapa (PUT utan sha) med svenska tecken
  const doc1 = { version: 1, label: 'Kvällspromenad åäö', a: 1, b: 1 };
  const created = await store.putFile(path, doc1, { message: 'test: skapa testfil' });
  assert.ok(created.sha);

  // 2. GET → dokument + sha + etag
  const got = await store.getFile(path);
  assert.equal(got.status, 200);
  assert.deepEqual(got.doc, doc1);
  assert.equal(got.sha, created.sha);
  assert.ok(got.etag);

  // 3. Villkorad GET med ETag → 304
  const notModified = await store.getFile(path, { etag: got.etag });
  assert.equal(notModified.status, 304);

  // 4. PUT med fel sha → ConflictError
  await assert.rejects(
    store.putFile(path, { ...doc1, a: 2 }, { sha: '0000000000000000000000000000000000000000', message: 'test: fel sha' }),
    ConflictError,
  );

  // 5. saveWithRetry mot medvetet inaktuell version:
  //    "en annan enhet" ändrar b → vi ändrar a med gammalt sha → omförsöket
  //    ska hämta färskt och båda ändringarna ska överleva.
  const other = await store.putFile(path, { ...doc1, b: 2 }, { sha: created.sha, message: 'test: annan enhet ändrar b' });
  assert.ok(other.sha);

  const result = await saveWithRetry({
    store,
    path,
    mutation: {
      apply(doc) { doc.a = 9; },
      message: 'test: vi ändrar a via saveWithRetry',
    },
    entry: { doc: doc1, sha: created.sha }, // inaktuellt!
    emptyDoc: { version: 1 },
    author: { name: 'Integrationstest', email: 'test@malarhojdsvagen.local' },
    retryDelaysMs: [100, 200, 400],
  });
  assert.equal(result.doc.a, 9);
  assert.equal(result.doc.b, 2, 'den andra enhetens ändring ska överleva mergen');

  const final = await store.getFile(path);
  assert.equal(final.doc.a, 9);
  assert.equal(final.doc.b, 2);
  assert.equal(final.doc.label, 'Kvällspromenad åäö');

  // 6. Städa
  await store.deleteFile(path, { sha: final.sha, message: 'test: städa testfil' });
  assert.equal(await store.getFile(path), null);
});

test('listCommits ger svenska meddelanden', { skip, timeout: 30_000 }, async () => {
  const commits = await store.listCommits({ perPage: 5 });
  assert.ok(commits.length >= 1);
  assert.ok(commits[0].message.length > 0);
  assert.ok(commits[0].date);
});

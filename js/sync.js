// saveWithRetry — appens korrekthetskärna vid samtidiga redigeringar.
// Ren logik utan browser-beroenden så att den kan integrationstestas i Node.
//
// Strategi: skriv optimistiskt med senast kända sha. Vid konflikt (någon annan
// hann skriva): hämta färskt dokument, kör om SAMMA mutation på det (fältnivå-
// merge — andras ändringar av andra fält överlever), och försök igen.
import { ConflictError } from './store/github-store.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (x) => structuredClone(x);

export async function saveWithRetry({
  store,
  path,
  mutation,
  entry,          // { doc, sha } | null — senast kända version
  emptyDoc,       // används när filen inte finns än
  author,         // { name, email } — visas som git-author i datarepot
  retryDelaysMs = [250, 500, 1000],
  stamp,          // (doc) => void — sätter updatedAt/updatedBy
}) {
  let doc = entry ? clone(entry.doc) : clone(emptyDoc);
  let sha = entry ? entry.sha : null;
  const maxAttempts = retryDelaysMs.length;

  for (let attempt = 0; ; attempt++) {
    mutation.apply(doc);
    if (stamp) stamp(doc);
    try {
      const res = await store.putFile(path, doc, { sha, message: mutation.message, author });
      return { doc, sha: res.sha };
    } catch (err) {
      if (!(err instanceof ConflictError) || attempt >= maxAttempts - 1) throw err;
      // Jitter så att två enheter som krockar inte fortsätter krocka i takt.
      await sleep(retryDelaysMs[attempt] * (0.5 + Math.random()));
      const fresh = await store.getFile(path);
      if (fresh && fresh.status === 200) {
        doc = clone(fresh.doc);
        sha = fresh.sha;
      } else {
        doc = clone(emptyDoc);
        sha = null;
      }
    }
  }
}

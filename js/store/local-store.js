// Dev-adapter med samma interface som GithubStore, fast mot ett
// localStorage-"filsystem". Gör att hela UI:t kan köras och testas utan
// familjenyckel: öppna appen med ?dev=1.
import { ConflictError } from './github-store.js';
import { currentWeekId, addWeeks, todayStockholm, isoDateStr } from '../dates.js';
import { DEV_FAMILY, devSeedWeek, devSeedJobs } from '../dev-data.js';

const FS_PREFIX = 'mhv.devfs.';
const LOG_KEY = 'mhv.devlog';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export class LocalStore {
  constructor() {
    this._conflictOnce = false;
    this._seed();
  }

  // Nästa skrivning låtsas krocka med "någon annan" — för att kunna
  // demonstrera och testa konflikt-omförsöket i UI:t.
  simulateConflictOnce() {
    this._conflictOnce = true;
  }

  _key(path) {
    return FS_PREFIX + path;
  }

  _read(path) {
    const raw = localStorage.getItem(this._key(path));
    return raw ? JSON.parse(raw) : null;
  }

  _write(path, doc, sha) {
    localStorage.setItem(this._key(path), JSON.stringify({ doc, sha }));
  }

  _seed() {
    if (localStorage.getItem(this._key('family.json'))) return;
    const week = currentWeekId();
    const prev = addWeeks(week, -1);
    const today = isoDateStr(todayStockholm());
    this._write('family.json', DEV_FAMILY, 1);
    this._write(`weeks/${prev}.json`, devSeedWeek(prev), 1);
    this._write(`weeks/${week}.json`, devSeedWeek(week), 1);
    for (const id of DEV_FAMILY.settings.jobSeekers) {
      this._write(`jobs/${id}.json`, devSeedJobs(id, today), 1);
    }
    this._log('demodata skapad', null);
  }

  _log(message, author) {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    log.push({ message, author: author?.name || 'Demo', date: new Date().toISOString() });
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-50)));
  }

  async getFile(path, { etag } = {}) {
    await delay(120);
    const entry = this._read(path);
    if (!entry) return null;
    const currentEtag = 'W/"dev-' + entry.sha + '"';
    if (etag && etag === currentEtag) return { status: 304 };
    return {
      status: 200,
      doc: JSON.parse(JSON.stringify(entry.doc)),
      sha: String(entry.sha),
      etag: currentEtag,
    };
  }

  async putFile(path, doc, { sha, message, author } = {}) {
    await delay(150);
    const existing = this._read(path);
    if (this._conflictOnce) {
      // Låtsas att någon annan hann skriva: bumpa sha så omförsöket måste
      // hämta färskt innan det lyckas.
      this._conflictOnce = false;
      if (existing) this._write(path, existing.doc, existing.sha + 1);
      throw new ConflictError('Simulerad konflikt (dev)');
    }
    if (existing && String(existing.sha) !== String(sha)) {
      throw new ConflictError(`Konflikt vid skrivning av ${path} (dev)`);
    }
    const newSha = (existing ? existing.sha : 0) + 1;
    this._write(path, doc, newSha);
    this._log(message, author);
    return { sha: String(newSha) };
  }

  async listCommits({ perPage = 15 } = {}) {
    await delay(80);
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    return log.slice(-perPage).reverse();
  }
}

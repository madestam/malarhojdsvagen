// GitHub Contents API-klient. Medvetet fri från DOM- och localStorage-beroenden
// så att exakt samma kod kan integrationstestas i Node.
//
// All base64-hantering går via TextEncoder/TextDecoder — atob/btoa ensamma
// förstör å, ä och ö.

export class AuthError extends Error {}
export class ConflictError extends Error {}
export class RateLimitError extends Error {}
export class NetworkError extends Error {}

const API = 'https://api.github.com';

export function b64EncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function b64DecodeUtf8(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export class GithubStore {
  constructor({ owner, repo, branch = 'main', token, fetchImpl }) {
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
    this.token = token;
    this.fetch = fetchImpl || globalThis.fetch.bind(globalThis);
  }

  headers(extra = {}) {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...extra,
    };
  }

  contentsUrl(path) {
    return `${API}/repos/${this.owner}/${this.repo}/contents/${path}`;
  }

  async _fetch(url, options) {
    let res;
    try {
      res = await this.fetch(url, options);
    } catch (err) {
      throw new NetworkError('Ingen kontakt med GitHub', { cause: err });
    }
    if (res.status === 401) throw new AuthError('Nyckeln avvisades (401)');
    // 429 är alltid strypning; 403 är det när Retry-After eller nollad kvot
    // följer med (GitHubs sekundära gränser). Övriga 403 = behörighetsfel.
    if (res.status === 429 || (res.status === 403 && (
      res.headers.get('retry-after') !== null || res.headers.get('x-ratelimit-remaining') === '0'
    ))) {
      throw new RateLimitError('GitHubs gräns för anrop är nådd');
    }
    if (res.status === 403) throw new AuthError('Åtkomst nekad (403)');
    return res;
  }

  // → { status: 200, doc, sha, etag } | { status: 304 } | null (404)
  async getFile(path, { etag } = {}) {
    const res = await this._fetch(`${this.contentsUrl(path)}?ref=${this.branch}`, {
      headers: this.headers(etag ? { 'If-None-Match': etag } : {}),
      cache: 'no-store',
    });
    if (res.status === 304) return { status: 304 };
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`);
    const body = await res.json();
    return {
      status: 200,
      doc: JSON.parse(b64DecodeUtf8(body.content)),
      sha: body.sha,
      etag: res.headers.get('ETag'),
    };
  }

  // Skapar (sha == null) eller uppdaterar en fil. → { sha }
  // Kastar ConflictError när sha inte längre stämmer (någon annan hann före).
  async putFile(path, doc, { sha, message, author } = {}) {
    const body = {
      message,
      content: b64EncodeUtf8(JSON.stringify(doc, null, 2) + '\n'),
      branch: this.branch,
    };
    if (sha) body.sha = sha;
    if (author) {
      body.author = author;
      body.committer = author;
    }
    const res = await this._fetch(this.contentsUrl(path), {
      method: 'PUT',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    if (res.status === 409 || res.status === 422) {
      throw new ConflictError(`Konflikt vid skrivning av ${path}`);
    }
    if (!res.ok) throw new Error(`GitHub PUT ${path}: ${res.status}`);
    const json = await res.json();
    return { sha: json.content.sha };
  }

  // Används bara av integrationstesterna för att städa efter sig.
  async deleteFile(path, { sha, message }) {
    const res = await this._fetch(this.contentsUrl(path), {
      method: 'DELETE',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message, sha, branch: this.branch }),
    });
    if (!res.ok) throw new Error(`GitHub DELETE ${path}: ${res.status}`);
  }

  // Senaste commits i datarepot → [{ message, author, date }]
  async listCommits({ perPage = 15 } = {}) {
    const url = `${API}/repos/${this.owner}/${this.repo}/commits?sha=${this.branch}&per_page=${perPage}`;
    const res = await this._fetch(url, { headers: this.headers(), cache: 'no-store' });
    if (!res.ok) throw new Error(`GitHub commits: ${res.status}`);
    const json = await res.json();
    return json.map((c) => ({
      message: (c.commit.message || '').split('\n')[0],
      author: c.commit.author?.name || '',
      date: c.commit.author?.date || '',
    }));
  }
}

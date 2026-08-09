// Central konfiguration. OBS: inga hemligheter här — familjenyckeln finns
// endast i localStorage på varje enhet.
export const CONFIG = {
  dataOwner: 'madestam',
  dataRepo: 'malarhojdsvagen-data',
  branch: 'main',
  pollActiveMs: 60_000,
  pollFamilyMs: 300_000,
  saveRetryDelaysMs: [250, 500, 1000],
  appVersion: '1.0.0',
  repoUrl: 'https://github.com/madestam/malarhojdsvagen',
};

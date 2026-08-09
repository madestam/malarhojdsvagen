# Mälarhöjdsvägen 🐕🐕

Familjens veckoplanerare — vem går ut med hundarna, vem lagar middag,
vem handlar, och hur går det med jobbsökandet?

**Appen:** https://madestam.github.io/malarhojdsvagen/

- **Veckan** — hundpromenader (morgon/lunch/kväll) och middag för varje dag.
  Tryck på en rad och välj vem som tar passet (max två per promenad).
- **Sysslor** — veckans övriga uppgifter: handla mat, tvätt, dammsuga …
- **Jobb** — jobbsök-stöd med Arbetsförmedlingens kom-igång-steg,
  påminnelse om aktivitetsrapporten (1–14 varje månad), veckomål och
  ansökningslista.
- **Mer** — vem är jag, familjenyckeln, senaste ändringar och installation.

All data sparas i det privata repot
[malarhojdsvagen-data](https://github.com/madestam/malarhojdsvagen-data) —
varje ändring blir en git-commit, så hela historiken finns i `git log`.

## Kom igång på iPhone

1. Öppna **https://madestam.github.io/malarhojdsvagen/** i **Safari**.
2. Tryck på dela-ikonen (rutan med pilen uppåt) → **"Lägg till på hemskärmen"** → **Lägg till**.
3. Öppna appen från hemskärmen (viktigt — den installerade appen har eget minne).
4. Klistra in **familjenyckeln** (finns i familjens gemensamma anteckning, eller fråga Andreas).
5. Välj vem du är. Klart!

## Familjenyckeln

Appen läser och skriver familjens data via GitHubs API med en s.k.
fine-grained personal access token som bara kommer åt datarepot.

**Skapa/förnya nyckeln** (görs av Andreas på github.com):

1. Profilbilden → **Settings** → **Developer settings** →
   **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Namn: `familjenyckel-malarhojdsvagen`. Expiration: **1 år**.
3. **Repository access**: *Only select repositories* → `malarhojdsvagen-data`.
4. **Permissions** → Repository permissions → **Contents: Read and write**
   (Metadata: Read-only läggs till automatiskt).
5. **Generate token** och kopiera nyckeln (`github_pat_…`).
6. Dela den med familjen på säkert sätt (t.ex. gemensam anteckning) och
   spara den i lösenordshanteraren. Var och en klistrar in den i appen
   under **Mer → Familjenyckel** (eller vid första start).

När nyckeln går ut visar appen en vänlig skärm — skapa en ny och klistra in
igen (tar 15 sekunder per telefon). Nyckeln ska **aldrig** committas till
något repo.

## Utveckling

Ingen byggkedja — ren HTML/CSS/JS (ES-moduler). Kör lokalt:

```bash
python3 -m http.server 8123
```

- `http://localhost:8123/?dev=1` — **dev-läge**: kör mot lokal demodata i
  localStorage (ingen nyckel behövs). DEV-knappen uppe till höger simulerar
  en skrivkonflikt. `?dev=0` stänger av.
- Tester: `node --test` (veckomatte + modeller) och
  `GITHUB_TOKEN=$(gh auth token) node --test test/github-api.test.mjs`
  (integrationstest mot riktiga datarepot).

**Deploy** = push till `main` (GitHub Pages). Glöm inte att bumpa
`CACHE_VERSION` i `sw.js` så att telefonerna hämtar nya filer.

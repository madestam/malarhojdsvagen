# Mälarhöjdsvägen — regler för alla arbetssessioner

Familjeveckoplanerare (PWA på GitHub Pages). Ägare: madestam. Familjen:
fem medlemmar och två hundar — riktiga namn finns ENDAST i det privata
datarepot (`family.json` i madestam/malarhojdsvagen-data), aldrig här.
All UI-text är på svenska.

## Arbetsflöde (viktigt)

- **Committa och pusha efter varje avslutad ändring.** Git-historiken är en
  uttrycklig del av projektets syfte. Svenska commit-meddelanden i samma stil
  som `git log`.
- **Bumpa `CACHE_VERSION` i `sw.js` vid varje deploy** — annars ser
  telefonerna gamla filer i upp till en vecka.
- Datarepot `madestam/malarhojdsvagen-data` (privat) muteras normalt bara via
  appens API-anrop. Seedning/reparation för hand: klona, ändra, committa med
  beskrivande svenskt meddelande.
- **Hantera aldrig familjenyckeln (PAT).** Den finns bara i localStorage på
  familjens enheter. Tester mot GitHub-API:t använder `gh auth token`.
- Inga ramverk, inget byggsteg, inga beroenden — ren vanilla JS (ES-moduler).
  Nya filer måste läggas till i `ASSETS`-listan i `sw.js`.

## Arkitektur i korthet

- `js/store/github-store.js` — GitHub Contents API-klient (UTF-8-säker
  base64, ETag, sha). Inga DOM-beroenden; testas i Node.
- `js/sync.js` — `saveWithRetry`: optimistisk skrivning, vid 409-konflikt
  hämta färskt + kör om mutationen (fältnivå-merge), max 3 försök.
- `js/data.js` — fasad: cache-först-läsning (localStorage-spegel `mhv.*`),
  optimistiska mutationer, polling 60 s med ETag + refetch vid fokus.
- `js/models.js` — mutationsfabriker; `message` blir commit-meddelande i
  datarepot, `author` sätts till familjemedlemmen.
- `js/controller.js` — laddar dokument in i staten; vyerna muterar via
  `mutateWeek`/`mutateJobs`.
- `js/views/*` — rena rendervyer som ritas om vid varje `setState`.
  Formulär ligger i sheets (`ui/sheet.js`) som överlever omritningar.
- Dev-läge `?dev=1`: `local-store.js` mot localStorage-demodata (fiktiva
  namn — riktiga namn får inte förekomma i detta publika repo).

## Tester

```bash
node --test                                            # enhetstester
GITHUB_TOKEN=$(gh auth token) node --test test/github-api.test.mjs   # integration
```

Lokal körning: `python3 -m http.server 8123` → `http://localhost:8123/?dev=1`.
ISO-veckor: 2026 har 53 veckor — testerna täcker årsskiftena.

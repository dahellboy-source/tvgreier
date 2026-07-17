# TVgreier

En rask, responsiv katalog for gratis TV-strømmer fra Europa, laget for seere i Norge.

## Hva førsteversjonen gjør

- viser alle europeiske land og områder i en ryddig landvelger
- filtrerer bort strømmer med kjent GeoIP-blokkering
- avviser usikre HTTP-kilder som ikke kan spilles fra en HTTPS-side
- spiller HLS-strømmer direkte i nettleseren med `hls.js`
- åpner YouTube, Twitch og andre plattformer hos kilden
- lagrer favoritter og vellykkede avspillingssjekker lokalt i nettleseren
- har ingen konto, sporing eller backend

## Kjør lokalt

```bash
npm install
npm run dev
```

Bygg og valider:

```bash
npm test
npm run build
```

## Datakilde og avgrensning

Katalogen er et øyeblikksbilde av [Free-TV/IPTV](https://github.com/Free-TV/IPTV), et åpent prosjekt som bare tar inn gratis tilgjengelige kanaler. Importen inkluderer europeiske land, fjerner alle oppføringer merket `Ⓖ` (GeoIP) og beholder bare HTTPS-kilder.

Det er likevel umulig å garantere at en ekstern direktestrøm alltid virker. Kanaler endrer adresser og rettighetsgrenser. Derfor skiller grensesnittet mellom «ingen kjent geoblokk» og en vellykket sjekk fra brukerens egen forbindelse.

TVgreier hoster eller videresender ikke TV-innhold. Rettigheter og varemerker tilhører sine respektive eiere.

## Publisering

Workflowen i `.github/workflows/deploy.yml` bygger og publiserer `main` til GitHub Pages. Under **Settings → Pages** i GitHub må kilden settes til **GitHub Actions** første gang.

### Vercel

Prosjektet er også ferdig konfigurert for Vercel med Vite, Node 24, `dist` som output-mappe, SPA-rewrite og sikkerhets-/cache-headere.

1. Velg **Add New → Project** i Vercel.
2. Importer GitHub-repoet `dahellboy-source/tvgreier`.
3. Vercel leser `vercel.json`; ingen miljøvariabler er nødvendige.
4. Trykk **Deploy**.

Alternativt kan prosjektet publiseres fra kommandolinjen med `vercel --prod` etter innlogging.

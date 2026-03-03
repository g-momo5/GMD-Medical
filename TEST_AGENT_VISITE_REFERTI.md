# Test Agent Visite e Referti

## Scopo

Questa suite verifica tre cose:

1. che il vero layer SQL dell'app (`src/lib/db/*.ts`) non contenga pattern rischiosi per `@tauri-apps/plugin-sql`;
2. che una visita valida si salvi correttamente nel database e2e;
3. che il referto DOCX venga generato senza errori e con i placeholder obbligatori sostituiti.

In piu', esegue uno sweep dei campi principali del form, cambiandone uno alla volta.

Esiste anche un runner runtime dentro l'app, che usa davvero `@tauri-apps/plugin-sql`
e i moduli reali del frontend Tauri.

## Database usato

Di default la suite usa:

- `postgres://gmd:gmd_local@127.0.0.1:5432/gmd_platform_e2e`

Puoi sovrascriverlo con:

- `GMD_E2E_DATABASE_URL`
- oppure `--db-url`

## Comandi

- `npm run db:e2e:prepare`
  - crea o reimposta il database e2e
- `npm run test:visit-report`
  - esegue prima il preflight audit del layer DB reale, poi smoke test + field sweep
- `npm run test:visit-report:smoke`
  - esegue solo lo smoke test
- `npm run test:visit-report:fields`
  - esegue solo lo sweep dei campi
- `npm run test:visit-report:json`
  - restituisce il report finale in JSON

## Runner runtime dentro l'app

Questi due percorsi eseguono i test dentro la WebView Tauri usando il vero layer DB dell'app:

- `/__e2e__/visit-report?run=1&runtimeOutputDir=/tmp`
  - smoke test runtime con `createVisitaCompleta` + `generateVisitaReferto`
- `/__e2e__/visit-field-sweep?run=1&runtimeOutputDir=/tmp`
  - sweep runtime di alcuni casi chiave

File generati dal runner runtime:

- `/tmp/visit-report-runtime-result.json`
- `/tmp/visit-field-sweep-runtime-result.json`
- uno o piu' `.docx` in `/tmp`

## Artefatti generati

Di default gli output vengono salvati in:

- `/tmp/gmd-visit-report-e2e`

File principali:

- `visit-report-result.json`
- `visit-report-report.md`
- uno o piu' `.docx` per i casi che generano il referto

## Come leggere il risultato

### `status`

- `passed`: tutti i casi hanno dato l'esito atteso
- `failed`: almeno un caso ha fallito

### `cases[]`

Ogni caso riporta:

- sezione testata
- campo testato
- variante applicata
- esito atteso
- esito reale
- errori raccolti
- toast raccolti
- eventuali assertion sul DOCX

### Tipi di errore

- `validation`
  - errore funzionale atteso dal form
- `audit`
  - regressione nel codice reale del layer DB che puo' rompere il binding Tauri/PostgreSQL
- `db`
  - errore SQL o persistenza
- `report`
  - errore in generazione o scrittura referto
- `runtime`
  - errore non classificato del runner

## Note

- La suite e' automatica e non apre il dialog nativo di salvataggio.
- I referti vengono salvati direttamente nella cartella di output.
- I test usano transazioni con rollback per non lasciare visite persistenti nel DB e2e.
- Il runner runtime, invece, crea e poi ripulisce davvero paziente e visita di test tramite i moduli dell'app.

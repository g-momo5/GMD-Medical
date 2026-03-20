# Architettura del Programma (stato attuale)

Documento aggiornato al **14 marzo 2026** in base al codice presente nel repository.

## 1) Versione e stack

- Versione applicazione: `0.1.0`
  - `package.json`
  - `src-tauri/tauri.conf.json`
- Desktop shell: `Tauri 2`
- Frontend: `SvelteKit 2` + `Svelte 5` + `TypeScript`
- Database locale: `SQLite` via `@tauri-apps/plugin-sql`
- Referti DOCX: `docxtemplater` + `pizzip`
- Hash password: `bcryptjs`

L'app e' una desktop app locale: **nessun backend HTTP separato**.

## 2) Architettura a livelli

### Livello UI (SvelteKit)

- Routing e pagine in `src/routes`
- Componenti riusabili in `src/lib/components`
- Store globali leggeri in `src/lib/stores`

### Livello applicativo (TypeScript)

- Accesso dati e query SQL in `src/lib/db`
- Logica clinica/serializzazione in `src/lib/utils/visit-clinical.ts`
- Configurazioni cliniche in `src/lib/configs`
- Generazione referto in `src/lib/reports/generateVisitaReferto.ts`

### Livello desktop/nativo (Tauri)

- Runtime Rust in `src-tauri/src/lib.rs`
- Config app/permessi in `src-tauri/tauri.conf.json`
- Plugin nativi: SQL, dialog, fs, opener

## 3) Avvio runtime

1. `src/routes/+layout.ts` forza `ssr = false` (SPA mode).
2. `src/routes/+layout.svelte` su mount:
   - chiama `initDatabase()`
   - ripristina sessione utente (`authStore.restore()`)
   - ripristina ambulatorio corrente (`ambulatorioStore.restore()`)
3. `initDatabase()` (`src/lib/db/schema.ts`):
   - apre/riusa connessione SQLite
   - applica migrazioni
   - se DB vuoto fa bootstrap dati demo (utente admin, ambulatori demo, pazienti demo)

## 4) Frontend: routing e responsabilita'

### Routing principale

- `src/routes/+page.svelte`
  - login
- `src/routes/ambulatori/+page.svelte`
  - selezione ambulatorio
- `src/routes/ambulatori/[id]/+layout.svelte`
  - guard auth + caricamento ambulatorio + layout app
- `src/routes/ambulatori/[id]/+page.svelte`
  - dashboard e statistiche operative
- `src/routes/ambulatori/[id]/pazienti/+page.svelte`
  - gestione anagrafica + modalita cerca paziente
- `src/routes/ambulatori/[id]/visite/+page.svelte`
  - archivio visite (ricerca, modifica, eliminazione)
- `src/routes/ambulatori/[id]/visite/nuova/+page.svelte`
  - wizard nuova visita (selezione paziente + compilazione clinica)
- `src/routes/ambulatori/[id]/impostazioni/+page.svelte`
  - impostazioni ambulatorio/sistema e gestione utenti (admin)

### Layout e navigazione

- `AppLayout.svelte` gestisce struttura generale + toggle sidebar
- `Sidebar.svelte` gestisce menu, logout, cambio ambulatorio, voci disabilitate "Presto"
- `ToastContainer.svelte` mostra notifiche globali

### Stato condiviso (store)

- `authStore`
  - sessione utente in `sessionStorage` (`gmd_user`)
- `ambulatorioStore`
  - ambulatorio corrente + applicazione tema CSS
  - persistenza in `sessionStorage` (`gmd_ambulatorio`)
- `sidebarCollapsedStore`
  - stato sidebar (persistito in `localStorage` come `sidebarCollapsed`)
- `toastStore`
  - notifiche transitorie

Nota: nel login e' presente opzione "Ricordami" che salva username/password in `localStorage` (`gmd_saved_username`, `gmd_saved_password`).

## 5) Flusso visita (core applicativo)

La pagina `visite/nuova` implementa un flusso in 2 step:

1. `select_patient`
2. `compile_visit`

Caratteristiche principali:

- precompilazione da ultima visita del paziente selezionato
- caricamento storico esami ematici precedenti
- calcolo automatico `BMI` e `BSA`
- validazioni cliniche dedicate (`FH`, terapia ipolipemizzante, diabete tipo, campi minimi)
- serializzazione blocchi complessi in JSON testuale

Blocchi visita modulari in `src/lib/components/visit-blocks`:

- fattori rischio CV
- FH assessment
- anamnesi cardiologica
- terapia ipolipemizzante
- terapia domiciliare
- valutazione odierna
- esami ematici
- valutazione rischio CV
- ecocardiografia
- conclusioni
- firme visita

La visibilita' dei blocchi e' configurata in `src/lib/configs/visit-blocks-config.ts` tramite `isBlockVisibleForAmbulatorio(...)`.

## 6) Data layer (`src/lib/db`)

### Connessione e bootstrap

- `config.ts`
  - consente solo URL `sqlite:*` (attuale: `sqlite:gmd.db`)
- `client.ts`
  - singleton connessione
  - normalizzazione parametri query
  - helper `insertReturningId(...)`
- `schema.ts`
  - coordinamento init/migrazioni/bootstrap

### Migrazioni

`migrations.ts` esegue:

- creazione tabelle base (se mancanti)
- aggiunta colonne legacy mancanti (ambulatori, pazienti, visite, fattori_rischio_cv)
- creazione indici
- fix legacy su relazioni `fattori_rischio_cv -> visite`
- cleanup oggetti SQL legacy riferiti a `visite_old`
- update nome ambulatorio legacy (`Dermatologia` -> `Day Hospital Riabilitativa`)

### Moduli dominio

- `auth.ts`
  - autenticazione, CRUD utenti, cambio password
- `ambulatori.ts`
  - CRUD ambulatori
- `pazienti.ts`
  - CRUD pazienti e ricerca
- `visite.ts`
  - CRUD visite, ricerca, storico esami ematici precedenti
- `fattori-rischio-cv.ts`
  - CRUD fattori rischio associati alla visita
- `visite-complete.ts`
  - orchestrazione salvataggio visita + fattori rischio

### Tabelle principali

- `users`
- `ambulatori`
- `pazienti`
- `visite`
- `fattori_rischio_cv`

Diversi campi clinici della tabella `visite` sono `TEXT` serializzati JSON (es. `esami_ematici`, `fh_assessment`, `terapia_ipolipemizzante`, `valutazione_rischio_cv`, `firme_visita`).

## 7) Referti DOCX

### Moduli coinvolti

- Template: `src/lib/templates/template_dislip.docx`
- Generazione: `src/lib/reports/generateVisitaReferto.ts`
- Config percorso base: `src/lib/utils/report-storage.ts`

### Flusso attuale

1. la visita viene salvata in DB
2. viene caricato il template DOCX:
   - prima come asset web
   - fallback come resource bundle Tauri
3. `docxtemplater` valorizza i placeholder
4. il file viene scritto automaticamente su filesystem
5. la pagina prova ad aprirlo in Word tramite `plugin-opener`

### Percorso output

- Cartella base default: `Documenti/GMD Medical/Referti`
- Override utente: `localStorage` (`gmd_report_base_dir`) configurabile in Impostazioni
- Struttura:
  - `<base>/<Ambulatorio sanitizzato>/...`
  - per "Ambulatorio Cardiologico delle Dislipidemie" aggiunge sottocartella:
    - `Repatha` oppure `Praluent` oppure `Leqvio` oppure `Altro`

## 8) Runtime Tauri e permessi

### Entry point Rust

- `src-tauri/src/main.rs`
- `src-tauri/src/lib.rs`

Plugin inizializzati:

- `tauri-plugin-dialog`
- `tauri-plugin-fs`
- `tauri-plugin-opener`
- `tauri-plugin-sql` (SQLite)

### Config principale

`src-tauri/tauri.conf.json` definisce:

- finestra principale
- comandi build/dev frontend
- bundle resources (incluso template DOCX)
- preload SQL su `sqlite:gmd.db`
- permessi app (dialog/fs/opener/sql) per la finestra `main`

## 9) Build, comandi e modalita' sviluppo

Script da `package.json`:

- `npm run dev` -> Vite dev server
- `npm run build` -> build frontend
- `npm run check` -> type checking Svelte/TS
- `npm run audit:sqlite` -> audit URI DB non-SQLite in `src`/`src-tauri`
- `npm run tauri` -> CLI Tauri (`npm run tauri dev` / `npm run tauri build`)

## 10) Punti caldi dove intervenire

Se cambi:

- UI/UX pagine:
  - `src/routes/...`
  - `src/lib/components/...`
- regole cliniche e serializzazione:
  - `src/lib/utils/visit-clinical.ts`
  - `src/lib/configs/clinical-options.ts`
- persistenza dati o query:
  - `src/lib/db/...`
  - `src/lib/db/migrations.ts` (se cambia schema)
- referto:
  - `src/lib/reports/generateVisitaReferto.ts`
  - `src/lib/templates/template_dislip.docx`
- runtime desktop/permessi:
  - `src-tauri/tauri.conf.json`
  - `src-tauri/src/lib.rs`

## 11) Riassunto operativo

Il programma e' oggi una desktop app locale a 3 livelli:

1. `SvelteKit` per UI e orchestrazione flussi
2. moduli TypeScript per logica clinica + data access SQL
3. `Tauri` per runtime nativo, filesystem/dialog e DB SQLite

L'asse tecnico piu' critico resta:

- `visite/nuova` (flusso clinico e validazioni)
- `src/lib/db/*` (coerenza dati e migrazioni)
- `src/lib/reports/generateVisitaReferto.ts` (documenti clinici)
- `src-tauri/tauri.conf.json` (permessi e integrazione nativa)

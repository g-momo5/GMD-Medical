# Architettura del Programma

## Scopo del progetto

`GMD Medical Platform` e' un'app desktop per la gestione ambulatoriale costruita con:

- frontend `SvelteKit`
- shell desktop `Tauri`
- database locale `PostgreSQL`

L'app e' pensata come applicazione locale: il frontend parla direttamente con il database tramite i plugin Tauri, senza un backend HTTP separato.

## Struttura generale

Il progetto e' diviso in 3 livelli principali:

1. interfaccia utente (`src/routes`, `src/lib/components`)
2. logica applicativa e accesso dati (`src/lib/db`, `src/lib/utils`, `src/lib/reports`)
3. runtime desktop e permessi nativi (`src-tauri`)

In pratica:

- `SvelteKit` gestisce pagine, stato UI e componenti
- `Tauri` fornisce accesso ai plugin nativi (`sql`, `dialog`, `fs`, `opener`)
- `PostgreSQL` conserva utenti, ambulatori, pazienti, visite e dati clinici

## Frontend: come e' organizzata la UI

### Routing principale

Le pagine sono nel filesystem routing di SvelteKit:

- `src/routes/+page.svelte`
  - login iniziale
- `src/routes/ambulatori/+page.svelte`
  - selezione ambulatorio
- `src/routes/ambulatori/[id]/+page.svelte`
  - dashboard dell'ambulatorio
- `src/routes/ambulatori/[id]/pazienti/+page.svelte`
  - gestione anagrafica e cerca paziente
- `src/routes/ambulatori/[id]/visite/+page.svelte`
  - archivio visite
- `src/routes/ambulatori/[id]/visite/nuova/+page.svelte`
  - creazione nuova visita
- `src/routes/ambulatori/[id]/impostazioni/+page.svelte`
  - impostazioni dell'ambulatorio

### Componenti riusabili

I componenti UI base sono in `src/lib/components`:

- `AppLayout.svelte`: layout generale con sidebar
- `Sidebar.svelte`: menu laterale e stato attivo delle voci
- `PageHeader.svelte`: header pagina
- `Card.svelte`: card dashboard
- `Table.svelte`: tabella riusabile
- `Modal.svelte`: finestra modale base
- `Button.svelte`, `Input.svelte`, `Select.svelte`, `Textarea.svelte`
- `ToastContainer.svelte`: notifiche

Questi componenti sono riusati dalle varie pagine per mantenere uno stile coerente.

### Componenti clinici della visita

La visita non e' monolitica: e' spezzata in blocchi funzionali in `src/lib/components/visit-blocks`.

Ogni blocco rappresenta una sezione clinica specifica, per esempio:

- anamnesi
- fattori di rischio cardiovascolare
- esami ematici
- terapia ipolipemizzante
- terapia domiciliare
- conclusioni
- firme

Questo approccio riduce la complessita' di `visite/nuova/+page.svelte`, che fa da pagina orchestratrice e non contiene tutta la logica clinica in un unico file.

## Logica dati: il layer `src/lib/db`

Il progetto usa un data layer dedicato, separato dalla UI.

### Punto di ingresso del database

Il bootstrap parte da:

- `src/lib/db/schema.ts`

Qui avvengono, in ordine:

1. apertura della connessione
2. applicazione delle migration
3. eventuale import automatico dal vecchio SQLite
4. eventuale seed iniziale (admin + dati demo)

Le funzioni pubbliche usate dal resto dell'app sono:

- `initDatabase()`
- `getDatabase()`

### Connessione e gestione errori

La connessione e' centralizzata in:

- `src/lib/db/config.ts`
- `src/lib/db/client.ts`

`config.ts` contiene il path di connessione SQLite.

`client.ts` si occupa di:

- aprire la connessione a SQLite via `@tauri-apps/plugin-sql`
- riusare una singola connessione in memoria
- normalizzare i parametri prima delle query
- fornire `insertReturningId(...)` usando `lastInsertId` di SQLite

### Moduli dati separati per dominio

Ogni area del dominio ha un modulo dedicato:

- `auth.ts`: login e utenti
- `ambulatori.ts`: lettura e scrittura ambulatori
- `pazienti.ts`: CRUD pazienti e ricerca
- `visite.ts`: CRUD visite e query correlate
- `fattori-rischio-cv.ts`: dati aggiuntivi della visita
- `visite-complete.ts`: orchestrazione di salvataggi composti

Questo significa che la UI non parla direttamente a SQL raw nella pagina: chiama funzioni di dominio gia' tipizzate.

### Tipi condivisi

I tipi TypeScript condivisi stanno in:

- `src/lib/db/types.ts`

Questo file descrive i modelli applicativi principali:

- `Utente`
- `Ambulatorio`
- `Paziente`
- `Visita`
- tipi dei vari blocchi clinici della visita

L'obiettivo e' mantenere la UI coerente con la forma dei dati restituiti dal database.

## Database: modello e strategia

### Motore

Il database runtime e' `SQLite`.

Il frontend non usa un ORM: le query sono scritte a mano in SQL, con placeholder `?`.

### Migration

Le migration strutturali sono in:

- `src/lib/db/migrations.ts`

Qui viene garantito lo schema SQLite finale con:

- `users`
- `ambulatori`
- `pazienti`
- `visite`
- `fattori_rischio_cv`
- aggiunta automatica delle colonne mancanti sulle installazioni piu' vecchie

L'app usa direttamente lo stesso file SQLite storico, quindi non serve piu' una fase di import da un database separato.

## Runtime desktop: Tauri

La parte desktop sta in `src-tauri`.

### Configurazione principale

Il file chiave e':

- `src-tauri/tauri.conf.json`

Qui sono definiti:

- finestra principale
- build command frontend
- cartella del bundle
- risorse incluse nel pacchetto
- capability di sicurezza per la finestra `main`

### Plugin Tauri usati

L'app usa questi plugin:

- `plugin-sql`
  - accesso diretto al database
- `plugin-dialog`
  - finestre native, per esempio "salva con nome"
- `plugin-fs`
  - scrittura del file DOCX
- `plugin-opener`
  - apertura di file o link esterni quando necessario

### Permessi

Tauri 2 usa un modello di permessi espliciti.

Per questo, nella capability `main-capability`, sono stati dichiarati i permessi necessari per:

- query SQL
- apertura del dialog di salvataggio
- scrittura del file sul filesystem

Senza questi permessi, il frontend puo' funzionare ma le chiamate native vengono bloccate.

## Generazione del referto DOCX

La generazione del referto e' separata dalla pagina visita.

### File coinvolti

- `src/lib/templates/template_dislip.docx`
  - template Word con i placeholder
- `src/lib/reports/generateVisitaReferto.ts`
  - logica di sostituzione placeholder e salvataggio

### Come funziona

Il flusso e':

1. la visita viene salvata nel database
2. la pagina chiama `generateVisitaReferto(...)`
3. il template DOCX viene caricato
   - prima come asset web
   - in fallback come risorsa Tauri bundle
4. `docxtemplater` sostituisce i placeholder
5. `plugin-dialog` chiede all'utente dove salvare
6. `plugin-fs` scrive il file `.docx`

### Responsabilita' del modulo referto

`generateVisitaReferto.ts` contiene:

- formattazione date
- conversione dei campi clinici in testo leggibile
- gestione dei blocchi opzionali del template
- applicazione del limite a 3 specializzandi
- scelta del nome file
- gestione degli errori specifici del referto

Questo evita di mettere logica di documento direttamente dentro la pagina Svelte.

## Flusso tecnico di una nuova visita

Il caso d'uso piu' importante dell'app e' la creazione di una visita.

### Sequenza semplificata

1. l'utente apre `visite/nuova`
2. seleziona o crea il paziente
3. compila i blocchi clinici
4. la pagina raccoglie i valori dai vari componenti
5. chiama il layer dati (`visite-complete.ts` / `visite.ts`)
6. vengono salvate:
   - riga principale `visite`
   - eventuale riga `fattori_rischio_cv`
7. se richiesto, parte la generazione del referto DOCX

### Perche' esiste `visite-complete.ts`

La visita e' composta da piu' sotto-sezioni. Per questo esiste un modulo di orchestrazione che coordina:

- salvataggio dei dati base della visita
- salvataggio di strutture collegate
- logica condizionale, per esempio non creare record vuoti inutili

In questo modo la pagina UI non deve conoscere i dettagli di persistenza.

## Stato e comunicazione tra componenti

L'app non usa un sistema complesso di state management globale.

Lo stato e' gestito soprattutto in modo locale tramite:

- variabili reattive Svelte nei singoli file
- `props` e `bind:` tra pagina e componenti
- moduli TypeScript condivisi per la logica

Questo rende il progetto relativamente semplice da seguire, ma comporta una forte responsabilita' delle pagine orchestratrici, soprattutto in:

- `src/routes/ambulatori/[id]/visite/nuova/+page.svelte`
- `src/routes/ambulatori/[id]/pazienti/+page.svelte`
- `src/routes/ambulatori/[id]/visite/+page.svelte`

## Scelte architetturali importanti

### 1. Nessun backend HTTP

Scelta:

- il frontend parla direttamente a Tauri e al database

Vantaggi:

- app piu' semplice da distribuire localmente
- meno componenti da mantenere

Tradeoff:

- la logica dati vive nel client
- sicurezza e permessi Tauri diventano centrali

### 2. SQL raw invece di ORM

Scelta:

- query scritte manualmente

Vantaggi:

- controllo totale sulle query
- meno astrazione

Tradeoff:

- bisogna gestire a mano cast, placeholder, compatibilita' tra DB
- piu' attenzione richiesta durante le migrazioni

### 3. Visita modulare a blocchi

Scelta:

- una visita e' composta da componenti clinici separati

Vantaggi:

- codice piu' leggibile
- sezioni riusabili e piu' facili da manutenere

Tradeoff:

- la pagina padre deve coordinare molti stati

## Build e avvio

Gli script principali sono in `package.json`:

- `npm run dev`
  - sviluppo frontend
- `npm run build`
  - build SvelteKit
- `npm run tauri`
  - avvio CLI Tauri
In sviluppo reale, il flusso tipico e':

1. `npm run tauri dev` oppure `npm run tauri`
2. il frontend viene servito da Vite
3. Tauri apre la finestra desktop che carica la UI e il database SQLite

## Dove intervenire in base al tipo di modifica

### Se vuoi cambiare la UI

Intervieni in:

- `src/routes/...`
- `src/lib/components/...`

### Se vuoi cambiare il comportamento del database

Intervieni in:

- `src/lib/db/...`

Se cambia lo schema:

- `src/lib/db/migrations.ts`

### Se vuoi cambiare il referto

Intervieni in:

- `src/lib/templates/template_dislip.docx`
- `src/lib/reports/generateVisitaReferto.ts`

### Se vuoi cambiare permessi o accesso nativo

Intervieni in:

- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json`

## Riassunto finale

Dal punto di vista della programmazione, questo software e' una desktop app a livelli:

- presentazione in `SvelteKit`
- logica applicativa in moduli TypeScript
- accesso dati diretto a `PostgreSQL` via plugin Tauri
- integrazione nativa desktop tramite permessi e plugin Tauri

La parte piu' sensibile del progetto e' l'asse:

- `visite/nuova`
- `src/lib/db/*`
- `src/lib/reports/generateVisitaReferto.ts`
- `src-tauri/tauri.conf.json`

Perche' e' il punto in cui si incontrano UI, persistenza, generazione documenti e permessi desktop.

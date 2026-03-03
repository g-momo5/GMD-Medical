# PostgreSQL Locale - Runbook

## Prerequisiti

- Docker Desktop o un engine Docker compatibile
- Node.js installato
- App Tauri completamente chiusa durante il cutover

## Setup PostgreSQL locale

1. Avvia PostgreSQL:
   - `npm run db:up`
2. Controlla i log se necessario:
   - `npm run db:logs`
3. DSN di default:
   - `postgres://gmd:gmd_local@127.0.0.1:5432/gmd_platform`

Per usare una connessione diversa, imposta `VITE_DATABASE_URL` per l'app e `DATABASE_URL` per lo script di migrazione.

## Cutover SQLite -> PostgreSQL

1. Chiudi completamente l'app Tauri.
2. Esegui un backup di sicurezza di `gmd.db`.
3. Avvia PostgreSQL con `npm run db:up`.
4. Avvia una volta l'app aggiornata per creare schema e baseline migration su PostgreSQL.
5. Chiudi di nuovo l'app.
6. Esegui la migrazione dati:
   - `npm run db:migrate:sqlite-to-pg`
7. Riavvia l'app e verifica login, pazienti, visite e salvataggio nuovi record.

## Verifiche consigliate

- Login admin funzionante
- Dashboard caricata
- Archivio visite visibile
- Cerca paziente visibile
- Creazione nuova visita e nuovo paziente funzionanti

## Rollback

1. Ferma l'app.
2. Ferma PostgreSQL:
   - `npm run db:down`
3. Torna alla build SQLite precedente.
4. Usa il file `gmd.db` originale o il backup `gmd.db.bak.<timestamp>`.

Lo script di import non modifica il contenuto di `gmd.db`; crea solo una copia di backup.

# GMD Medical Platform

Piattaforma desktop per la gestione di ambulatori ospedalieri, sviluppata con Tauri + SvelteKit.

## 🚀 Caratteristiche

- **Multi-ambulatorio**: Gestione di più ambulatori con temi personalizzati
- **Offline-first**: Funziona completamente in locale con database SQLite
- **Cross-platform**: Compatibile con Windows e macOS
- **Modular**: Architettura modulare per aggiungere facilmente nuove funzionalità
- **Design moderno**: UI minimal e moderna con sistema di temi dinamici

## 🏗️ Architettura

### Stack Tecnologico

- **Framework**: Tauri 2.x (Rust backend)
- **Frontend**: SvelteKit + TypeScript
- **Database**: SQLite
- **Styling**: CSS puro con CSS Variables
- **Autenticazione**: bcrypt per password hashing

### Struttura del Progetto

```
gmd-platform/
├── src/
│   ├── lib/
│   │   ├── components/     # Componenti UI riusabili
│   │   ├── db/            # Database layer (schema, queries)
│   │   └── stores/        # Svelte stores (auth, ambulatorio)
│   ├── routes/            # Pagine SvelteKit
│   └── app.css           # Stili globali e design system
├── src-tauri/            # Backend Tauri (Rust)
└── static/               # Assets statici
```

## 📋 Prerequisiti

### Per Sviluppo

1. **Node.js** (v18 o superiore)
2. **Rust** (ultima versione stabile)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
3. **Tauri Prerequisites**:
   - **macOS**: Xcode Command Line Tools
     ```bash
     xcode-select --install
     ```
   - **Windows**: Microsoft Visual Studio C++ Build Tools

## 🛠️ Installazione

1. **Clona il repository** (o naviga nella cartella del progetto)

2. **Installa le dipendenze**:
   ```bash
   npm install
   ```

## 💻 Sviluppo

### Avvia l'applicazione in modalità sviluppo:

```bash
npm run tauri dev
```

Questo comando:
- Avvia il server di sviluppo Vite
- Compila il backend Rust
- Apre l'applicazione desktop con hot-reload

### Credenziali Demo

- **Username**: `admin`
- **Password**: `admin123`

## 📦 Build per Produzione

### Build per il tuo sistema operativo:

```bash
npm run tauri build
```

Gli eseguibili saranno disponibili in:
- **macOS**: `src-tauri/target/release/bundle/dmg/` e `src-tauri/target/release/bundle/macos/`
- **Windows**: `src-tauri/target/release/bundle/msi/` e `src-tauri/target/release/bundle/nsis/`

### Build per Windows (da macOS):

```bash
# Aggiungi target Windows
rustup target add x86_64-pc-windows-msvc

# Build
npm run tauri build -- --target x86_64-pc-windows-msvc
```

**Nota**: Cross-compilation da macOS a Windows richiede configurazione aggiuntiva. È consigliato buildare su Windows nativo per risultati ottimali.

### Build per macOS (da Windows):

Il cross-compilation da Windows a macOS non è supportato ufficialmente. È necessario buildare su macOS nativo.

## 🎨 Personalizzazione Temi

Ogni ambulatorio può avere una palette di 3 colori personalizzata:

```typescript
{
  color_primary: '#1e3a8a',    // Colore principale
  color_secondary: '#3b82f6',  // Colore secondario
  color_accent: '#22d3ee'      // Colore accent
}
```

I colori vengono applicati automaticamente tramite CSS Variables quando si seleziona un ambulatorio.

## 📊 Database

Il database SQLite viene creato automaticamente al primo avvio dell'applicazione.

### Schema Tabelle

- **users**: Utenti del sistema (admin, medico, infermiere)
- **ambulatori**: Configurazione ambulatori e temi
- **pazienti**: Anagrafica pazienti

### Location Database

Il database `gmd.db` viene salvato nella cartella dei dati dell'applicazione:
- **macOS**: `~/Library/Application Support/com.gmdmedical.platform/`
- **Windows**: `%APPDATA%/com.gmdmedical.platform/`

## 🔧 Moduli Disponibili

### ✅ Modulo Pazienti (v1.0)

- Creazione, modifica, eliminazione pazienti
- Ricerca per nome, cognome, codice fiscale
- Campi: dati anagrafici, residenza, contatti, esenzioni

### 🚧 Moduli Futuri

- Appuntamenti/Agenda
- Cartelle Cliniche
- Prescrizioni
- Fatturazione
- Statistiche e Report

## 🔐 Sicurezza

- Password hashate con bcrypt (salt rounds: 10)
- Autenticazione basata su sessione (sessionStorage)
- Database locale (nessuna connessione esterna)
- Validazione input lato client e database

## 🐛 Debug

### Errori comuni

1. **Database non inizializzato**:
   - Verifica che il plugin `tauri-plugin-sql` sia correttamente configurato
   - Controlla la console per errori di inizializzazione

2. **Errore di build Rust**:
   - Assicurati di avere Rust installato: `rustc --version`
   - Aggiorna Rust: `rustup update`

3. **Errore di autenticazione**:
   - Verifica le credenziali demo: admin/admin123
   - Controlla che il database sia stato inizializzato correttamente

### Console di sviluppo

- Apri DevTools: Click destro → Inspect Element
- Visualizza log database nella console JavaScript

## 📝 Licenza

Proprietà di GMD Medical. Tutti i diritti riservati.

## 👥 Team

Sviluppato da GMD Medical Team

---

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).

**Versione**: 0.1.0
**Ultima modifica**: Novembre 2024

# Guida alla Modularità - GMD Medical Platform

Questa guida spiega come aggiungere nuovi moduli alla piattaforma GMD Medical mantenendo l'architettura modulare.

## 🏗️ Architettura Modulare

La piattaforma è progettata per supportare diversi moduli che possono essere attivati/disattivati per ogni ambulatorio.

### Moduli Attuali

- ✅ **Gestione Pazienti** - Anagrafica completa pazienti

### Moduli Pianificati

- 🚧 **Appuntamenti/Agenda** - Calendario e gestione appuntamenti
- 🚧 **Cartelle Cliniche** - Storia clinica e referti
- 🚧 **Prescrizioni** - Ricette e prescrizioni mediche
- 🚧 **Fatturazione** - Gestione fatture e pagamenti
- 🚧 **Magazzino** - Inventario materiali e farmaci
- 🚧 **Statistiche** - Report e analisi dati

## 📋 Come Aggiungere un Nuovo Modulo

### 1. Database Schema

Aggiungi le tabelle necessarie in `src/lib/db/schema.ts`:

```typescript
// Esempio: Modulo Appuntamenti
await db.execute(`
  CREATE TABLE IF NOT EXISTS appuntamenti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ambulatorio_id INTEGER NOT NULL,
    paziente_id INTEGER NOT NULL,
    data_ora DATETIME NOT NULL,
    durata INTEGER DEFAULT 30,
    tipo TEXT NOT NULL,
    note TEXT,
    stato TEXT DEFAULT 'programmato',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ambulatorio_id) REFERENCES ambulatori(id) ON DELETE CASCADE,
    FOREIGN KEY (paziente_id) REFERENCES pazienti(id) ON DELETE CASCADE
  )
`);

// Aggiungi indici per performance
await db.execute(`
  CREATE INDEX IF NOT EXISTS idx_appuntamenti_data
  ON appuntamenti(data_ora)
`);
```

### 2. TypeScript Types

Crea i tipi in `src/lib/db/types.ts`:

```typescript
export interface Appuntamento {
  id: number;
  ambulatorio_id: number;
  paziente_id: number;
  data_ora: string;
  durata: number;
  tipo: string;
  note: string;
  stato: 'programmato' | 'completato' | 'cancellato';
  created_at: string;
  updated_at: string;
}

export interface CreateAppuntamentoInput {
  ambulatorio_id: number;
  paziente_id: number;
  data_ora: string;
  durata?: number;
  tipo: string;
  note?: string;
}
```

### 3. Database Operations

Crea un file per le operazioni CRUD in `src/lib/db/appuntamenti.ts`:

```typescript
import { getDatabase } from './schema';
import type { Appuntamento, CreateAppuntamentoInput } from './types';

export async function getAppuntamentiByAmbulatorio(
  ambulatorioId: number,
  data?: string
): Promise<Appuntamento[]> {
  const db = getDatabase();

  if (data) {
    return await db.select<Appuntamento[]>(
      `SELECT a.*, p.nome, p.cognome
       FROM appuntamenti a
       JOIN pazienti p ON a.paziente_id = p.id
       WHERE a.ambulatorio_id = ? AND DATE(a.data_ora) = ?
       ORDER BY a.data_ora`,
      [ambulatorioId, data]
    );
  }

  return await db.select<Appuntamento[]>(
    `SELECT a.*, p.nome, p.cognome
     FROM appuntamenti a
     JOIN pazienti p ON a.paziente_id = p.id
     WHERE a.ambulatorio_id = ?
     ORDER BY a.data_ora DESC`,
    [ambulatorioId]
  );
}

export async function createAppuntamento(
  data: CreateAppuntamentoInput
): Promise<number> {
  const db = getDatabase();
  const result = await db.execute(
    `INSERT INTO appuntamenti (
      ambulatorio_id, paziente_id, data_ora, durata, tipo, note
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.ambulatorio_id,
      data.paziente_id,
      data.data_ora,
      data.durata || 30,
      data.tipo,
      data.note || ''
    ]
  );
  return result.lastInsertId;
}

// ... altre operazioni CRUD
```

### 4. Componenti UI (opzionale)

Se il modulo richiede componenti specifici, creali in `src/lib/components/`:

```typescript
// src/lib/components/Calendar.svelte
<script lang="ts">
  export let selectedDate = '';
  // ... logica calendario
</script>

<div class="calendar">
  <!-- UI calendario -->
</div>
```

### 5. Routes

Crea le pagine del modulo in `src/routes/ambulatori/[id]/`:

```
src/routes/ambulatori/[id]/
├── appuntamenti/
│   ├── +page.svelte          # Lista appuntamenti
│   └── calendario/
│       └── +page.svelte       # Vista calendario
```

Esempio `+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getAppuntamentiByAmbulatorio } from '$lib/db/appuntamenti';
  import type { Appuntamento } from '$lib/db/types';

  let ambulatorioId: number;
  let appuntamenti: Appuntamento[] = [];

  $: ambulatorioId = parseInt($page.params.id);

  onMount(async () => {
    appuntamenti = await getAppuntamentiByAmbulatorio(ambulatorioId);
  });
</script>

<div class="appuntamenti-page">
  <!-- UI del modulo -->
</div>
```

### 6. Navigation

Aggiungi i link al nuovo modulo nel menu laterale (da creare):

```svelte
<!-- src/lib/components/Sidebar.svelte -->
<nav class="sidebar">
  <a href="/ambulatori/{ambulatorioId}/pazienti">Pazienti</a>
  <a href="/ambulatori/{ambulatorioId}/appuntamenti">Appuntamenti</a>
  <!-- Altri moduli -->
</nav>
```

## 🎛️ Configurazione Moduli per Ambulatorio

Per abilitare/disabilitare moduli per specifici ambulatori:

### 1. Aggiungi campo alla tabella ambulatori

```typescript
await db.execute(`
  ALTER TABLE ambulatori
  ADD COLUMN moduli_abilitati TEXT DEFAULT '["pazienti"]'
`);
```

### 2. Gestisci i moduli abilitati

```typescript
// src/lib/db/ambulatori.ts
export async function updateModuliAbilitati(
  ambulatorioId: number,
  moduli: string[]
): Promise<void> {
  const db = getDatabase();
  await db.execute(
    'UPDATE ambulatori SET moduli_abilitati = ? WHERE id = ?',
    [JSON.stringify(moduli), ambulatorioId]
  );
}

export async function getModuliAbilitati(
  ambulatorioId: number
): Promise<string[]> {
  const db = getDatabase();
  const result = await db.select<Array<{ moduli_abilitati: string }>>(
    'SELECT moduli_abilitati FROM ambulatori WHERE id = ?',
    [ambulatorioId]
  );
  return JSON.parse(result[0].moduli_abilitati);
}
```

### 3. Conditional Rendering

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { getModuliAbilitati } from '$lib/db/ambulatori';

  let moduliAbilitati: string[] = [];

  onMount(async () => {
    moduliAbilitati = await getModuliAbilitati(ambulatorioId);
  });
</script>

<nav class="sidebar">
  {#if moduliAbilitati.includes('pazienti')}
    <a href="/ambulatori/{ambulatorioId}/pazienti">Pazienti</a>
  {/if}

  {#if moduliAbilitati.includes('appuntamenti')}
    <a href="/ambulatori/{ambulatorioId}/appuntamenti">Appuntamenti</a>
  {/if}
</nav>
```

## 🔒 Permessi per Ruolo

Gestisci i permessi in base al ruolo utente:

```svelte
<script lang="ts">
  import { authStore } from '$lib/stores/auth';

  let currentUser;
  authStore.subscribe(state => {
    currentUser = state.user;
  });

  // Check permessi
  const canCreateAppointment = currentUser?.role === 'admin' || currentUser?.role === 'medico';
</script>

{#if canCreateAppointment}
  <Button on:click={openCreateModal}>Nuovo Appuntamento</Button>
{/if}
```

## 📁 Struttura File Consigliata per Nuovo Modulo

```
src/
├── lib/
│   ├── components/
│   │   └── NomeModulo/           # Componenti specifici modulo
│   │       ├── ComponenteA.svelte
│   │       └── ComponenteB.svelte
│   └── db/
│       ├── nomeModulo.ts         # CRUD operations
│       └── types.ts              # Aggiorna con nuovi tipi
├── routes/
│   └── ambulatori/
│       └── [id]/
│           └── nome-modulo/      # Route del modulo
│               ├── +page.svelte
│               └── [subpage]/
│                   └── +page.svelte
```

## ✅ Checklist Nuovo Modulo

- [ ] Schema database creato
- [ ] Tipi TypeScript definiti
- [ ] Funzioni CRUD implementate
- [ ] Componenti UI creati
- [ ] Routes configurate
- [ ] Navigazione aggiunta
- [ ] Permessi implementati
- [ ] Test manuali completati
- [ ] Documentazione aggiornata

## 🎨 Design Consistency

Mantieni la coerenza visiva usando i componenti base:

- `Button.svelte` - Pulsanti
- `Input.svelte` - Input di testo
- `Select.svelte` - Dropdown
- `Modal.svelte` - Finestre modali
- `Card.svelte` - Card container
- `Table.svelte` - Tabelle dati

Usa sempre le CSS Variables del design system:

```css
.custom-component {
  background-color: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}
```

## 🚀 Best Practices

1. **Separazione delle responsabilità**: Database, logica, UI separate
2. **Riutilizzo componenti**: Usa i componenti base esistenti
3. **Validazione**: Valida input lato client E database
4. **Error handling**: Gestisci sempre gli errori
5. **Loading states**: Mostra stati di caricamento
6. **Responsive**: Testa su diverse risoluzioni
7. **Accessibilità**: Usa label, aria-labels, keyboard navigation

## 📚 Risorse Utili

- [Svelte Docs](https://svelte.dev/docs)
- [SvelteKit Docs](https://kit.svelte.dev/docs)
- [Tauri Docs](https://tauri.app/v1/guides/)
- [SQLite Docs](https://www.sqlite.org/docs.html)

---

**Nota**: Questa guida sarà aggiornata man mano che aggiungiamo nuovi moduli alla piattaforma.

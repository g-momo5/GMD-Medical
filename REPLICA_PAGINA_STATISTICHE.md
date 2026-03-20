# Specifica per ricreare la pagina "Statistiche Pazienti e Terapie"

Usa questo documento come istruzione per ricreare in un altro programma la pagina statistiche presente in questa applicazione.

Importante: replica solo struttura, contenuto, comportamento e gerarchia informativa. Non copiare il tema grafico attuale (colori, ombre, bordi, palette, font, variabili CSS, branding o look & feel specifico).

## Obiettivo

Ricreare una vista dedicata alle statistiche cliniche che mostra un riepilogo sintetico dei pazienti e delle terapie tramite card e liste.

La pagina deve essere leggibile, responsive e composta da blocchi indipendenti, facilmente riusabili anche in altri stack (web app, desktop app, pannello gestionale, ecc.).

## Struttura della pagina

La vista deve contenere questi elementi, in questo ordine:

1. Un controllo per tornare alla home o alla vista precedente.
2. Un contenitore principale della sezione.
3. Un titolo: `Statistiche Pazienti e Terapie`.
4. Una griglia responsive che ospita le card statistiche.

## Layout logico

All'interno della griglia crea questi blocchi:

1. Card KPI: `Totale Pazienti`
2. Card KPI: `Totale Visite`
3. Card lista: `Target Colesterolo LDL`
4. Card dettaglio: `Pazienti con Inibitori PCSK9`
5. Card lista: `Pazienti per Terapia (Top)`
6. Card lista: `Rischio CV`
7. Card lista: `Comorbidità`

Il layout deve adattarsi a più colonne su schermi ampi e collassare automaticamente su una colonna su schermi stretti.

## Contenuto di ogni blocco

### 1. Totale Pazienti

Mostra un singolo valore numerico grande:

- etichetta: `Totale Pazienti`
- valore: `totalPatients`

### 2. Totale Visite

Mostra un singolo valore numerico grande:

- etichetta: `Totale Visite`
- valore: `totalVisits`
- se il dato manca, mostra `-`

### 3. Target Colesterolo LDL

Mostra due righe:

- `Pazienti a Target` -> `patientsAtTarget`
- `Pazienti non a Target` -> `patientsNotAtTarget`

Se i valori mancano, usa `0` oppure `-` in base alla normalizzazione scelta, ma in modo coerente.

### 4. Pazienti con Inibitori PCSK9

Questa card ha una struttura leggermente diversa:

- un totale principale: `pcsk9Stats.total`
- un sottotitolo informativo: `Totali`
- tre righe di dettaglio:
  - `Repatha` -> `pcsk9Stats.repatha`
  - `Praluent` -> `pcsk9Stats.praluent`
  - `Leqvio` -> `pcsk9Stats.leqvio`

### 5. Pazienti per Terapia (Top)

Mostra una lista di righe generate dinamicamente da `topTherapyStats`.

Ogni riga contiene:

- nome terapia: `item.therapy`
- conteggio: `item.count`

Se la lista è vuota, mostra una singola riga di fallback:

- etichetta: `Nessun dato disponibile`
- valore: `0`

### 6. Rischio CV

Mostra una lista di righe generate da `riskStats`.

Ogni riga contiene:

- livello di rischio: `item.risk`
- conteggio: `item.count`

L'ordinamento atteso dei livelli è:

1. `Molto Alto`
2. `Alto`
3. `Moderato`
4. `Basso`

Se la lista è vuota, usa lo stesso fallback di cui sopra.

### 7. Comorbidità

Mostra una lista di righe generate da `fdrcvStats`.

Ogni riga contiene:

- etichetta: `item.label`
- valore composto: `item.count (item.percentage%)`

Le etichette attese sono:

1. `Diabete`
2. `Ipertensione`
3. `Obesità`
4. `Fumo`
5. `Familiarità`

Se la lista è vuota, usa una riga di fallback con `Nessun dato disponibile`.

## Contratto dati consigliato

Normalizza i dati in un unico oggetto con questa forma:

```js
{
  totalPatients: number,
  totalVisits: number | null,
  patientsAtTarget: number,
  patientsNotAtTarget: number,
  pcsk9Stats: {
    total: number,
    repatha: number,
    praluent: number,
    leqvio: number
  },
  topTherapyStats: [
    { therapy: string, count: number }
  ],
  riskStats: [
    { risk: "Molto Alto" | "Alto" | "Moderato" | "Basso", count: number }
  ],
  fdrcvStats: [
    { label: string, count: number, percentage: string | number }
  ]
}
```

Se nel programma di destinazione i dati arrivano da fonti diverse, crea prima un adapter e poi renderizza la vista usando solo questo formato normalizzato.

## Comportamento richiesto

La pagina deve comportarsi cosi:

1. Quando l'utente apre la vista statistiche, esegui un caricamento asincrono dei dati.
2. Mostra uno stato di loading mentre la richiesta è in corso.
3. Quando i dati arrivano, sostituisci il contenuto della griglia con le card.
4. Se il caricamento fallisce, mostra un errore sintetico e non lasciare la pagina vuota.
5. Se l'oggetto ricevuto non è valido, mostra almeno una card placeholder con titolo `Statistiche` e valore `-`.

## Regole di implementazione

Per mantenere la replica indipendente dal tema corrente:

1. Usa classi o componenti semantici generici come `stats-grid`, `kpi-card`, `list-card`, `detail-card`.
2. Definisci spaziature, tipografia e colori da zero nel progetto di destinazione.
3. Non copiare i CSS esistenti.
4. Non usare variabili di design o token legati a questa app.
5. Mantieni solo la stessa architettura visiva: griglia di card, titoli, valori principali, liste.

## Comportamento responsive minimo

La griglia deve:

1. usare più colonne quando c'è spazio sufficiente;
2. passare a una sola colonna su viewport piccoli;
3. evitare overflow orizzontale;
4. mantenere leggibili i numeri principali e le etichette lunghe.

## Suggerimento tecnico

Se stai ricreando la pagina in un altro codicebase, implementa in questo ordine:

1. crea il contenitore della vista;
2. crea un componente riusabile per card KPI;
3. crea un componente riusabile per card lista;
4. crea un componente dedicato alla card PCSK9;
5. aggiungi la funzione di fetch/caricamento dati;
6. normalizza il payload;
7. renderizza i blocchi nell'ordine definito sopra;
8. aggiungi fallback per liste vuote, payload mancante ed errori.

## Criteri di accettazione

La replica è corretta se:

1. la pagina mostra gli stessi 7 blocchi logici;
2. l'ordine dei blocchi è invariato;
3. i dati vengono caricati in modo asincrono;
4. esistono fallback per dati assenti;
5. la resa visiva non dipende dal tema dell'app originale.

## Riferimento funzionale nel progetto attuale

La versione originale da cui deriva questa specifica si basa su:

- vista HTML: `index.html` (`statisticsView` e `statisticsContent`)
- logica frontend: `renderer.js` (`showStatisticsView`, `loadStatistics`, `displayStatistics`, `renderPostgresStatistics`)
- fonte dati: `preload.js` (`getStatistics`) e `main.js` (`handleGetStatistics`)

Questi riferimenti servono solo per capire la funzione della pagina, non per copiarne il tema.

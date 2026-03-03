<script lang="ts">
  import { rischioCVOptions } from '$lib/configs/clinical-options';
  import type {
    EsamiEmaticiValues,
    RischioCVLevel,
    ValutazioneRischioCardiovascolare
  } from '$lib/db/types';
  import { normalizeValutazioneRischioCV } from '$lib/utils/visit-clinical';
  import Card from '../Card.svelte';

  export let valutazione: ValutazioneRischioCardiovascolare;
  export let esami: EsamiEmaticiValues;

  let effectiveValutazione = normalizeValutazioneRischioCV(valutazione, esami);

  $: effectiveValutazione = normalizeValutazioneRischioCV(valutazione, esami);

  function handleRiskChange(event: Event) {
    const target = event.currentTarget as HTMLSelectElement;
    valutazione = normalizeValutazioneRischioCV(
      {
        ...valutazione,
        rischio: target.value as RischioCVLevel
      },
      esami
    );
  }

  function formatLdlValue(value: number | null): string {
    if (value === null) {
      return 'Non disponibile';
    }

    return `${new Intl.NumberFormat('it-IT', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }).format(value)} mg/dL`;
  }

  function getStatusTone(): 'success' | 'danger' | 'warning' {
    if (effectiveValutazione.status === 'raggiunto') return 'success';
    if (effectiveValutazione.status === 'non_raggiunto') return 'danger';
    return 'warning';
  }

  function getStatusHeadline(): string {
    if (!effectiveValutazione.rischio) {
      return '--';
    }

    if (effectiveValutazione.status === 'non_valutabile') {
      return 'Inserire LDL';
    }

    return effectiveValutazione.status === 'raggiunto' ? 'Target raggiunto' : 'Target non raggiunto';
  }
</script>

<Card>
  <div class="section-shell">
    <div class="section-copy">
      <h2 class="section-title">Valutazione Rischio Cardiovascolare</h2>
    </div>

    <div class="risk-board">
      <div class="board-segment board-select">
        <label for="rischio-cv" class="field-label">Rischio CV</label>
        <select id="rischio-cv" value={effectiveValutazione.rischio} on:change={handleRiskChange}>
          <option value="">Seleziona...</option>
          {#each rischioCVOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <div class="board-segment board-metric">
        <span class="metric-label">Target LDL-C</span>
        <strong class="metric-value">
          {#if effectiveValutazione.targetLdl !== null}
            &lt;{effectiveValutazione.targetLdl} mg/dL
          {:else}
            --
          {/if}
        </strong>
      </div>

      <div class="board-segment board-status status-{getStatusTone()}">
        <span class="metric-label">A target</span>
        <strong class="status-value">{getStatusHeadline()}</strong>
        {#if effectiveValutazione.rischio || effectiveValutazione.status === 'non_valutabile'}
          <span class="status-note">{effectiveValutazione.statusMessage}</span>
        {/if}
      </div>
    </div>
  </div>

  <div class="detail-strip">
    <div class="detail-item">
      <span class="detail-label">LDL corrente</span>
      <strong class="detail-value">{formatLdlValue(effectiveValutazione.ldlAttuale)}</strong>
    </div>
  </div>
</Card>

<style>
  .section-shell {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .section-title {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--color-text);
    padding-bottom: var(--space-3);
    border-bottom: 2px solid var(--color-border);
  }

  .risk-board {
    display: grid;
    grid-template-columns: minmax(210px, 1.2fr) minmax(150px, 0.8fr) minmax(200px, 1fr);
    gap: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0)),
      var(--color-bg-secondary);
  }

  .board-segment {
    min-height: 106px;
    padding: var(--space-4);
  }

  .board-segment + .board-segment {
    border-left: 1px solid var(--color-border);
  }

  .board-select {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-2);
  }

  .field-label,
  .metric-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--color-text-secondary);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  select {
    width: 100%;
    height: 38px;
    padding: 0 var(--space-4);
    font-size: var(--text-base);
    font-family: var(--font-sans);
    color: var(--color-text);
    background-color: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-sizing: border-box;
  }

  select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
  }

  .board-metric {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    background: rgba(30, 58, 138, 0.04);
  }

  .metric-value {
    font-size: clamp(1rem, 2vw, 1.35rem);
    line-height: 1.1;
    font-weight: 800;
    color: var(--color-text);
  }

  .board-status {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
  }

  .status-value {
    font-size: clamp(1.25rem, 2.6vw, 1.8rem);
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.02em;
  }

  .status-note {
    font-size: var(--text-sm);
    line-height: 1.4;
    font-weight: 600;
  }

  .status-success {
    background: linear-gradient(180deg, rgba(16, 185, 129, 0.14), rgba(16, 185, 129, 0.08));
  }

  .status-success .status-value,
  .status-success .status-note {
    color: #047857;
  }

  .status-danger {
    background: linear-gradient(180deg, rgba(239, 68, 68, 0.14), rgba(239, 68, 68, 0.08));
  }

  .status-danger .status-value,
  .status-danger .status-note {
    color: #b91c1c;
  }

  .status-warning {
    background: linear-gradient(180deg, rgba(250, 204, 21, 0.18), rgba(250, 204, 21, 0.1));
  }

  .status-warning .status-value,
  .status-warning .status-note {
    color: #92400e;
  }

  .detail-strip {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    margin-top: var(--space-2);
    padding: 0;
    background: none;
  }

  .detail-item {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
  }

  .detail-label {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .detail-value {
    font-size: var(--text-sm);
    color: var(--color-text);
  }

  @media (max-width: 840px) {
    .risk-board {
      grid-template-columns: 1fr;
    }

    .board-segment + .board-segment {
      border-left: none;
      border-top: 1px solid var(--color-border);
    }

    .board-segment {
      min-height: 0;
    }
  }

  @media (max-width: 640px) {
    .detail-strip {
      align-items: baseline;
      flex-direction: row;
    }
  }
</style>

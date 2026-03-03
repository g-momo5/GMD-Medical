<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getE2EConfig } from '$lib/testing/e2e-config';
  import {
    runRuntimeVisitSuite,
    type RuntimeVisitE2ESuiteResult
  } from '$lib/testing/visit-runtime-e2e';

  type RunnerState = 'idle' | 'running' | 'passed' | 'failed';

  $: config = getE2EConfig($page.url.searchParams);

  let state: RunnerState = 'idle';
  let suite: RuntimeVisitE2ESuiteResult | null = null;
  let fatalError = '';
  let hasAutoRunStarted = false;

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim()) {
      return error;
    }

    return 'Errore sconosciuto';
  }

  async function runSuite() {
    state = 'running';
    suite = null;
    fatalError = '';

    try {
      const result = await runRuntimeVisitSuite('smoke', config);
      suite = result;
      state = result.status === 'passed' ? 'passed' : 'failed';
    } catch (error) {
      fatalError = getErrorMessage(error);
      state = 'failed';
    }
  }

  onMount(() => {
    if (config.enabled && !hasAutoRunStarted) {
      hasAutoRunStarted = true;
      void runSuite();
    }
  });
</script>

<svelte:head>
  <title>E2E Visit Report Runtime</title>
</svelte:head>

<div class="e2e-page">
  <h1>Visit Report Runtime</h1>
  <p>
    Questo runner usa i moduli reali dell'app dentro la WebView Tauri:
    <code>createVisitaCompleta</code> e <code>generateVisitaReferto</code>.
  </p>

  <div class="e2e-card">
    <div><strong>Auto-run:</strong> {config.enabled ? 'attivo' : 'disattivo'}</div>
    <div><strong>Output runtime:</strong> {config.runtimeOutputDir}</div>
    <div><strong>Stato:</strong> {state}</div>
    <button type="button" class="run-button" on:click={runSuite} disabled={state === 'running'}>
      {state === 'running' ? 'Esecuzione in corso...' : 'Esegui smoke runtime'}
    </button>
  </div>

  {#if fatalError}
    <div class="e2e-card error-card">
      <strong>Errore fatale</strong>
      <div>{fatalError}</div>
    </div>
  {/if}

  {#if suite}
    <div class="e2e-card">
      <div><strong>Esito suite:</strong> {suite.status}</div>
      <div><strong>Case:</strong> {suite.summary.totalCases}</div>
      <div><strong>Passati:</strong> {suite.summary.passedCases}</div>
      <div><strong>Falliti:</strong> {suite.summary.failedCases}</div>
      <div><strong>JSON:</strong> {suite.resultPath}</div>
      {#if suite.cases[0]?.reportPath}
        <div><strong>DOCX:</strong> {suite.cases[0].reportPath}</div>
      {/if}
    </div>

    {#if suite.globalErrors.length > 0}
      <div class="e2e-card error-card">
        <strong>Errori raccolti</strong>
        <ul>
          {#each suite.globalErrors as error}
            <li>[{error.phase}] {error.message}</li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="e2e-card">
      <strong>Assertions</strong>
      <ul>
        {#each suite.cases[0]?.assertions || [] as assertion}
          <li>{assertion.passed ? 'PASS' : 'FAIL'} {assertion.name}</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .e2e-page {
    padding: 24px;
    display: grid;
    gap: 16px;
  }

  .e2e-card {
    padding: 16px;
    border: 1px solid #d1d5db;
    border-radius: 12px;
    display: grid;
    gap: 8px;
    background: #fff;
  }

  .error-card {
    border-color: #ef4444;
    background: #fef2f2;
  }

  .run-button {
    width: fit-content;
    padding: 10px 14px;
    border-radius: 10px;
    border: none;
    background: #0f766e;
    color: #fff;
    font: inherit;
    cursor: pointer;
  }

  .run-button:disabled {
    opacity: 0.6;
    cursor: default;
  }

  ul {
    margin: 0;
    padding-left: 20px;
  }

  code {
    font-family: monospace;
  }
</style>

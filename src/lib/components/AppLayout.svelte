<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Sidebar from './Sidebar.svelte';
  import { ambulatorioStore } from '$lib/stores/ambulatorio';
  import { sidebarCollapsedStore } from '$lib/stores/sidebar';

  export let ambulatorioId: number;

  $: ambulatorio = $ambulatorioStore.current;
  let showE2ETools = false;

  function toggleSidebar() {
    sidebarCollapsedStore.update(val => !val);
  }

  async function openE2ERunner(mode: 'smoke' | 'field-sweep') {
    showE2ETools = false;
    const path = mode === 'smoke' ? '/__e2e__/visit-report' : '/__e2e__/visit-field-sweep';
    await goto(`${path}?run=1&runtimeOutputDir=/tmp`);
  }

  onMount(() => {
    // Ripristina lo stato della sidebar dal localStorage
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      sidebarCollapsedStore.set(JSON.parse(saved));
    }
  });

  // Salva lo stato quando cambia
  $: if (typeof window !== 'undefined') {
    localStorage.setItem('sidebarCollapsed', JSON.stringify($sidebarCollapsedStore));
  }
</script>

<div class="app-layout" class:sidebar-collapsed={$sidebarCollapsedStore}>
  <Sidebar {ambulatorioId} collapsed={$sidebarCollapsedStore} />

  <button class="sidebar-toggle" on:click={toggleSidebar} title={$sidebarCollapsedStore ? 'Espandi sidebar' : 'Riduci sidebar'}>
    <svg class="icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      {#if $sidebarCollapsedStore}
        <polyline points="9 18 15 12 9 6"/>
      {:else}
        <polyline points="15 18 9 12 15 6"/>
      {/if}
    </svg>
  </button>

  <main class="main-content">
    <slot />
  </main>

  <div class="e2e-tools">
    {#if showE2ETools}
      <div class="e2e-panel">
        <button type="button" class="e2e-panel-button" on:click={() => openE2ERunner('smoke')}>
          Smoke E2E
        </button>
        <button
          type="button"
          class="e2e-panel-button"
          on:click={() => openE2ERunner('field-sweep')}
        >
          Sweep E2E
        </button>
      </div>
    {/if}

    <button
      type="button"
      class="e2e-trigger"
      aria-label="Apri strumenti E2E"
      title="Strumenti E2E"
      on:click={() => (showE2ETools = !showE2ETools)}
    >
      .
    </button>
  </div>
</div>

<style>
  .app-layout {
    min-height: 100vh;
    position: relative;
  }

  .main-content {
    margin-left: 256px; /* Width of sidebar (16rem) */
    transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    min-height: 100vh;
  }

  .sidebar-toggle {
    position: fixed;
    left: 240px;
    top: 50%;
    transform: translateY(-50%);
    width: 32px;
    height: 32px;
    background-color: var(--color-bg);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 101;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar-toggle:hover {
    background-color: var(--color-bg-secondary);
    border-color: var(--color-icon);
  }

  /* Quando la sidebar è collassata */
  .sidebar-collapsed .main-content {
    margin-left: 0;
  }

  .sidebar-collapsed .sidebar-toggle {
    left: 10px;
  }

  .e2e-tools {
    position: fixed;
    right: 12px;
    bottom: 12px;
    z-index: 120;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .e2e-trigger {
    width: 14px;
    height: 14px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.08);
    color: rgba(15, 23, 42, 0.16);
    font-size: 10px;
    line-height: 1;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
  }

  .e2e-trigger:hover,
  .e2e-trigger:focus-visible {
    background: rgba(15, 23, 42, 0.16);
    color: rgba(15, 23, 42, 0.45);
    transform: scale(1.1);
  }

  .e2e-panel {
    display: grid;
    gap: 6px;
    padding: 10px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
    backdrop-filter: blur(8px);
  }

  .e2e-panel-button {
    min-width: 96px;
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg);
    color: var(--color-text);
    font: inherit;
    font-size: var(--text-xs);
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }

  .e2e-panel-button:hover {
    background: var(--color-bg-secondary);
    border-color: var(--color-icon);
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from './Sidebar.svelte';
  import Icon from './Icon.svelte';
  import { ambulatorioStore } from '$lib/stores/ambulatorio';
  import { sidebarCollapsedStore } from '$lib/stores/sidebar';

  export let ambulatorioId: number;

  $: ambulatorio = $ambulatorioStore.current;

  function toggleSidebar() {
    sidebarCollapsedStore.update(val => !val);
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
    {#if $sidebarCollapsedStore}
      <Icon name="chevron-right" size={20} />
    {:else}
      <Icon name="chevron-left" size={20} />
    {/if}
  </button>

  <main class="main-content">
    <slot />
  </main>
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
</style>

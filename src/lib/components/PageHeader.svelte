<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let title: string;
  export let subtitle: string = '';
  export let backUrl: string = '';
  export let onBack: (() => void) | null = null;
  export let showLogo: boolean = false;

  let scrollProgress = 0; // 0 = non scrollato, 1 = completamente scrollato
  let scrollContainer: HTMLElement | null = null;

  const SCROLL_DISTANCE = 60; // Distanza in pixel per completare la transizione

  onMount(() => {
    // Trova il contenitore scrollabile (il div.app)
    scrollContainer = document.querySelector('.app') as HTMLElement;

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
    }
  });

  onDestroy(() => {
    if (scrollContainer) {
      scrollContainer.removeEventListener('scroll', handleScroll);
    }
  });

  function handleScroll() {
    if (scrollContainer) {
      const scrollTop = scrollContainer.scrollTop;
      // Calcola il progresso dello scroll (da 0 a 1)
      scrollProgress = Math.min(scrollTop / SCROLL_DISTANCE, 1);
    }
  }

  function handleBackClick() {
    if (onBack) {
      onBack();
    }
  }

  // Calcola valori interpolati basati sul progresso dello scroll
  $: paddingTop = 16 - (scrollProgress * 4); // Da 16px (var(--space-4)) a 12px (var(--space-3))
  $: paddingBottom = 16 - (scrollProgress * 4);
  $: titleSize = 1.875 - (scrollProgress * 0.5); // Da 1.875rem (text-3xl) a 1.375rem (text-xl+)
  $: subtitleOpacity = 1 - scrollProgress;
  $: subtitleHeight = 20 * (1 - scrollProgress); // Altezza del sottotitolo che si riduce
  $: buttonSize = 40 - (scrollProgress * 4); // Da 40px a 36px
  $: buttonFontSize = 1.5 - (scrollProgress * 0.125); // Da 1.5rem a 1.375rem
</script>

<div
  class="page-header"
  style="padding: {paddingTop}px 0 {paddingBottom}px 0;"
>
  <div class="header-content">
    <div class="header-left">
      {#if showLogo}
        <img src="/logo_aziendale.png" alt="GMD Medical" class="header-logo" />
      {/if}
      {#if backUrl || onBack}
        <button
          class="btn-back"
          on:click={handleBackClick}
          title="Torna indietro"
          style="width: {buttonSize}px; height: {buttonSize}px; font-size: {buttonFontSize}rem;"
        >
          ←
        </button>
      {/if}
      <div class="header-text">
        <h1 class="page-title" style="font-size: {titleSize}rem;">{title}</h1>
        {#if subtitle}
          <p
            class="page-subtitle"
            style="opacity: {subtitleOpacity}; height: {subtitleHeight}px; overflow: hidden;"
          >
            {subtitle}
          </p>
        {/if}
      </div>
    </div>
    <div class="header-right">
      <slot name="actions" />
    </div>
  </div>

  <!-- Gradient fade-out effect -->
  <div class="fade-gradient"></div>
</div>

<style>
  .page-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background-color: var(--color-bg);
    margin-bottom: var(--space-6);
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex: 1;
  }

  .header-logo {
    height: 50px;
    width: auto;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-shrink: 0;
  }

  .header-text {
    display: flex;
    flex-direction: column;
    padding: 10px 0px 8px;
    gap: var(--space-1);
  }

  .page-title {
    font-weight: 600;
    color: var(--color-text);
    margin: 0;
  }

  .page-subtitle {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .btn-back {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background-color: var(--color-bg);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-full);
    color: var(--color-text);
    cursor: pointer;
    transition: background-color var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
  }

  .btn-back:hover {
    background-color: var(--color-bg-secondary);
    border-color: var(--color-text-tertiary);
    transform: translateX(-2px);
  }

  /* Gradient fade-out effect per il contenuto che passa sotto */
  .fade-gradient {
    position: absolute;
    bottom: -40px;
    left: 0;
    right: 0;
    height: 40px;
    background: linear-gradient(to bottom, var(--color-bg), transparent);
    pointer-events: none;
  }
</style>

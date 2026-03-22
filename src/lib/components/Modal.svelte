<script lang="ts">
  export let open = false;
  export let title = '';
  export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let closeOnBackdropClick = true;
  export let hideFooter = false;
  export let compactHeader = false;

  function handleBackdropClick(e: MouseEvent) {
    if (!closeOnBackdropClick) {
      return;
    }

    if (e.target === e.currentTarget) {
      open = false;
    }
  }

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      open = false;
    }
  }
</script>

<svelte:window on:keydown={handleEscape} />

{#if open}
  <div class="modal-backdrop" on:click={handleBackdropClick} role="presentation">
    <div class="modal modal-{size}" class:modal-compact-header={compactHeader} role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3 class="modal-title">{title}</h3>
        <button class="modal-close" on:click={() => (open = false)} aria-label="Chiudi">
          ✕
        </button>
      </div>
      <div class="modal-content">
        <slot />
      </div>
      {#if !hideFooter}
        <div class="modal-footer">
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn var(--transition-base);
  }

  .modal {
    background-color: var(--color-bg);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xl);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    animation: slideUp var(--transition-base);
  }

  .modal-sm { width: 400px; max-width: 90vw; }
  .modal-md { width: 600px; max-width: 90vw; }
  .modal-lg { width: 800px; max-width: 90vw; }
  .modal-xl { width: 1000px; max-width: 90vw; }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-6);
    border-bottom: 1px solid var(--color-border);
  }

  .modal-compact-header .modal-header {
    padding-top: var(--space-2);
    padding-bottom: var(--space-2);
  }

  .modal-title {
    font-size: var(--text-xl);
    font-weight: 600;
    margin: 0;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: var(--text-2xl);
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: var(--space-2);
    line-height: 1;
    transition: color var(--transition-fast);
  }

  .modal-close:hover {
    color: var(--color-text);
  }

  .modal-content {
    padding: var(--space-6);
    overflow-y: auto;
    flex: 1;
  }

  .modal-footer {
    padding: var(--space-6);
    border-top: 1px solid var(--color-border);
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>

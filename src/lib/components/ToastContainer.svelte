<script lang="ts">
  import { toastStore } from '$lib/stores/toast';
  import type { Toast } from '$lib/stores/toast';

  let toasts: Toast[] = [];
  $: toasts = $toastStore;

  function getIcon(type: string) {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return '';
    }
  }

  function handleToastKeydown(event: KeyboardEvent, toast: Toast): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toastStore.dismiss(toast.id);
    }
  }
</script>

<div class="toast-container">
  {#each toasts as toast (toast.id)}
    <div
      class="toast toast-{toast.type}"
      class:dismissing={toast.dismissing}
      role="button"
      tabindex="0"
      on:click={() => toastStore.dismiss(toast.id)}
      on:keydown={(event) => handleToastKeydown(event, toast)}
    >
      <span class="toast-icon">{getIcon(toast.type)}</span>
      <span class="toast-message">{toast.message}</span>
      <button type="button" class="toast-close" on:click|stopPropagation={() => toastStore.dismiss(toast.id)}>
        ×
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: var(--space-6);
    right: var(--space-6);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    pointer-events: none;
  }

  .toast {
    pointer-events: all;
    min-width: 300px;
    max-width: 500px;
    padding: var(--space-4);
    background: white;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    animation: slideIn 0.3s ease-out;
    cursor: pointer;
    border-left: 4px solid;
  }

  .toast.dismissing {
    animation: slideOut 0.3s ease-in forwards;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  .toast-success {
    border-left-color: var(--color-success);
  }

  .toast-error {
    border-left-color: var(--color-error);
  }

  .toast-warning {
    border-left-color: var(--color-warning);
  }

  .toast-info {
    border-left-color: var(--color-info);
  }

  .toast-icon {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: var(--text-sm);
    flex-shrink: 0;
  }

  .toast-success .toast-icon {
    background-color: var(--color-success);
    color: white;
  }

  .toast-error .toast-icon {
    background-color: var(--color-error);
    color: white;
  }

  .toast-warning .toast-icon {
    background-color: var(--color-warning);
    color: white;
  }

  .toast-info .toast-icon {
    background-color: var(--color-info);
    color: white;
  }

  .toast-message {
    flex: 1;
    font-size: var(--text-sm);
    color: var(--color-text);
  }

  .toast-close {
    width: 20px;
    height: 20px;
    border: none;
    background: none;
    font-size: 20px;
    line-height: 1;
    color: var(--color-text-secondary);
    cursor: pointer;
    flex-shrink: 0;
    transition: color var(--transition-fast);
  }

  .toast-close:hover {
    color: var(--color-text);
  }
</style>

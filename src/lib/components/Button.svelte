<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let fullWidth = false;
</script>

<button
  {type}
  {disabled}
  class="btn btn-{variant} btn-{size}"
  class:full-width={fullWidth}
  on:click
>
  <slot />
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    font-family: var(--font-sans);
    font-weight: 500;
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Sizes */
  .btn-sm {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
  }

  .btn-md {
    padding: var(--space-3) var(--space-5);
    font-size: var(--text-base);
  }

  .btn-lg {
    padding: var(--space-4) var(--space-6);
    font-size: var(--text-lg);
  }

  /* Variants */
  .btn-primary {
    background-color: var(--color-bg);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--color-bg-secondary);
    border-color: var(--color-text-secondary);
  }

  .btn-secondary {
    background-color: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text);
  }

  .btn-outline {
    background-color: transparent;
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-outline:hover:not(:disabled) {
    background-color: var(--color-bg-secondary);
  }

  .btn-ghost {
    background-color: transparent;
    color: var(--color-text-secondary);
  }

  .btn-ghost:hover:not(:disabled) {
    background-color: var(--color-bg-secondary);
    color: var(--color-text);
  }

  .btn-danger {
    background-color: var(--color-bg);
    color: var(--color-error);
    border: 1px solid var(--color-border);
  }

  .btn-danger:hover:not(:disabled) {
    background-color: var(--color-bg-secondary);
    border-color: var(--color-error);
  }

  .full-width {
    width: 100%;
  }
</style>

<script lang="ts">
  export let padding: 'none' | 'sm' | 'md' | 'lg' = 'md';
  export let hover = false;
  export let clickable = false;
</script>

{#if clickable}
<button
  class="card"
  class:card-sm={padding === 'sm'}
  class:card-md={padding === 'md'}
  class:card-lg={padding === 'lg'}
  class:card-hover={hover}
  class:card-clickable={clickable}
  on:click
  type="button"
>
  <slot />
</button>
{:else}
<div
  class="card"
  class:card-sm={padding === 'sm'}
  class:card-md={padding === 'md'}
  class:card-lg={padding === 'lg'}
  class:card-hover={hover}
>
  <slot />
</div>
{/if}

<style>
  .card {
    background-color: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    transition: all var(--transition-base);
    font-family: inherit;
    text-align: left;
  }

  button.card {
    width: 100%;
  }

  .card-sm {
    padding: var(--space-4);
  }

  .card-md {
    padding: var(--space-6);
  }

  .card-lg {
    padding: var(--space-8);
  }

  .card-hover:hover {
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px);
  }

  .card-clickable {
    cursor: pointer;
  }

  .card-clickable:hover {
    border-color: var(--color-primary);
  }

  .card-clickable:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
  }
</style>

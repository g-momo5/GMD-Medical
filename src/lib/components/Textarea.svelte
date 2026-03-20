<script lang="ts">
  export let id: string;
  export let label = '';
  export let value = '';
  export let placeholder = '';
  export let rows = 5;
  export let error = '';
  export let required = false;
  export let disabled = false;

  let textareaElement: HTMLTextAreaElement;

  // Espone l'elemento textarea al componente parent
  export function getElement(): HTMLTextAreaElement {
    return textareaElement;
  }
</script>

<div class="textarea-group">
  {#if label}
    <label for={id} class="textarea-label">
      {label}
      {#if required}
        <span class="required-indicator">*</span>
      {/if}
    </label>
  {/if}
  <textarea
    bind:this={textareaElement}
    {id}
    bind:value
    {placeholder}
    {rows}
    {required}
    {disabled}
    class:error
    on:blur
    on:focus
    on:input
    on:change
    on:keydown
  ></textarea>
  {#if error}
    <span class="error-message">{error}</span>
  {/if}
</div>

<style>
  .textarea-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .textarea-label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  .required-indicator {
    color: var(--color-error);
    margin-left: 2px;
  }

  textarea {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    color: var(--color-text);
    background: var(--color-bg-primary);
    font-family: inherit;
    line-height: 1.6;
    resize: vertical;
    min-height: 100px;
    transition: all 0.2s;
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  textarea.error {
    border-color: var(--color-error);
  }

  textarea:disabled {
    background-color: var(--color-bg-secondary);
    cursor: not-allowed;
    opacity: 0.6;
  }

  textarea::placeholder {
    color: var(--color-text-secondary);
    opacity: 0.6;
  }

  .error-message {
    font-size: var(--text-xs);
    color: var(--color-error);
  }
</style>

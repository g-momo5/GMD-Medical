<script lang="ts">
  import type { AutocompleteItem } from '$lib/types/autocomplete';

  export let id = '';
  export let label = '';
  export let value = '';
  export let placeholder = '';
  export let required = false;
  export let error = '';
  export let items: AutocompleteItem[] = [];
  export let minChars = 3;
  export let onSelect: ((item: AutocompleteItem) => void) | null = null;

  let searchTerm = value;
  let filteredItems: AutocompleteItem[] = [];
  let showDropdown = false;
  let selectedIndex = -1;
  let isFocused = false;

  // Evita di sovrascrivere il testo mentre l'utente sta digitando.
  $: if (!isFocused && value !== searchTerm) {
    searchTerm = value;
  }

  $: {
    if (searchTerm.length >= minChars) {
      filteredItems = items
        .filter((item) => item.nome.toLowerCase().includes(searchTerm.toLowerCase()))
        .slice(0, 10);
      showDropdown = filteredItems.length > 0;
    } else {
      filteredItems = [];
      showDropdown = false;
    }
  }

  function selectItem(item: AutocompleteItem): void {
    searchTerm = item.nome;
    value = item.nome;
    showDropdown = false;
    selectedIndex = -1;
    if (onSelect) {
      onSelect(item);
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!showDropdown) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredItems.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && filteredItems[selectedIndex]) {
          selectItem(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        showDropdown = false;
        selectedIndex = -1;
        break;
      default:
        break;
    }
  }

  function handleBlur(): void {
    // Ritardo per permettere il click su un item
    setTimeout(() => {
      isFocused = false;
      showDropdown = false;
      selectedIndex = -1;
    }, 200);
  }

  function handleInput(event: Event): void {
    const target = event.currentTarget as HTMLInputElement;
    searchTerm = target.value;
    value = target.value;
  }

  function handleFocus(): void {
    isFocused = true;

    if (searchTerm.length < minChars) {
      return;
    }

    filteredItems = items
      .filter((item) => item.nome.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 10);
    showDropdown = filteredItems.length > 0;
  }
</script>

<div class="input-wrapper">
  {#if label}
    <label for={id}>
      {label}
      {#if required}
        <span class="required">*</span>
      {/if}
    </label>
  {/if}

  <div class="autocomplete-container">
    <input
      {id}
      type="text"
      bind:value={searchTerm}
      {placeholder}
      {required}
      on:input={handleInput}
      on:keydown={handleKeydown}
      on:blur={handleBlur}
      on:focus={handleFocus}
      autocomplete="off"
    />

    {#if showDropdown}
      <div class="dropdown">
        {#each filteredItems as item, index}
          <button
            type="button"
            class="dropdown-item"
            class:selected={index === selectedIndex}
            on:click={() => selectItem(item)}
          >
            {item.nome}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#if error}
    <span class="error-message">
      ⚠️ {error}
    </span>
  {/if}
</div>

<style>
  .input-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
  }

  label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  .required {
    color: var(--color-error);
    margin-left: var(--space-1);
  }

  .autocomplete-container {
    position: relative;
    width: 100%;
  }

  input {
    width: 100%;
    height: 34px;
    padding: 0 var(--space-4);
    font-size: var(--text-base);
    font-family: var(--font-sans);
    color: var(--color-text);
    background-color: var(--color-bg);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    transition: all var(--transition-fast);
    box-sizing: border-box;
    -webkit-box-sizing: border-box;
    -moz-box-sizing: border-box;
  }

  input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  input::placeholder {
    color: var(--color-text-tertiary);
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background-color: var(--color-bg);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    box-shadow: var(--shadow-lg);
  }

  .dropdown-item {
    width: 100%;
    padding: var(--space-3) var(--space-4);
    text-align: left;
    border: none;
    background: none;
    cursor: pointer;
    font-size: var(--text-base);
    font-family: var(--font-sans);
    color: var(--color-text);
    transition: background-color var(--transition-fast);
    border-bottom: 1px solid var(--color-border);
  }

  .dropdown-item:last-child {
    border-bottom: none;
  }

  .dropdown-item:hover,
  .dropdown-item.selected {
    background-color: var(--color-bg-secondary);
  }

  .error-message {
    font-size: var(--text-sm);
    color: var(--color-error);
    margin-left: var(--space-1);
  }
</style>

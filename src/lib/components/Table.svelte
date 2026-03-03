<script lang="ts">
  export let columns: Array<{
    key: string;
    label: string;
    width?: string;
    format?: (value: any) => string;
  }> = [];
  export let data: Array<any> = [];
  export let emptyMessage = 'Nessun dato disponibile';
  export let showActions = true;
  export let onRowClick: ((row: any) => void) | null = null;
  export let selectedRowId: string | number | null = null;
  export let rowIdKey = 'id';
  export let maxHeight: string | undefined = undefined;

  function getCellValue(row: any, column: any): string {
    const value = row[column.key];
    if (column.format && value) {
      return column.format(value);
    }
    return value || '-';
  }

  function isSelectedRow(row: any): boolean {
    if (selectedRowId === null || selectedRowId === undefined) {
      return false;
    }

    return row?.[rowIdKey] === selectedRowId;
  }

  function handleInteractiveRowClick(row: any) {
    if (onRowClick) {
      onRowClick(row);
    }
  }

  function handleInteractiveRowKeydown(event: KeyboardEvent, row: any) {
    if (!onRowClick) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick(row);
    }
  }
</script>

<div class="table-container" class:is-scrollable={!!maxHeight} style={maxHeight ? `max-height: ${maxHeight};` : undefined}>
  <table class="table">
    <thead>
      <tr>
        {#each columns as column}
          <th style={column.width ? `width: ${column.width}` : ''}>{column.label}</th>
        {/each}
        {#if showActions}
          <th style="width: 120px">Azioni</th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#if data.length === 0}
        <tr>
          <td colspan={columns.length + (showActions ? 1 : 0)} class="empty-cell">
            {emptyMessage}
          </td>
        </tr>
      {:else}
        {#each data as row}
          {#if onRowClick}
            <tr
              class="interactive-row"
              class:selected={isSelectedRow(row)}
              tabindex="0"
              role="button"
              on:click={() => handleInteractiveRowClick(row)}
              on:keydown={(event) => handleInteractiveRowKeydown(event, row)}
            >
              {#each columns as column}
                <td>
                  <slot name="cell" {row} {column}>
                    {getCellValue(row, column)}
                  </slot>
                </td>
              {/each}
              {#if showActions}
                <td class="actions-cell">
                  <slot name="actions" {row} />
                </td>
              {/if}
            </tr>
          {:else}
            <tr>
              {#each columns as column}
                <td>
                  <slot name="cell" {row} {column}>
                    {getCellValue(row, column)}
                  </slot>
                </td>
              {/each}
              {#if showActions}
                <td class="actions-cell">
                  <slot name="actions" {row} />
                </td>
              {/if}
            </tr>
          {/if}
        {/each}
      {/if}
    </tbody>
  </table>
</div>

<style>
  .table-container {
    background-color: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
  }

  .table-container.is-scrollable {
    overflow-y: auto;
  }

  .table-container.is-scrollable th {
    position: sticky;
    top: 0;
    z-index: 1;
    background-color: var(--color-bg-secondary);
  }

  .table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    background-color: var(--color-bg-secondary);
  }

  th {
    text-align: left;
    padding: var(--space-4) var(--space-4);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text);
    border-bottom: 2px solid var(--color-border);
  }

  tbody tr {
    transition: background-color var(--transition-fast);
  }

  tbody tr:hover {
    background-color: var(--color-bg-secondary);
  }

  .interactive-row {
    cursor: pointer;
  }

  .interactive-row:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  .interactive-row.selected {
    background-color: var(--color-bg-secondary);
    box-shadow: inset 3px 0 0 var(--color-primary);
  }

  tbody tr:not(:last-child) {
    border-bottom: 1px solid var(--color-border);
  }

  td {
    padding: var(--space-1) var(--space-4);
    font-size: var(--text-sm);
    color: var(--color-text);
  }

  .empty-cell {
    text-align: center;
    color: var(--color-text-secondary);
    padding: var(--space-12) var(--space-4);
  }

  .actions-cell {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
  }

  th:last-child {
    text-align: center;
  }
</style>

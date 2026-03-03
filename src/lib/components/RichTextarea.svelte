<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';

  export let id: string;
  export let value = '';
  export let placeholder = '';
  export let rows = 5;

  let contentEditableDiv: HTMLDivElement;
  let isUpdating = false;

  // Converti Markdown in HTML
  function markdownToHtml(markdown: string): string {
    let html = markdown;

    // Grassetto: **text** -> <strong>text</strong>
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Corsivo: *text* -> <em>text</em> (solo se non è già parte di **)
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Sottolineato: __text__ -> <u>text</u>
    html = html.replace(/__(.+?)__/g, '<u>$1</u>');

    // Converti newline in <br>
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  // Converti HTML in Markdown
  function htmlToMarkdown(html: string): string {
    let markdown = html;

    // Rimuovi <div> e </div> che contenteditable può aggiungere
    markdown = markdown.replace(/<div>/g, '\n').replace(/<\/div>/g, '');

    // Converti <br> in newline
    markdown = markdown.replace(/<br\s*\/?>/g, '\n');

    // Grassetto: <strong>text</strong> -> **text**
    markdown = markdown.replace(/<strong>(.+?)<\/strong>/g, '**$1**');
    markdown = markdown.replace(/<b>(.+?)<\/b>/g, '**$1**');

    // Corsivo: <em>text</em> -> *text*
    markdown = markdown.replace(/<em>(.+?)<\/em>/g, '*$1*');
    markdown = markdown.replace(/<i>(.+?)<\/i>/g, '*$1*');

    // Sottolineato: <u>text</u> -> __text__
    markdown = markdown.replace(/<u>(.+?)<\/u>/g, '__$1__');

    // Rimuovi eventuali tag HTML rimanenti
    markdown = markdown.replace(/<[^>]+>/g, '');

    // Pulisci newline multipli all'inizio e alla fine
    markdown = markdown.replace(/^\n+|\n+$/g, '');

    return markdown;
  }

  // Aggiorna il contenuto del div quando il value cambia
  $: if (contentEditableDiv && !isUpdating) {
    const html = markdownToHtml(value);
    if (contentEditableDiv.innerHTML !== html) {
      // Salva la posizione del cursore
      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const cursorOffset = range ? range.startOffset : 0;
      const cursorNode = range ? range.startContainer : null;

      contentEditableDiv.innerHTML = html;

      // Ripristina il cursore se possibile
      if (cursorNode && contentEditableDiv.contains(cursorNode)) {
        try {
          const newRange = document.createRange();
          newRange.setStart(cursorNode, Math.min(cursorOffset, cursorNode.textContent?.length || 0));
          newRange.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(newRange);
        } catch (e) {
          // Ignora errori di posizionamento cursore
        }
      }
    }
  }

  // Gestisci input dell'utente
  function handleInput() {
    if (contentEditableDiv) {
      isUpdating = true;
      const html = contentEditableDiv.innerHTML;
      value = htmlToMarkdown(html);
      isUpdating = false;
    }
  }

  // Gestisci paste per rimuovere formattazione esterna
  function handlePaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') || '';

    // Inserisci il testo senza formattazione
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    handleInput();
  }

  export function getElement(): HTMLDivElement {
    return contentEditableDiv;
  }

  onMount(() => {
    if (contentEditableDiv) {
      contentEditableDiv.innerHTML = markdownToHtml(value);
    }
  });
</script>

<div class="rich-textarea-wrapper">
  <div
    bind:this={contentEditableDiv}
    {id}
    contenteditable="true"
    class="rich-textarea"
    style="min-height: {rows * 1.5}em;"
    on:input={handleInput}
    on:paste={handlePaste}
    on:blur
    on:focus
    on:keydown
    data-placeholder={placeholder}
  />
</div>

<style>
  .rich-textarea-wrapper {
    position: relative;
    width: 100%;
  }

  .rich-textarea {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: var(--text-base);
    line-height: 1.5;
    color: var(--color-text);
    background: var(--color-bg-primary);
    transition: all 0.2s;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .rich-textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .rich-textarea:empty:before {
    content: attr(data-placeholder);
    color: var(--color-text-secondary);
    opacity: 0.6;
  }

  /* Stili per il testo formattato */
  .rich-textarea strong {
    font-weight: 700;
  }

  .rich-textarea em {
    font-style: italic;
  }

  .rich-textarea u {
    text-decoration: underline;
  }
</style>

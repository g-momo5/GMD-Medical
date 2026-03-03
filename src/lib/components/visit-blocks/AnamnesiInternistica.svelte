<script lang="ts">
  import Card from '../Card.svelte';
  import RichTextarea from '../RichTextarea.svelte';

  export let anamnesi_internistica = '';

  let richTextareaComponent: any;
  let richTextareaElement: HTMLDivElement;

  // Stato dei pulsanti di formattazione
  let isBoldActive = false;
  let isItalicActive = false;
  let isUnderlineActive = false;

  // Ottiene l'elemento div contenteditable dal componente
  $: if (richTextareaComponent) {
    richTextareaElement = richTextareaComponent.getElement();
  }

  // Aggiorna lo stato dei pulsanti in base alla posizione del cursore
  function updateFormattingState() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let node: Node | null = range.commonAncestorContainer;

    // Se è un text node, prendi il parent
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode;
    }

    // Resetta gli stati
    isBoldActive = false;
    isItalicActive = false;
    isUnderlineActive = false;

    // Controlla tutti i parent fino al richTextareaElement
    while (node && node !== richTextareaElement) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = (node as Element).tagName;
        if (tagName === 'STRONG' || tagName === 'B') isBoldActive = true;
        if (tagName === 'EM' || tagName === 'I') isItalicActive = true;
        if (tagName === 'U') isUnderlineActive = true;
      }
      node = node.parentNode;
    }
  }

  // Gestisci i click e i cambiamenti di selezione per aggiornare lo stato
  function handleSelectionChange() {
    if (richTextareaElement && document.activeElement === richTextareaElement) {
      updateFormattingState();
    }
  }

  // Helper per ottenere la posizione del cursore nel testo plain
  function getCursorPosition(): number {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(richTextareaElement);
    preCaretRange.setEnd(range.endContainer, range.endOffset);

    // Conta solo il testo, ignorando HTML
    return preCaretRange.toString().length;
  }

  // Helper per impostare la posizione del cursore
  function setCursorPosition(pos: number) {
    const selection = window.getSelection();
    if (!selection) return;

    let charCount = 0;
    let foundPosition = false;

    function traverseNodes(node: Node): boolean {
      if (foundPosition) return true;

      if (node.nodeType === Node.TEXT_NODE) {
        const textLength = node.textContent?.length || 0;
        if (charCount + textLength >= pos) {
          const range = document.createRange();
          range.setStart(node, pos - charCount);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          foundPosition = true;
          return true;
        }
        charCount += textLength;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        for (const child of Array.from(node.childNodes)) {
          if (traverseNodes(child)) return true;
        }
        // Conta <br> come newline
        if ((node as Element).tagName === 'BR') {
          charCount += 1;
        }
      }
      return false;
    }

    traverseNodes(richTextareaElement);
  }

  // Gestisce il tasto Invio per continuare l'elenco puntato e Tab per indentare
  function handleKeyDown(event: KeyboardEvent) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const cursorPos = getCursorPosition();
    const textBeforeCursor = anamnesi_internistica.substring(0, cursorPos);
    const textAfterCursor = anamnesi_internistica.substring(cursorPos);

    // Trova l'ultima riga prima del cursore
    const lines = textBeforeCursor.split('\n');
    const lastLine = lines[lines.length - 1];

    if (event.key === 'Tab') {
      event.preventDefault();

      // Controlla se l'ultima riga ha un bullet
      const bulletMatch = lastLine.match(/^(\s*)([-•]\s+)/);

      if (bulletMatch) {
        const currentIndent = bulletMatch[1];
        const bulletChar = bulletMatch[2];

        if (event.shiftKey) {
          // Shift+Tab: Riduci indentazione (rimuovi 2 spazi)
          if (currentIndent.length >= 2) {
            const newIndent = currentIndent.substring(2);
            const newLine = newIndent + bulletChar + lastLine.substring(bulletMatch[0].length);
            const beforeLastLine = textBeforeCursor.substring(0, textBeforeCursor.length - lastLine.length);
            anamnesi_internistica = beforeLastLine + newLine + textAfterCursor;

            setTimeout(() => {
              setCursorPosition(cursorPos - 2);
            }, 0);
          }
        } else {
          // Tab: Aumenta indentazione (aggiungi 2 spazi)
          const newIndent = currentIndent + '  ';
          const newLine = newIndent + bulletChar + lastLine.substring(bulletMatch[0].length);
          const beforeLastLine = textBeforeCursor.substring(0, textBeforeCursor.length - lastLine.length);
          anamnesi_internistica = beforeLastLine + newLine + textAfterCursor;

          setTimeout(() => {
            setCursorPosition(cursorPos + 2);
          }, 0);
        }
      } else {
        // Se non c'è bullet, inserisci semplicemente 2 spazi
        anamnesi_internistica = textBeforeCursor + '  ' + textAfterCursor;
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = cursorPos + 2;
        }, 0);
      }
    } else if (event.key === 'Enter') {
      // Controlla se l'ultima riga inizia con un punto elenco
      const bulletMatch = lastLine.match(/^(\s*)([-•]\s+)/);

      if (bulletMatch) {
        event.preventDefault();
        const currentIndent = bulletMatch[1];
        const bulletChar = bulletMatch[2];
        const bullet = bulletMatch[0];

        // Se la riga è solo il bullet (senza testo)
        if (lastLine.trim() === bullet.trim()) {
          // Controlla se c'è indentazione
          if (currentIndent.length >= 2) {
            // Ha indentazione: riduci di 2 spazi
            const newIndent = currentIndent.substring(2);
            const newLine = newIndent + bulletChar;
            const beforeLastLine = textBeforeCursor.substring(0, textBeforeCursor.length - lastLine.length);
            anamnesi_internistica = beforeLastLine + newLine + textAfterCursor;

            setTimeout(() => {
              setCursorPosition(cursorPos - 2);
            }, 0);
          } else {
            // Nessuna indentazione: esci dall'elenco
            anamnesi_internistica = textBeforeCursor.substring(0, textBeforeCursor.length - bullet.length) + '\n' + textAfterCursor;

            setTimeout(() => {
              setCursorPosition(cursorPos - bullet.length + 1);
            }, 0);
          }
        } else {
          // Continua l'elenco puntato con la stessa indentazione
          anamnesi_internistica = textBeforeCursor + '\n' + bullet + textAfterCursor;

          // Posiziona il cursore dopo il nuovo bullet
          setTimeout(() => {
            setCursorPosition(cursorPos + bullet.length + 1);
          }, 0);
        }
      }
    }
  }

  // Aggiunge un punto elenco alla posizione del cursore
  function addBulletPoint() {
    richTextareaElement.focus();
    const cursorPos = getCursorPosition();
    const textBeforeCursor = anamnesi_internistica.substring(0, cursorPos);

    // Verifica se siamo all'inizio di una riga
    const isStartOfLine = cursorPos === 0 || textBeforeCursor.endsWith('\n');

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);

      if (!isStartOfLine) {
        const br = document.createElement('br');
        range.insertNode(br);
        range.setStartAfter(br);
        range.collapse(true);
      }

      const textNode = document.createTextNode('- ');
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      richTextareaElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Aggiunge un punto elenco con bullet circolare
  function addCircleBullet() {
    richTextareaElement.focus();
    const cursorPos = getCursorPosition();
    const textBeforeCursor = anamnesi_internistica.substring(0, cursorPos);

    const isStartOfLine = cursorPos === 0 || textBeforeCursor.endsWith('\n');

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);

      if (!isStartOfLine) {
        const br = document.createElement('br');
        range.insertNode(br);
        range.setStartAfter(br);
        range.collapse(true);
      }

      const textNode = document.createTextNode('• ');
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      richTextareaElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Formattazione testo
  function formatText(type: 'bold' | 'italic' | 'underline') {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // Se c'è testo selezionato, applica/rimuovi la formattazione
    if (!range.collapsed) {
      const selectedText = range.toString();
      if (!selectedText) return;

      // Controlla se il testo selezionato è già formattato
      let node: Node | null = range.commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentNode;
      }

      let isAlreadyFormatted = false;
      let formattedParent: HTMLElement | null = null;

      // Cerca il tag di formattazione nel parent
      while (node && node !== richTextareaElement) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = (node as Element).tagName;
          const matchesType =
            (type === 'bold' && (tagName === 'STRONG' || tagName === 'B')) ||
            (type === 'italic' && (tagName === 'EM' || tagName === 'I')) ||
            (type === 'underline' && tagName === 'U');

          if (matchesType) {
            isAlreadyFormatted = true;
            formattedParent = node as HTMLElement;
            break;
          }
        }
        node = node.parentNode;
      }

      if (isAlreadyFormatted && formattedParent) {
        // Rimuovi la formattazione sostituendo l'elemento con il suo contenuto testuale
        const textNode = document.createTextNode(formattedParent.textContent || '');
        formattedParent.parentNode?.replaceChild(textNode, formattedParent);

        // Posiziona il cursore dopo il testo
        const newRange = document.createRange();
        newRange.setStartAfter(textNode);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      } else {
        // Aggiungi la formattazione
        let formattedElement: HTMLElement;
        switch (type) {
          case 'bold':
            formattedElement = document.createElement('strong');
            break;
          case 'italic':
            formattedElement = document.createElement('em');
            break;
          case 'underline':
            formattedElement = document.createElement('u');
            break;
        }

        formattedElement.textContent = selectedText;
        range.deleteContents();
        range.insertNode(formattedElement);

        // Posiziona il cursore dopo l'elemento formattato
        const newRange = document.createRange();
        newRange.setStartAfter(formattedElement);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    } else {
      // Nessun testo selezionato: attiva/disattiva la formattazione per il testo futuro
      // Usa execCommand che gestisce questo caso automaticamente
      document.execCommand(type === 'bold' ? 'bold' : type === 'italic' ? 'italic' : 'underline', false);
    }

    richTextareaElement.focus();
    richTextareaElement.dispatchEvent(new Event('input', { bubbles: true }));
    updateFormattingState();
  }
</script>

<Card>
  <h2 class="section-title">Anamnesi Internistica</h2>

  <div class="anamnesi-content">
    <div class="toolbar">
      <button type="button" class="toolbar-btn toolbar-btn-icon" class:active={isBoldActive} on:click={() => formatText('bold')} title="Grassetto (** **)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 2h5a3.5 3.5 0 0 1 2.5 6A3.5 3.5 0 0 1 9 14H4V2zm1.5 1.5v4h3.5a2 2 0 1 0 0-4h-3.5zm0 5.5v4H9a2 2 0 1 0 0-4H5.5z"/>
        </svg>
      </button>
      <button type="button" class="toolbar-btn toolbar-btn-icon" class:active={isItalicActive} on:click={() => formatText('italic')} title="Corsivo (* *)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M7.5 2h5v1.5h-1.8l-2.4 9h1.7V14h-5v-1.5h1.8l2.4-9H7.5V2z"/>
        </svg>
      </button>
      <button type="button" class="toolbar-btn toolbar-btn-icon" class:active={isUnderlineActive} on:click={() => formatText('underline')} title="Sottolineato (__ __)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 13c-2.5 0-4-1.5-4-4V2h1.5v7c0 1.7.8 2.5 2.5 2.5s2.5-.8 2.5-2.5V2H12v7c0 2.5-1.5 4-4 4zM3 14h10v1H3v-1z"/>
        </svg>
      </button>

      <div class="toolbar-divider"></div>

      <button type="button" class="toolbar-btn" on:click={addBulletPoint} title="Aggiungi punto elenco (-)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="3" width="2" height="2" rx="0.5"/>
          <rect x="6" y="3" width="8" height="2" rx="0.5"/>
          <rect x="2" y="7" width="2" height="2" rx="0.5"/>
          <rect x="6" y="7" width="8" height="2" rx="0.5"/>
          <rect x="2" y="11" width="2" height="2" rx="0.5"/>
          <rect x="6" y="11" width="8" height="2" rx="0.5"/>
        </svg>
        <span>Elenco (-)</span>
      </button>
      <button type="button" class="toolbar-btn" on:click={addCircleBullet} title="Aggiungi punto elenco (•)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="4" r="1.5"/>
          <rect x="6" y="3" width="8" height="2" rx="0.5"/>
          <circle cx="3" cy="8" r="1.5"/>
          <rect x="6" y="7" width="8" height="2" rx="0.5"/>
          <circle cx="3" cy="12" r="1.5"/>
          <rect x="6" y="11" width="8" height="2" rx="0.5"/>
        </svg>
        <span>Elenco (•)</span>
      </button>

      <span class="toolbar-hint">Invio: continua elenco | Tab: indenta | Shift+Tab: riduci indentazione</span>
    </div>
    <RichTextarea
      bind:this={richTextareaComponent}
      id="anamnesi_internistica"
      bind:value={anamnesi_internistica}
      on:keydown={handleKeyDown}
      on:keyup={handleSelectionChange}
      on:click={handleSelectionChange}
      placeholder="Inserisci l'anamnesi internistica del paziente... Usa i pulsanti per formattare il testo."
      rows={6}
    />
  </div>
</Card>

<style>
  .section-title {
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 var(--space-3) 0;
    padding-bottom: var(--space-2);
    border-bottom: 2px solid var(--color-border);
  }

  .anamnesi-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text);
    font-size: var(--text-sm);
    cursor: pointer;
    transition: all 0.2s;
  }

  .toolbar-btn:hover {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .toolbar-btn.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .toolbar-btn svg {
    flex-shrink: 0;
  }

  .toolbar-btn-icon {
    padding: var(--space-1);
    min-width: auto;
  }

  .toolbar-btn-icon span {
    display: none;
  }

  .toolbar-divider {
    width: 1px;
    height: 24px;
    background: var(--color-border);
    margin: 0 var(--space-1);
  }

  .toolbar-hint {
    margin-left: auto;
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
    font-style: italic;
  }

  @media (max-width: 768px) {
    .toolbar {
      flex-wrap: wrap;
    }

    .toolbar-hint {
      width: 100%;
      margin-left: 0;
      margin-top: var(--space-1);
    }
  }
</style>

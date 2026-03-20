<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ambulatorioStore } from '$lib/stores/ambulatorio';
  import { authStore } from '$lib/stores/auth';
  import { sidebarCollapsedStore } from '$lib/stores/sidebar';
  import { toastStore } from '$lib/stores/toast';
  import {
    getVisiteByAmbulatorio,
    searchVisite,
    deleteVisita
  } from '$lib/db/visite';
  import { createVisitaCompleta, updateVisitaCompleta } from '$lib/db/visite-complete';
  import Card from '$lib/components/Card.svelte';
  import Input from '$lib/components/Input.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import VisitFormModal from '$lib/components/VisitFormModal.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { Visita } from '$lib/db/types';

  $: ambulatorio = $ambulatorioStore.current;
  $: user = $authStore.user;

  let visite: Visita[] = [];
  let loading = true;
  let searchTerm = '';
  let showVisitModal = false;
  let showDeleteModal = false;
  let editingVisit: Visita | null = null;
  let visitToDelete: Visita | null = null;

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim()) {
      return error;
    }

    if (error && typeof error === 'object') {
      const maybeMessage = 'message' in error ? (error as { message?: unknown }).message : undefined;
      if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
        return maybeMessage;
      }
    }

    return 'Errore sconosciuto';
  }

  async function loadVisite() {
    if (!ambulatorio) return;

    loading = true;
    try {
      if (searchTerm.trim()) {
        visite = await searchVisite(searchTerm, ambulatorio.id);
      } else {
        visite = await getVisiteByAmbulatorio(ambulatorio.id);
      }
    } catch (error) {
      console.error('Errore caricamento visite:', error);
      // Non mostrare errore se è solo un problema di inizializzazione
      const errorMessage = error instanceof Error ? error.message : '';
      if (!errorMessage.includes('Database non inizializzato')) {
        toastStore.show('error', 'Errore durante il caricamento delle visite');
      }
    } finally {
      loading = false;
    }
  }

  function handleNewVisit() {
    goto(`/ambulatori/${ambulatorio?.id}/visite/nuova`);
  }

  function handleEditVisit(visita: Visita) {
    editingVisit = visita;
    showVisitModal = true;
  }

  function openDeleteModal(visita: Visita) {
    visitToDelete = visita;
    showDeleteModal = true;
  }

  async function handleVisitSubmit(event: CustomEvent) {
    const { visita, fattoriRischioCV } = event.detail;

    try {
      if (visita.id) {
        // Modifica visita esistente
        await updateVisitaCompleta({
          visita,
          fattoriRischioCV: {
            ...fattoriRischioCV,
            visita_id: fattoriRischioCV.visita_id || visita.id
          }
        });
        toastStore.show('success', 'Visita modificata con successo!');
      } else {
        // Crea nuova visita
        await createVisitaCompleta({
          visita,
          fattoriRischioCV
        });
        toastStore.show('success', 'Visita creata con successo!');
      }

      showVisitModal = false;
      await loadVisite();
    } catch (error) {
      console.error('Errore salvataggio visita:', error);
      toastStore.show('error', `Errore durante il salvataggio della visita: ${getErrorMessage(error)}`);
    }
  }

  async function handleDeleteVisit() {
    if (!visitToDelete) return;

    try {
      await deleteVisita(visitToDelete.id);
      toastStore.show('success', 'Visita eliminata con successo!');
      await loadVisite();
      showDeleteModal = false;
      visitToDelete = null;
    } catch (error) {
      console.error('Errore eliminazione visita:', error);
      toastStore.show('error', "Errore durante l'eliminazione della visita");
    }
  }

  function formatDate(dateString: string): string {
    const directDateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (directDateMatch) {
      return `${directDateMatch[3]}/${directDateMatch[2]}/${directDateMatch[1]}`;
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  let mounted = false;

  onMount(() => {
    mounted = true;
    // Aspetta un attimo per assicurarsi che il database sia inizializzato
    setTimeout(() => {
      loadVisite();
    }, 100);

    return () => {
      mounted = false;
    };
  });

  // Ricerca in tempo reale
  let searchTimeout: number;
  $: {
    if (searchTimeout) clearTimeout(searchTimeout);
    if (mounted) {
      searchTimeout = setTimeout(() => {
        if (ambulatorio) loadVisite();
      }, 300) as unknown as number;
    }
  }
</script>

<div class="visite-page">
  <PageHeader
    title="Archivio Visite"
    subtitle="Visualizza e consulta le visite mediche"
    showLogo={$sidebarCollapsedStore}
    onBack={() => goto(`/ambulatori/${ambulatorio?.id}`)}
  >
    <div slot="actions">
      <button type="button" class="btn-icon-text" on:click={handleNewVisit}>
        <span class="icon">
          <Icon name="file-plus" size={24} />
        </span>
        <span class="text">Nuova Visita</span>
      </button>
    </div>
  </PageHeader>

  <div class="page-content">
    <Card>
      <div class="toolbar">
        <div class="search-box">
          <Input
            type="text"
            placeholder="Cerca per paziente, motivo, diagnosi..."
            bind:value={searchTerm}
          />
        </div>
        <div class="toolbar-info">
          {visite.length} {visite.length === 1 ? 'visita' : 'visite'}
        </div>
      </div>

      {#if loading}
        <div class="loading-state">Caricamento visite...</div>
      {:else if visite.length === 0}
        <div class="empty-state">
          <div class="empty-icon">
            <Icon name="file-text" size={48} />
          </div>
          <h3 class="empty-title">
            {searchTerm ? 'Nessuna visita trovata' : 'Nessuna visita registrata'}
          </h3>
          <p class="empty-text">
            {searchTerm
              ? 'Prova a modificare i criteri di ricerca'
              : 'Inizia registrando la prima visita medica'}
          </p>
        </div>
      {:else}
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Paziente</th>
                <th>Tipo</th>
                <th>Motivo</th>
                <th>Diagnosi</th>
                <th>Medico</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {#each visite as visita (visita.id)}
                <tr>
                  <td>
                    <div class="date-main">{formatDate(visita.data_visita)}</div>
                  </td>
                  <td>
                    <div class="patient-cell">
                      <strong>{visita.paziente_cognome} {visita.paziente_nome}</strong>
                      <div class="patient-cf">{visita.paziente_codice_fiscale}</div>
                    </div>
                  </td>
                  <td>
                    <span class="badge badge-{visita.tipo_visita.toLowerCase().replace(' ', '-')}">
                      {visita.tipo_visita}
                    </span>
                  </td>
                  <td>{visita.motivo}</td>
                  <td>
                    {#if visita.diagnosi}
                      <span class="truncate">{visita.diagnosi}</span>
                    {:else}
                      <span class="text-muted">-</span>
                    {/if}
                  </td>
                  <td>{visita.medico_cognome} {visita.medico_nome}</td>
                  <td>
                    <div class="actions">
                      <button
                        class="btn-icon"
                        on:click={() => handleEditVisit(visita)}
                        title="Modifica"
                      >
                        <Icon name="pencil" size={16} />
                      </button>
                      <button
                        class="btn-icon"
                        on:click={() => openDeleteModal(visita)}
                        title="Elimina"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>
  </div>
</div>

<!-- Modal Nuova/Modifica Visita -->
<VisitFormModal
  visita={editingVisit}
  isOpen={showVisitModal}
  ambulatorioId={ambulatorio?.id || 0}
  medicoId={user?.id || 0}
  on:submit={handleVisitSubmit}
  on:close={() => (showVisitModal = false)}
/>

<!-- Modal Conferma Eliminazione -->
<Modal bind:open={showDeleteModal} title="Conferma Eliminazione" size="sm">
  <p style="margin-bottom: var(--space-6);">
    Sei sicuro di voler eliminare la visita del paziente
    <strong>{visitToDelete?.paziente_cognome} {visitToDelete?.paziente_nome}</strong>
    del {visitToDelete ? formatDate(visitToDelete.data_visita) : ''}?<br />
    Questa azione non può essere annullata.
  </p>
  <div style="display: flex; gap: var(--space-3); justify-content: flex-end;">
    <Button variant="secondary" on:click={() => (showDeleteModal = false)}>
      Annulla
    </Button>
    <Button variant="primary" on:click={handleDeleteVisit}> Conferma Eliminazione </Button>
  </div>
</Modal>

<style>
  .visite-page {
    padding: var(--space-6);
    max-width: 1400px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .page-title {
    font-size: var(--text-3xl);
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0 0 var(--space-2) 0;
  }

  .page-subtitle {
    font-size: var(--text-base);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .btn-primary {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary:hover {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-icon {
    font-size: var(--text-lg);
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }

  .search-box {
    flex: 1;
    max-width: 400px;
  }

  .toolbar-info {
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .loading-state {
    text-align: center;
    padding: var(--space-12);
    color: var(--color-text-secondary);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-12);
  }

  .empty-icon {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: var(--space-4);
    color: var(--color-text-tertiary);
  }

  .empty-icon .icon-svg {
    width: 64px;
    height: 64px;
    stroke-width: 1.5;
    opacity: 0.5;
  }

  .empty-title {
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 var(--space-2) 0;
  }

  .empty-text {
    color: var(--color-text-secondary);
    margin: 0 0 var(--space-6) 0;
  }

  .table-container {
    overflow-x: auto;
  }

  .table {
    width: 100%;
    border-collapse: collapse;
  }

  .table thead {
    background: var(--color-bg-secondary);
  }

  .table th {
    text-align: left;
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .table th:last-child {
    text-align: center;
  }

  .table td {
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border);
  }

  .table td:last-child {
    text-align: center;
  }

  .table tbody tr {
    transition: background 0.2s;
  }

  .table tbody tr:hover {
    background: var(--color-bg-secondary);
  }

  .date-main {
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .patient-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .patient-cf {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 500;
  }

  .badge-prima-visita {
    background: #dbeafe;
    color: #1e40af;
  }

  .badge-controllo {
    background: #d1fae5;
    color: #065f46;
  }

  .badge-urgenza {
    background: #fee2e2;
    color: #991b1b;
  }

  .badge-consulto {
    background: #e0e7ff;
    color: #3730a3;
  }

  .truncate {
    display: block;
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .text-muted {
    color: var(--color-text-tertiary);
  }

  .actions {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
  }

  .btn-icon {
    background: none;
    border: none;
    font-size: var(--text-xl);
    cursor: pointer;
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    transition: all 0.2s;
  }

  .btn-icon:hover {
    background: var(--color-bg-tertiary);
    transform: scale(1.1);
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      gap: var(--space-4);
    }

    .toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .search-box {
      max-width: none;
    }
  }
</style>

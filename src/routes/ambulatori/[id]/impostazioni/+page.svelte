<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { ambulatorioStore } from '$lib/stores/ambulatorio';
  import { authStore } from '$lib/stores/auth';
  import { sidebarCollapsedStore } from '$lib/stores/sidebar';
  import { toastStore } from '$lib/stores/toast';
  import { updateAmbulatorio, getAmbulatorioById } from '$lib/db/ambulatori';
  import { getAllUsers, createUser, updateUser, deleteUser, verifyUserPassword, updateUserPassword } from '$lib/db/auth';
  import Card from '$lib/components/Card.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import Button from '$lib/components/Button.svelte';
  import Input from '$lib/components/Input.svelte';
  import UserFormModal from '$lib/components/UserFormModal.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import type { User } from '$lib/db/types';

  $: ambulatorio = $ambulatorioStore.current;
  $: user = $authStore.user;
  $: isAdmin = user?.role === 'admin';

  let activeTab: 'ambulatorio' | 'utenti' | 'backup' | 'integrazioni' | 'sistema' = 'ambulatorio';
  let saving = false;

  // Gestione utenti
  let users: User[] = [];
  let loadingUsers = false;
  let showUserModal = false;
  let editingUser: User | null = null;
  let showDeleteModal = false;
  let userToDelete: User | null = null;

  // Dati form ambulatorio
  let formData = {
    nome: '',
    indirizzo: '',
    telefono: '',
    email: '',
    logo_path: '',
    color_primary: '#1e3a8a',
    color_secondary: '#3b82f6',
    color_accent: '#22d3ee'
  };

  $: if (ambulatorio) {
    formData.nome = ambulatorio.nome;
    formData.logo_path = ambulatorio.logo_path || '';
    formData.color_primary = ambulatorio.color_primary;
    formData.color_secondary = ambulatorio.color_secondary;
    formData.color_accent = ambulatorio.color_accent;
    formData.indirizzo = ambulatorio.indirizzo || '';
    formData.telefono = ambulatorio.telefono || '';
    formData.email = ambulatorio.email || '';
  }

  async function handleSaveAmbulatorio() {
    if (!ambulatorio) return;

    saving = true;
    try {
      await updateAmbulatorio(
        ambulatorio.id,
        formData.nome,
        formData.logo_path,
        formData.color_primary,
        formData.color_secondary,
        formData.color_accent,
        formData.indirizzo,
        formData.telefono,
        formData.email
      );

      // Ricarica ambulatorio aggiornato
      const updated = await getAmbulatorioById(ambulatorio.id);
      if (updated) {
        ambulatorioStore.select(updated);
      }

      toastStore.show('success', 'Impostazioni salvate con successo!');

      // Scroll in alto dopo il salvataggio
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Errore salvataggio impostazioni:', error);
      toastStore.show('error', 'Errore durante il salvataggio delle impostazioni');
    } finally {
      saving = false;
    }
  }

  async function loadUsers() {
    if (!isAdmin) return;

    loadingUsers = true;
    try {
      users = await getAllUsers();
    } catch (error) {
      console.error('Errore caricamento utenti:', error);
      toastStore.show('error', 'Errore durante il caricamento degli utenti');
    } finally {
      loadingUsers = false;
    }
  }

  function handleNewUser() {
    editingUser = null;
    showUserModal = true;
  }

  function handleEditUser(userToEdit: User) {
    editingUser = userToEdit;
    showUserModal = true;
  }

  async function handleUserSubmit(event: CustomEvent) {
    const data = event.detail;

    try {
      if (data.id) {
        // Modifica utente esistente
        await updateUser(data.id, data.username, data.role, data.nome, data.cognome);

        // Se vuole cambiare la password
        if (data.password && data.oldPassword) {
          // Verifica la vecchia password
          const isOldPasswordValid = await verifyUserPassword(data.id, data.oldPassword);
          if (!isOldPasswordValid) {
            toastStore.show('error', 'La vecchia password non è corretta');
            return;
          }

          // Aggiorna la password
          await updateUserPassword(data.id, data.password);
          toastStore.show('success', 'Utente e password modificati con successo!');
        } else {
          toastStore.show('success', 'Utente modificato con successo!');
        }
      } else {
        // Crea nuovo utente
        await createUser(data.username, data.password, data.role, data.nome, data.cognome);
        toastStore.show('success', 'Utente creato con successo!');
      }

      showUserModal = false;
      await loadUsers();
    } catch (error) {
      console.error('Errore salvataggio utente:', error);
      toastStore.show('error', 'Errore durante il salvataggio dell\'utente');
    }
  }

  function openDeleteModal(userItem: User) {
    if (userItem.id === user?.id) {
      toastStore.show('error', 'Non puoi eliminare il tuo stesso account!');
      return;
    }
    userToDelete = userItem;
    showDeleteModal = true;
  }

  async function handleDeleteUser() {
    if (!userToDelete) return;

    try {
      await deleteUser(userToDelete.id);
      toastStore.show('success', 'Utente eliminato con successo!');
      await loadUsers();
      showDeleteModal = false;
      userToDelete = null;
    } catch (error) {
      console.error('Errore eliminazione utente:', error);
      toastStore.show('error', 'Errore durante l\'eliminazione dell\'utente');
    }
  }

  function getRoleBadge(role: string) {
    switch (role) {
      case 'admin': return { label: 'Amministratore', color: 'var(--color-error)' };
      case 'medico': return { label: 'Medico', color: 'var(--color-primary)' };
      case 'infermiere': return { label: 'Infermiere', color: 'var(--color-accent)' };
      default: return { label: role, color: 'var(--color-text-secondary)' };
    }
  }

  $: if (activeTab === 'utenti' && isAdmin) {
    loadUsers();
  }
</script>

<div class="impostazioni">
  <PageHeader
    title="Impostazioni"
    subtitle="Configurazione ambulatorio e sistema"
    showLogo={$sidebarCollapsedStore}
    onBack={() => goto(`/ambulatori/${ambulatorio?.id}`)}
  />

  <div class="tabs">
    <button
      class="tab"
      class:active={activeTab === 'ambulatorio'}
      on:click={() => activeTab = 'ambulatorio'}
    >
      🏥 Ambulatorio
    </button>
    <button
      class="tab"
      class:active={activeTab === 'utenti'}
      on:click={() => activeTab = 'utenti'}
      disabled={!isAdmin}
      title={!isAdmin ? 'Solo amministratori possono accedere a questa sezione' : ''}
    >
      👤 Utenti
    </button>
    <button
      class="tab"
      class:active={activeTab === 'integrazioni'}
      on:click={() => activeTab = 'integrazioni'}
    >
      🔗 Integrazioni
    </button>
    <button
      class="tab"
      class:active={activeTab === 'backup'}
      on:click={() => activeTab = 'backup'}
    >
      💾 Backup
    </button>
    <button
      class="tab"
      class:active={activeTab === 'sistema'}
      on:click={() => activeTab = 'sistema'}
    >
      🖥️ Sistema
    </button>
  </div>

  <div class="tab-content">
    {#if activeTab === 'ambulatorio'}
      <Card padding="lg">
        <h2 class="section-title">Informazioni Ambulatorio</h2>

        <form on:submit|preventDefault={handleSaveAmbulatorio} class="settings-form">
          <Input
            id="nome"
            type="text"
            label="Nome Ambulatorio"
            bind:value={formData.nome}
            placeholder="Nome dell'ambulatorio"
          />

          <Input
            id="indirizzo"
            type="text"
            label="Indirizzo"
            bind:value={formData.indirizzo}
            placeholder="Via, Città, CAP"
          />

          <div class="form-row">
            <Input
              id="telefono"
              type="tel"
              label="Telefono"
              bind:value={formData.telefono}
              placeholder="+39 123 456 7890"
            />

            <Input
              id="email"
              type="email"
              label="Email"
              bind:value={formData.email}
              placeholder="ambulatorio@ospedale.it"
            />
          </div>

          <div class="form-group">
            <label>Logo Ambulatorio</label>
            <div class="logo-upload">
              {#if formData.logo_path}
                <img src={formData.logo_path} alt="Logo" class="logo-preview" />
              {:else}
                <div class="logo-placeholder">Nessun logo</div>
              {/if}
              <button type="button" class="btn-secondary">
                📁 Carica Logo
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>Colori Tema</label>
            <div class="color-row">
              <div class="color-input">
                <label for="primary">Primario</label>
                <input
                  id="primary"
                  type="color"
                  bind:value={formData.color_primary}
                />
                <span class="color-value">{formData.color_primary}</span>
              </div>
              <div class="color-input">
                <label for="secondary">Secondario</label>
                <input
                  id="secondary"
                  type="color"
                  bind:value={formData.color_secondary}
                />
                <span class="color-value">{formData.color_secondary}</span>
              </div>
              <div class="color-input">
                <label for="accent">Accento</label>
                <input
                  id="accent"
                  type="color"
                  bind:value={formData.color_accent}
                />
                <span class="color-value">{formData.color_accent}</span>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-primary" disabled={saving}>
              {#if saving}
                ⏳ Salvataggio...
              {:else}
                💾 Salva Modifiche
              {/if}
            </button>
          </div>
        </form>
      </Card>
    {:else if activeTab === 'utenti'}
      {#if isAdmin}
        <Card padding="lg">
          <div class="section-header">
            <h2 class="section-title">Gestione Utenti</h2>
            <button class="btn-primary" on:click={handleNewUser}>➕ Nuovo Utente</button>
          </div>

          {#if loadingUsers}
            <div class="loading-state">Caricamento utenti...</div>
          {:else if users.length === 0}
            <div class="empty-state">
              <p class="empty-text">Nessun utente trovato</p>
              <p class="empty-subtext">Crea il primo utente per iniziare</p>
            </div>
          {:else}
            <div class="users-table">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Username</th>
                    <th>Password</th>
                    <th>Ruolo</th>
                    <th>Creato il</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {#each users as userItem (userItem.id)}
                    <tr>
                      <td>
                        <div class="user-name">{userItem.nome} {userItem.cognome}</div>
                      </td>
                      <td>{userItem.username}</td>
                      <td>
                        <span class="password-hidden">••••••••</span>
                      </td>
                      <td>
                        <span class="role-badge" style="background-color: {getRoleBadge(userItem.role).color}">
                          {getRoleBadge(userItem.role).label}
                        </span>
                      </td>
                      <td>
                        {new Date(userItem.created_at).toLocaleDateString('it-IT')}
                      </td>
                      <td>
                        <div class="actions">
                          <button
                            class="btn-icon"
                            on:click={() => handleEditUser(userItem)}
                            title="Modifica"
                          >
                            ✏️
                          </button>
                          <button
                            class="btn-icon"
                            on:click={() => openDeleteModal(userItem)}
                            disabled={userItem.id === user?.id}
                            title={userItem.id === user?.id ? 'Non puoi eliminare il tuo account' : 'Elimina'}
                          >
                            🗑️
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
      {:else}
        <Card padding="lg">
          <div class="access-denied">
            <div class="access-denied-icon">🔒</div>
            <h2>Accesso Negato</h2>
            <p>Solo gli amministratori possono accedere alla gestione utenti.</p>
          </div>
        </Card>
      {/if}
    {:else if activeTab === 'integrazioni'}
      <Card padding="lg">
        <h2 class="section-title">Integrazioni</h2>

        <div class="integrations-grid">
          <div class="integration-card disabled">
            <div class="integration-header">
              <div class="integration-icon">🏥</div>
              <div class="integration-info">
                <h3>Sistema Tessera Sanitaria</h3>
                <p class="integration-description">Integrazione con il Sistema TS per la lettura e validazione delle tessere sanitarie</p>
              </div>
            </div>
            <div class="integration-status">
              <span class="status-badge status-inactive">Non configurato</span>
            </div>
          </div>

          <div class="integration-card disabled">
            <div class="integration-header">
              <div class="integration-icon">📋</div>
              <div class="integration-info">
                <h3>Prescrizioni Elettroniche (SAC)</h3>
                <p class="integration-description">Sistema di Accoglienza Centralizzato per la gestione delle ricette elettroniche</p>
              </div>
            </div>
            <div class="integration-status">
              <span class="status-badge status-inactive">Non configurato</span>
            </div>
          </div>

          <div class="integration-card disabled">
            <div class="integration-header">
              <div class="integration-icon">🔬</div>
              <div class="integration-info">
                <h3>Laboratori</h3>
                <p class="integration-description">Integrazione con laboratori esterni per l'invio e ricezione di referti</p>
              </div>
            </div>
            <div class="integration-status">
              <span class="status-badge status-inactive">Non configurato</span>
            </div>
          </div>

          <div class="integration-card disabled">
            <div class="integration-header">
              <div class="integration-icon">💊</div>
              <div class="integration-info">
                <h3>Farmacie</h3>
                <p class="integration-description">Collegamento con il network delle farmacie per la distribuzione farmaci</p>
              </div>
            </div>
            <div class="integration-status">
              <span class="status-badge status-inactive">Non configurato</span>
            </div>
          </div>
        </div>

        <div class="info-box">
          <div class="info-icon">ℹ️</div>
          <div>
            <p><strong>Funzionalità in sviluppo</strong></p>
            <p>Queste integrazioni saranno disponibili nelle prossime versioni del software.</p>
          </div>
        </div>
      </Card>
    {:else if activeTab === 'backup'}
      <Card padding="lg">
        <h2 class="section-title">Backup e Ripristino</h2>
        <p class="text-secondary">Funzionalità in sviluppo...</p>
      </Card>
    {:else if activeTab === 'sistema'}
      <Card padding="lg">
        <h2 class="section-title">Informazioni Sistema</h2>

        <div class="system-info">
          <div class="info-section">
            <h3>Applicazione</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Nome</span>
                <span class="info-value">GMD Medical Platform</span>
              </div>
              <div class="info-item">
                <span class="info-label">Versione</span>
                <span class="info-value">1.0.0</span>
              </div>
              <div class="info-item">
                <span class="info-label">Ambiente</span>
                <span class="info-value">Produzione</span>
              </div>
              <div class="info-item">
                <span class="info-label">Build</span>
                <span class="info-value">2025.01.15</span>
              </div>
            </div>
          </div>

          <div class="info-section">
            <h3>Tecnologie</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Framework</span>
                <span class="info-value">Tauri 2.x + SvelteKit</span>
              </div>
              <div class="info-item">
                <span class="info-label">Database</span>
                <span class="info-value">SQLite</span>
              </div>
              <div class="info-item">
                <span class="info-label">Runtime</span>
                <span class="info-value">Node.js + Rust</span>
              </div>
              <div class="info-item">
                <span class="info-label">Piattaforma</span>
                <span class="info-value">{navigator.platform}</span>
              </div>
            </div>
          </div>

          <div class="info-section">
            <h3>Database</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Tipo</span>
                <span class="info-value">SQLite Locale</span>
              </div>
              <div class="info-item">
                <span class="info-label">Percorso</span>
                <span class="info-value">~/GMD/gmd.db</span>
              </div>
              <div class="info-item">
                <span class="info-label">Stato</span>
                <span class="status-badge status-active">Connesso</span>
              </div>
            </div>
          </div>

          <div class="info-section">
            <h3>Supporto</h3>
            <div class="info-grid">
              <div class="info-item full-width">
                <span class="info-label">Documentazione</span>
                <a href="#" class="info-link">Apri documentazione</a>
              </div>
              <div class="info-item full-width">
                <span class="info-label">Segnala un problema</span>
                <a href="#" class="info-link">Apri issue tracker</a>
              </div>
              <div class="info-item full-width">
                <span class="info-label">Licenza</span>
                <span class="info-value">Proprietaria - Uso Interno</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    {/if}
  </div>
</div>

<UserFormModal
  user={editingUser}
  isOpen={showUserModal}
  on:submit={handleUserSubmit}
  on:close={() => showUserModal = false}
/>

<!-- Modal Conferma Eliminazione -->
<Modal bind:open={showDeleteModal} title="Conferma Eliminazione" size="sm">
  <p style="margin-bottom: var(--space-6);">
    Sei sicuro di voler eliminare l'utente <strong>{userToDelete?.nome} {userToDelete?.cognome}</strong>?<br />
    Questa azione non può essere annullata.
  </p>
  <div style="display: flex; gap: var(--space-3); justify-content: flex-end;">
    <Button variant="secondary" on:click={() => (showDeleteModal = false)}>
      Annulla
    </Button>
    <Button variant="primary" on:click={handleDeleteUser}>
      Conferma Eliminazione
    </Button>
  </div>
</Modal>

<style>
  .impostazioni {
    padding: var(--space-8);
    max-width: 1200px;
    margin: 0 auto;
  }

  .tabs {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-6);
    border-bottom: 2px solid var(--color-border);
  }

  .tab {
    padding: var(--space-3) var(--space-4);
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    font-family: var(--font-sans);
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    margin-bottom: -2px;
  }

  .tab:hover {
    color: var(--color-text);
    background-color: var(--color-bg-secondary);
  }

  .tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }

  .tab-content {
    min-height: 400px;
  }

  .section-title {
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 var(--space-6) 0;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6);
  }

  .section-header .section-title {
    margin: 0;
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  .form-group label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  .logo-upload {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .logo-preview {
    width: 100px;
    height: 100px;
    object-fit: contain;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-2);
  }

  .logo-placeholder {
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--color-bg-secondary);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .color-row {
    display: flex;
    gap: var(--space-6);
  }

  .color-input {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .color-input label {
    font-size: var(--text-xs);
    color: var(--color-text-secondary);
  }

  .color-input input[type="color"] {
    width: 80px;
    height: 40px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .color-value {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    color: var(--color-text-secondary);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .btn-primary,
  .btn-secondary {
    padding: var(--space-3) var(--space-6);
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    font-size: var(--text-base);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-primary {
    background-color: var(--color-bg);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--color-bg-secondary);
    border-color: var(--color-text-secondary);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover {
    background-color: var(--color-bg-tertiary);
    color: var(--color-text);
  }

  .text-secondary {
    color: var(--color-text-secondary);
    font-size: var(--text-base);
  }

  .tab:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tab:disabled:hover {
    background-color: transparent;
    color: var(--color-text-secondary);
  }

  /* Gestione Utenti */
  .loading-state,
  .empty-state {
    text-align: center;
    padding: var(--space-12) var(--space-4);
    color: var(--color-text-secondary);
  }

  .empty-text {
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--color-text);
    margin: 0 0 var(--space-2) 0;
  }

  .empty-subtext {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .users-table {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    background-color: var(--color-bg-secondary);
  }

  th {
    text-align: left;
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text);
    border-bottom: 2px solid var(--color-border);
  }

  th:last-child {
    text-align: center;
  }

  td {
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-border);
    font-size: var(--text-sm);
  }

  td:last-child {
    text-align: center;
  }

  tbody tr:hover {
    background-color: var(--color-bg-secondary);
  }

  .user-name {
    font-weight: 500;
    color: var(--color-text);
  }

  .password-hidden {
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
    letter-spacing: 2px;
  }

  .role-badge {
    display: inline-block;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: 600;
    color: white;
  }

  .actions {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
  }

  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--space-2);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    opacity: 0.6;
  }

  .btn-icon:hover:not(:disabled) {
    background-color: var(--color-bg-secondary);
    opacity: 1;
  }

  .btn-icon:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .access-denied {
    text-align: center;
    padding: var(--space-12) var(--space-4);
  }

  .access-denied-icon {
    font-size: 64px;
    margin-bottom: var(--space-4);
  }

  .access-denied h2 {
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 var(--space-2) 0;
  }

  .access-denied p {
    color: var(--color-text-secondary);
    margin: 0;
  }

  /* Integrazioni */
  .integrations-grid {
    display: grid;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }

  .integration-card {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    background-color: var(--color-bg);
  }

  .integration-card.disabled {
    opacity: 0.7;
  }

  .integration-header {
    display: flex;
    gap: var(--space-4);
    margin-bottom: var(--space-3);
  }

  .integration-icon {
    font-size: 32px;
    flex-shrink: 0;
  }

  .integration-info h3 {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 var(--space-2) 0;
  }

  .integration-description {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  .integration-status {
    display: flex;
    justify-content: flex-end;
  }

  .status-badge {
    display: inline-block;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    font-weight: 600;
  }

  .status-badge.status-active {
    background-color: var(--color-success);
    color: white;
  }

  .status-badge.status-inactive {
    background-color: var(--color-bg-secondary);
    color: var(--color-text-secondary);
  }

  .info-box {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-4);
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    border-left: 4px solid var(--color-primary);
  }

  .info-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .info-box p {
    margin: 0 0 var(--space-1) 0;
    font-size: var(--text-sm);
    color: var(--color-text);
  }

  .info-box p:last-child {
    margin: 0;
    color: var(--color-text-secondary);
  }

  /* Sistema */
  .system-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .info-section {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-5);
  }

  .info-section h3 {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 var(--space-4) 0;
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .info-item.full-width {
    grid-column: 1 / -1;
  }

  .info-label {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .info-value {
    font-size: var(--text-base);
    color: var(--color-text);
    font-family: var(--font-mono);
  }

  .info-link {
    font-size: var(--text-base);
    color: var(--color-primary);
    text-decoration: none;
    transition: color var(--transition-fast);
  }

  .info-link:hover {
    color: var(--color-secondary);
    text-decoration: underline;
  }
</style>

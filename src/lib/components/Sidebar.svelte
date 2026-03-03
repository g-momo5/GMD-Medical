<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { ambulatorioStore } from '$lib/stores/ambulatorio';
  import { authStore } from '$lib/stores/auth';

  export let ambulatorioId: number;
  export let collapsed: boolean = false;

  $: currentPath = $page.url.pathname;
  $: currentMode = $page.url.searchParams.get('mode');
  $: currentFrom = $page.url.searchParams.get('from');
  $: ambulatorio = $ambulatorioStore.current;
  $: user = $authStore.user;

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'dashboard',
      path: `/ambulatori/${ambulatorioId}`
    },
    {
      id: 'pazienti',
      label: 'Gestione Anagrafica',
      icon: 'pazienti',
      path: `/ambulatori/${ambulatorioId}/pazienti`
    },
    {
      id: 'appuntamenti',
      label: 'Appuntamenti',
      icon: 'appuntamenti',
      path: `/ambulatori/${ambulatorioId}/appuntamenti`,
      disabled: true
    },
    {
      id: 'cartelle',
      label: 'Cartelle Cliniche',
      icon: 'cartelle',
      path: `/ambulatori/${ambulatorioId}/cartelle`,
      disabled: true
    },
    {
      id: 'prescrizioni',
      label: 'Prescrizioni',
      icon: 'prescrizioni',
      path: `/ambulatori/${ambulatorioId}/prescrizioni`,
      disabled: true
    },
    {
      id: 'fatturazione',
      label: 'Fatturazione',
      icon: 'fatturazione',
      path: `/ambulatori/${ambulatorioId}/fatturazione`,
      disabled: true
    },
    {
      id: 'impostazioni',
      label: 'Impostazioni',
      icon: 'impostazioni',
      path: `/ambulatori/${ambulatorioId}/impostazioni`
    }
  ];

  function getIconSVG(iconName: string) {
    const icons: Record<string, string> = {
      dashboard: '<svg class="icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
      pazienti: '<svg class="icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      appuntamenti: '<svg class="icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      cartelle: '<svg class="icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
      prescrizioni: '<svg class="icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.5 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v.5h1.5A1.5 1.5 0 0 1 16.5 4v16a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 7.5 20V4A1.5 1.5 0 0 1 9 2.5h1.5V2z"/><circle cx="12" cy="8" r="2"/><path d="M12 10v5"/><path d="M9 15h6"/></svg>',
      fatturazione: '<svg class="icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
      impostazioni: '<svg class="icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>'
    };
    return icons[iconName] || '';
  }

  function isActive(itemPath: string): boolean {
    const gestioneAnagraficaPath = `/ambulatori/${ambulatorioId}/pazienti`;
    const dashboardPath = `/ambulatori/${ambulatorioId}`;

    if (currentFrom === 'dashboard') {
      return itemPath === dashboardPath;
    }

    if (itemPath === gestioneAnagraficaPath && currentMode === 'search') {
      return false;
    }

    // Exact match per la dashboard (es. /ambulatori/1)
    if (itemPath === dashboardPath) {
      return currentPath === itemPath;
    }
    // Per le altre pagine, controlla se il path corrente inizia con il path dell'item
    return currentPath === itemPath || currentPath.startsWith(itemPath + '/');
  }

  function handleNavigation(item: any) {
    if (!item.disabled) {
      goto(item.path);
    }
  }

  function handleLogout() {
    authStore.logout();
    goto('/');
  }

  function goBackToAmbulatori() {
    goto('/ambulatori');
  }
</script>

<aside class="sidebar" class:collapsed>
  <div class="sidebar-header">
    <img src="/logo_aziendale.png" alt="GMD Medical" class="logo" />
    <h2 class="ambulatorio-name">{ambulatorio?.nome || ''}</h2>
  </div>

  <nav class="sidebar-nav">
    {#each menuItems as item}
      <button
        class="nav-item"
        class:active={isActive(item.path)}
        class:disabled={item.disabled}
        on:click={() => handleNavigation(item)}
        disabled={item.disabled}
      >
        <span class="nav-icon">{@html getIconSVG(item.icon)}</span>
        <span class="nav-label">{item.label}</span>
        {#if item.disabled}
          <span class="badge">Presto</span>
        {/if}
      </button>
    {/each}
  </nav>

  <div class="sidebar-footer">
    <div class="user-info">
      <div class="user-avatar">
        {user?.nome?.charAt(0) || 'U'}{user?.cognome?.charAt(0) || ''}
      </div>
      <div class="user-details">
        <div class="user-name">{user?.nome} {user?.cognome}</div>
        <div class="user-role">{user?.role}</div>
      </div>
    </div>
    <button class="btn-change-ambulatorio" on:click={goBackToAmbulatori}>
      ← Cambia Ambulatorio
    </button>
    <button class="btn-logout" on:click={handleLogout}>
      <svg class="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      Logout
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: 16rem;
    height: 100vh;
    background-color: var(--color-bg);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    position: fixed;
    left: 0;
    top: 0;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 100;
  }

  .sidebar.collapsed {
    transform: translateX(-100%);
  }

  .sidebar-header {
    padding: var(--space-6);
    border-bottom: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
  }

  .logo {
    height: 120px;
    width: auto;
  }

  .ambulatorio-name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    margin: 0;
    text-align: center;
  }

  .sidebar-nav {
    flex: 1;
    padding: var(--space-4);
    overflow-y: auto;
  }

  .nav-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    margin-bottom: 2px;
    background: none;
    border: none;
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: 400;
    color: var(--color-text-secondary);
    text-align: left;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .nav-item:hover:not(.disabled) {
    background-color: var(--color-bg-secondary);
    color: var(--color-text);
  }

  .nav-item.active {
    background-color: var(--color-bg-secondary);
    color: var(--color-text);
    font-weight: 500;
    border-left: 3px solid var(--color-primary);
    padding-left: calc(var(--space-3) - 3px);
  }

  .nav-item.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .nav-icon {
    width: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
  }

  .nav-item.active .nav-icon {
    opacity: 1;
  }

  .nav-icon :global(.icon-svg) {
    width: 20px;
    height: 20px;
  }

  .nav-label {
    flex: 1;
  }

  .badge {
    font-size: var(--text-xs);
    padding: 2px var(--space-2);
    background-color: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    border-radius: var(--radius-full);
    font-weight: 500;
  }

  .sidebar-footer {
    padding: var(--space-3);
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-md);
  }

  .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-full);
    background-color: var(--color-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: var(--text-xs);
  }

  .user-details {
    flex: 1;
  }

  .user-name {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-text);
  }

  .user-role {
    font-size: 10px;
    color: var(--color-text-secondary);
    text-transform: capitalize;
  }

  .btn-change-ambulatorio,
  .btn-logout {
    width: 100%;
    padding: var(--space-2);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-text);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }

  .btn-logout :global(.icon-svg) {
    width: 16px;
    height: 16px;
  }

  .btn-change-ambulatorio:hover {
    background-color: var(--color-bg-secondary);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .btn-logout:hover {
    background-color: var(--color-error);
    border-color: var(--color-error);
    color: white;
  }
</style>

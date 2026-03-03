<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ambulatorioStore } from '$lib/stores/ambulatorio';
  import { authStore } from '$lib/stores/auth';
  import { sidebarCollapsedStore } from '$lib/stores/sidebar';
  import { getAllPazienti } from '$lib/db/pazienti';
  import Card from '$lib/components/Card.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';

  let totalPazienti = 0;
  let loading = true;

  type TherapyStat = {
    therapy: string;
    count: number;
  };

  type RiskLabel = 'Molto Alto' | 'Alto' | 'Moderato' | 'Basso';

  type RiskStat = {
    risk: RiskLabel;
    count: number;
  };

  type ComorbidityStat = {
    label: string;
    count: number;
    percentage: string | number;
  };

  type DashboardStats = {
    totalPatients: number;
    totalVisits: number | null;
    patientsAtTarget: number;
    patientsNotAtTarget: number;
    pcsk9Stats: {
      total: number;
      repatha: number;
      praluent: number;
      leqvio: number;
    };
    topTherapyStats: TherapyStat[];
    riskStats: RiskStat[];
    fdrcvStats: ComorbidityStat[];
  };

  $: ambulatorio = $ambulatorioStore.current;
  $: user = $authStore.user;
  $: ambulatorioId = $page.params.id;
  $: dashboardStats = getDashboardStats(totalPazienti);

  const fallbackRiskOrder: RiskLabel[] = ['Molto Alto', 'Alto', 'Moderato', 'Basso'];
  const fallbackComorbidities = ['Diabete', 'Ipertensione', 'Obesità', 'Fumo', 'Familiarità'];
  const fallbackTopTherapies: TherapyStat[] = [
    { therapy: 'Statina', count: 0 },
    { therapy: 'Statina + Ezetimibe', count: 0 },
    { therapy: 'Ezetimibe', count: 0 },
    { therapy: 'Inibitori PCSK9', count: 0 },
    { therapy: 'Acido Bempedoico', count: 0 }
  ];

  function navigateToVisite() {
    console.log('Navigating to visite, ambulatorioId:', ambulatorioId);
    goto(`/ambulatori/${ambulatorioId}/visite?from=dashboard`);
  }

  function navigateToCercaPaziente() {
    console.log('Navigating to cerca paziente, ambulatorioId:', ambulatorioId);
    goto(`/ambulatori/${ambulatorioId}/pazienti?mode=search&from=dashboard`);
  }

  function navigateToNuovaVisita() {
    console.log('Navigating to nuova visita, ambulatorioId:', ambulatorioId);
    goto(`/ambulatori/${ambulatorioId}/visite/nuova?from=dashboard`);
  }

  onMount(async () => {
    try {
      const pazienti = await getAllPazienti();
      totalPazienti = pazienti.length;
    } catch (error) {
      console.error('Errore caricamento dati dashboard:', error);
    } finally {
      loading = false;
    }
  });

  const getCurrentGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buongiorno';
    if (hour < 18) return 'Buon pomeriggio';
    return 'Buonasera';
  };

  function getDashboardStats(totalPatients: number): DashboardStats {
    return {
      totalPatients,
      totalVisits: null,
      patientsAtTarget: 0,
      patientsNotAtTarget: 0,
      pcsk9Stats: {
        total: 0,
        repatha: 0,
        praluent: 0,
        leqvio: 0
      },
      topTherapyStats: [],
      riskStats: [],
      fdrcvStats: []
    };
  }

  function getTopTherapyItems(items: TherapyStat[]): TherapyStat[] {
    if (items.length > 0) return items.slice(0, 5);
    return fallbackTopTherapies;
  }

  function getRiskItems(items: RiskStat[]): RiskStat[] {
    if (items.length > 0) return items;
    return fallbackRiskOrder.map((risk) => ({ risk, count: 0 }));
  }

  function getComorbidityItems(items: ComorbidityStat[]): ComorbidityStat[] {
    if (items.length > 0) return items;

    return fallbackComorbidities.map((label) => ({
      label,
      count: 0,
      percentage: 0
    }));
  }
</script>

<div class="dashboard">
  <PageHeader
    title="{getCurrentGreeting()}, {user?.nome}"
    subtitle="Benvenuto in {ambulatorio?.nome || 'GMD Medical Platform'}"
    showLogo={$sidebarCollapsedStore}
  />

  <div class="dashboard-content">
    {#if loading}
      <div class="loading-state">Caricamento dati...</div>
    {:else}
      <div class="quick-actions">
        <h2 class="section-title">Strumenti</h2>
        <div class="actions-grid">
          <Card clickable hover on:click={navigateToCercaPaziente}>
            <div class="action-card">
              <div class="action-icon icon-container">
                <svg class="icon-svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="11" cy="11" r="7"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
              <div class="action-info">
                <div class="action-title">Cerca Paziente</div>
                <div class="action-description">Cerca un paziente e apri il suo percorso visite</div>
              </div>
            </div>
          </Card>

          <Card clickable hover on:click={navigateToVisite}>
            <div class="action-card">
              <div class="action-icon icon-container">
                <svg class="icon-svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <div class="action-info">
                <div class="action-title">Archivio Visite</div>
                <div class="action-description">Visualizza e gestisci le visite mediche</div>
              </div>
            </div>
          </Card>

          <Card clickable hover on:click={navigateToNuovaVisita}>
            <div class="action-card">
              <div class="action-icon icon-container">
                <svg class="icon-svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="11" x2="12" y2="17"/>
                  <line x1="9" y1="14" x2="15" y2="14"/>
                </svg>
              </div>
              <div class="action-info">
                <div class="action-title">Nuova Visita</div>
                <div class="action-description">Apri la procedura guidata per creare una nuova visita</div>
              </div>
            </div>
          </Card>

          <Card clickable hover padding="lg">
            <div class="action-card disabled">
              <div class="action-icon icon-container">
                <svg class="icon-svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div class="action-info">
                <div class="action-title">Nuovo Appuntamento</div>
                <div class="action-description">Prenota un appuntamento</div>
              </div>
              <span class="badge-soon">Presto</span>
            </div>
          </Card>

          <Card clickable hover padding="lg">
            <div class="action-card disabled">
              <div class="action-icon icon-container">
                <svg class="icon-svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="transform: rotate(45deg); transform-origin: 50% 50%;">
                  <defs>
                    <clipPath id="pill-half-blue">
                      <rect x="3" y="9" width="9" height="6"/>
                    </clipPath>
                  </defs>
                  <rect x="3" y="9" width="18" height="6" rx="3" fill="currentColor" clip-path="url(#pill-half-blue)"/>
                  <rect x="3" y="9" width="18" height="6" rx="3"/>
                  <line x1="12" y1="9" x2="12" y2="15"/>
                </svg>
              </div>
              <div class="action-info">
                <div class="action-title">Nuova Prescrizione</div>
                <div class="action-description">Crea una prescrizione medica</div>
              </div>
              <span class="badge-soon">Presto</span>
            </div>
          </Card>
        </div>
      </div>

      <div class="stats-section">
        <h2 class="section-title">Statistiche</h2>
        <div class="stats-grid">
          <Card padding="lg">
            <div class="stats-card-shell kpi-card">
              <div class="stats-card-title">Totale Pazienti</div>
              <div class="stats-kpi-value">{dashboardStats.totalPatients}</div>
            </div>
          </Card>

          <Card padding="lg">
            <div class="stats-card-shell kpi-card">
              <div class="stats-card-title">Totale Visite</div>
              <div class="stats-kpi-value">{dashboardStats.totalVisits ?? '-'}</div>
            </div>
          </Card>

          <Card padding="lg">
            <div class="stats-card-shell list-card">
              <div class="stats-card-title">Target Colesterolo LDL</div>
              <div class="stats-list">
                <div class="stats-list-row">
                  <span class="stats-list-label">Pazienti a Target</span>
                  <strong class="stats-list-value">{dashboardStats.patientsAtTarget}</strong>
                </div>
                <div class="stats-list-row">
                  <span class="stats-list-label">Pazienti non a Target</span>
                  <strong class="stats-list-value">{dashboardStats.patientsNotAtTarget}</strong>
                </div>
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <div class="stats-card-shell detail-card">
              <div class="stats-card-title">Pazienti con Inibitori PCSK9</div>
              <div class="stats-detail-top">
                <div class="stats-kpi-value">{dashboardStats.pcsk9Stats.total}</div>
                <div class="stats-detail-subtitle">Totali</div>
              </div>
              <div class="stats-list">
                <div class="stats-list-row">
                  <span class="stats-list-label">Repatha</span>
                  <strong class="stats-list-value">{dashboardStats.pcsk9Stats.repatha}</strong>
                </div>
                <div class="stats-list-row">
                  <span class="stats-list-label">Praluent</span>
                  <strong class="stats-list-value">{dashboardStats.pcsk9Stats.praluent}</strong>
                </div>
                <div class="stats-list-row">
                  <span class="stats-list-label">Leqvio</span>
                  <strong class="stats-list-value">{dashboardStats.pcsk9Stats.leqvio}</strong>
                </div>
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <div class="stats-card-shell list-card">
              <div class="stats-card-title">Pazienti per Terapia (Top)</div>
              <div class="stats-list">
                {#each getTopTherapyItems(dashboardStats.topTherapyStats) as item}
                  <div class="stats-list-row">
                    <span class="stats-list-label">{item.therapy}</span>
                    <strong class="stats-list-value">{item.count}</strong>
                  </div>
                {/each}
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <div class="stats-card-shell list-card">
              <div class="stats-card-title">Rischio CV</div>
              <div class="stats-list">
                {#each getRiskItems(dashboardStats.riskStats) as item}
                  <div class="stats-list-row">
                    <span class="stats-list-label">{item.risk}</span>
                    <strong class="stats-list-value">{item.count}</strong>
                  </div>
                {/each}
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <div class="stats-card-shell list-card">
              <div class="stats-card-title">Comorbidità</div>
              <div class="stats-list">
                {#each getComorbidityItems(dashboardStats.fdrcvStats) as item}
                  <div class="stats-list-row">
                    <span class="stats-list-label">{item.label}</span>
                    <strong class="stats-list-value">{item.count} ({item.percentage}%)</strong>
                  </div>
                {/each}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div class="recent-activity">
        <h2 class="section-title">Attività Recente</h2>
        <Card padding="lg">
          <div class="empty-state">
            <div class="empty-icon">
              <svg class="icon-svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </div>
            <p class="empty-text">Nessuna attività recente da visualizzare</p>
            <p class="empty-subtext">Le attività appariranno qui quando ci saranno nuovi eventi</p>
          </div>
        </Card>
      </div>
    {/if}
  </div>
</div>

<style>
  .dashboard {
    min-height: 100vh;
    padding: var(--space-8);
  }

  .dashboard-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }

  .loading-state {
    text-align: center;
    padding: var(--space-12);
    color: var(--color-text-secondary);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--space-6);
  }

  .stats-card-shell {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-height: 100%;
  }

  .stats-card-title {
    font-size: var(--text-base);
    font-weight: 700;
    color: var(--color-text);
    line-height: 1.35;
    text-align: center;
  }

  .stats-kpi-value {
    font-size: clamp(2rem, 3vw, 2.8rem);
    font-weight: 700;
    color: var(--color-primary);
    line-height: 1;
  }

  .kpi-card .stats-kpi-value,
  .detail-card .stats-kpi-value {
    text-align: center;
  }

  .stats-detail-top {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .stats-detail-subtitle {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .stats-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .stats-list-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--color-border);
  }

  .stats-list-row:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .stats-list-label {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .stats-list-value {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--color-text);
    text-align: right;
    white-space: nowrap;
  }

  .section-title {
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 var(--space-4) 0;
  }

  .actions-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-6);
  }

  .action-card {
    display: flex;
    align-items: center;
    gap: var(--space-6);
    padding: var(--space-6);
    position: relative;
  }

  .action-card.disabled {
    opacity: 0.6;
  }

  .action-icon {
    width: 80px;
    height: 80px;
    flex-shrink: 0;
  }

  .action-info {
    flex: 1;
  }

  .action-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: var(--space-1);
  }

  .action-description {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .badge-soon {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
    background-color: var(--color-accent);
    color: white;
    border-radius: var(--radius-full);
    font-weight: 600;
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

  .empty-text {
    font-size: var(--text-base);
    color: var(--color-text);
    margin: 0 0 var(--space-2) 0;
  }

  .empty-subtext {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin: 0;
  }

  @media (max-width: 960px) {
    .actions-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

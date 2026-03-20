<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import type {
    CalendarOptions,
    DatesSetArg,
    EventClickArg,
    EventDropArg,
    EventInput
  } from '@fullcalendar/core';
  import dayGridPlugin from '@fullcalendar/daygrid';
  import timeGridPlugin from '@fullcalendar/timegrid';
  import interactionPlugin from '@fullcalendar/interaction';
  import itLocale from '@fullcalendar/core/locales/it';
  import FullCalendar from 'svelte-fullcalendar';
  import { sidebarCollapsedStore } from '$lib/stores/sidebar';
  import { toastStore } from '$lib/stores/toast';
  import {
    createAppuntamentoManuale,
    deleteAppuntamento,
    getAppuntamentoEndDateTime,
    getAppuntamentiByRange,
    normalizeAppuntamentoDateTimeInput,
    updateAppuntamento
  } from '$lib/db/appuntamenti';
  import { getAllPazienti } from '$lib/db/pazienti';
  import type { Appuntamento, Paziente } from '$lib/db/types';
  import Card from '$lib/components/Card.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Icon from '$lib/components/Icon.svelte';

  type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';

  type AppointmentFormState = {
    pazienteId: number;
    date: string;
    time: string;
    motivo: string;
  };

  const viewLabels: Record<CalendarView, string> = {
    dayGridMonth: 'Mese',
    timeGridWeek: 'Settimana',
    timeGridDay: 'Giorno'
  };

  const calendarPlugins = [dayGridPlugin, timeGridPlugin, interactionPlugin];
  const today = new Date();

  $: ambulatorioId = Number.parseInt($page.params.id || '0', 10);

  let calendarRef: FullCalendar | null = null;
  let calendarOptions: CalendarOptions;
  let loading = true;
  let loadingPatients = false;
  let savingAppointment = false;
  let deletingAppointment = false;
  let currentView: CalendarView = 'dayGridMonth';
  let jumpDate = formatDateOnly(today);
  let currentRangeStart = '';
  let currentRangeEndExclusive = '';
  let appuntamenti: Appuntamento[] = [];
  let calendarEvents: EventInput[] = [];
  let daysWithAppointments = new Set<string>();
  let patients: Paziente[] = [];
  let showAppointmentModal = false;
  let editingAppointment: Appuntamento | null = null;
  let appointmentForm: AppointmentFormState = {
    pazienteId: 0,
    date: formatDateOnly(today),
    time: '08:00',
    motivo: ''
  };

  $: ambulatorioPatients = patients
    .filter((patient) => patient.ambulatorio_id === ambulatorioId)
    .sort((left, right) => {
      const surnameComparison = left.cognome.localeCompare(right.cognome, 'it');
      if (surnameComparison !== 0) {
        return surnameComparison;
      }
      return left.nome.localeCompare(right.nome, 'it');
    });
  $: isEditing = editingAppointment !== null;
  $: isFollowUpAppointment = editingAppointment?.origine === 'followup_visita';
  $: modalTitle = isEditing ? 'Modifica Appuntamento' : 'Nuovo Appuntamento';

  function formatDateOnly(date: Date): string {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatTimeOnly(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  function formatDateTime(date: Date): string {
    return `${formatDateOnly(date)}T${formatTimeOnly(date)}`;
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim()) {
      return error;
    }

    return 'Errore sconosciuto';
  }

  function getCalendarApi() {
    return calendarRef?.getAPI() ?? null;
  }

  function syncJumpDateFromCalendar(): void {
    const api = getCalendarApi();
    if (!api) {
      return;
    }

    jumpDate = formatDateOnly(api.getDate());
  }

  function buildEventTitle(appointment: Appuntamento): string {
    const patientName = [appointment.paziente_cognome, appointment.paziente_nome]
      .filter(Boolean)
      .join(' ')
      .trim();
    return patientName || 'Appuntamento';
  }

  function mapAppointmentsToEvents(items: Appuntamento[]): EventInput[] {
    return items.map((appointment) => ({
      id: String(appointment.id),
      title: buildEventTitle(appointment),
      start: normalizeAppuntamentoDateTimeInput(appointment.data_ora_inizio),
      end: getAppuntamentoEndDateTime(
        appointment.data_ora_inizio,
        appointment.durata_minuti || 30
      ),
      classNames: appointment.origine === 'followup_visita'
        ? ['calendar-event', 'calendar-event-followup']
        : ['calendar-event', 'calendar-event-manual'],
      extendedProps: {
        origine: appointment.origine
      }
    }));
  }

  function dayCellClassNames(arg: { date: Date; view: { type: string } }): string[] {
    if (arg.view.type !== 'dayGridMonth') {
      return [];
    }

    const day = formatDateOnly(arg.date);
    return daysWithAppointments.has(day) ? ['fc-day-has-appointments'] : [];
  }

  async function loadPatients(): Promise<void> {
    loadingPatients = true;
    try {
      patients = await getAllPazienti();
    } catch (error) {
      console.error('Errore caricamento pazienti:', error);
      toastStore.show('error', `Errore caricamento pazienti: ${getErrorMessage(error)}`);
    } finally {
      loadingPatients = false;
    }
  }

  async function reloadAppointmentsForCurrentRange(): Promise<void> {
    if (!currentRangeStart || !currentRangeEndExclusive || !ambulatorioId) {
      loading = false;
      return;
    }

    try {
      const items = await getAppuntamentiByRange({
        ambulatorioId,
        rangeStart: currentRangeStart,
        rangeEndExclusive: currentRangeEndExclusive
      });

      appuntamenti = items;
      calendarEvents = mapAppointmentsToEvents(items);
      daysWithAppointments = new Set(
        items.map((appointment) =>
          normalizeAppuntamentoDateTimeInput(appointment.data_ora_inizio).slice(0, 10)
        )
      );
    } catch (error) {
      console.error('Errore caricamento appuntamenti:', error);
      toastStore.show('error', `Errore caricamento appuntamenti: ${getErrorMessage(error)}`);
    } finally {
      loading = false;
    }
  }

  async function handleDatesSet(arg: DatesSetArg): Promise<void> {
    currentView = arg.view.type as CalendarView;
    currentRangeStart = formatDateTime(arg.start);
    currentRangeEndExclusive = formatDateTime(arg.end);
    syncJumpDateFromCalendar();
    await reloadAppointmentsForCurrentRange();
  }

  function openCreateModal(date: Date): void {
    const nextDate = formatDateOnly(date);
    let nextTime = formatTimeOnly(date);

    const minute = Number(nextTime.slice(3, 5));
    if (minute % 30 !== 0) {
      nextTime = minute < 30 ? `${nextTime.slice(0, 2)}:30` : `${String(Number(nextTime.slice(0, 2)) + 1).padStart(2, '0')}:00`;
    }

    if (nextTime < '08:00') {
      nextTime = '08:00';
    } else if (nextTime > '19:30') {
      nextTime = '19:30';
    }

    appointmentForm = {
      pazienteId: 0,
      date: nextDate,
      time: nextTime,
      motivo: ''
    };
    editingAppointment = null;
    showAppointmentModal = true;
  }

  function openEditModal(appointment: Appuntamento): void {
    const normalizedStart = normalizeAppuntamentoDateTimeInput(appointment.data_ora_inizio);
    appointmentForm = {
      pazienteId: appointment.paziente_id,
      date: normalizedStart.slice(0, 10),
      time: normalizedStart.slice(11, 16),
      motivo: appointment.motivo || ''
    };
    editingAppointment = appointment;
    showAppointmentModal = true;
  }

  function closeModal(): void {
    showAppointmentModal = false;
    editingAppointment = null;
    deletingAppointment = false;
    savingAppointment = false;
  }

  function handleDateClick(arg: any): void {
    if (arg.view.type === 'dayGridMonth') {
      const api = getCalendarApi();
      if (!api) {
        return;
      }

      api.changeView('timeGridDay', arg.date);
      currentView = 'timeGridDay';
      syncJumpDateFromCalendar();
      return;
    }

    openCreateModal(arg.date);
  }

  function handleSelect(arg: any): void {
    if (arg.view.type === 'dayGridMonth') {
      return;
    }

    openCreateModal(arg.start);
    const api = getCalendarApi();
    api?.unselect();
  }

  function handleEventClick(arg: EventClickArg): void {
    const appointmentId = Number.parseInt(arg.event.id, 10);
    if (!Number.isInteger(appointmentId)) {
      return;
    }

    const appointment = appuntamenti.find((item) => item.id === appointmentId);
    if (!appointment) {
      return;
    }

    openEditModal(appointment);
  }

  async function handleEventDrop(arg: EventDropArg): Promise<void> {
    const appointmentId = Number.parseInt(arg.event.id, 10);
    const newStart = arg.event.start;

    if (!Number.isInteger(appointmentId) || !newStart) {
      arg.revert();
      return;
    }

    try {
      await updateAppuntamento({
        id: appointmentId,
        data_ora_inizio: formatDateTime(newStart)
      });
      toastStore.show('success', 'Appuntamento aggiornato');
      await reloadAppointmentsForCurrentRange();
    } catch (error) {
      console.error('Errore spostamento appuntamento:', error);
      arg.revert();
      toastStore.show('error', `Impossibile spostare appuntamento: ${getErrorMessage(error)}`);
    }
  }

  async function saveAppointment(): Promise<void> {
    if (!appointmentForm.pazienteId) {
      toastStore.show('error', 'Seleziona un paziente');
      return;
    }

    if (!appointmentForm.date || !appointmentForm.time) {
      toastStore.show('error', 'Inserisci data e orario');
      return;
    }

    const dateTime = `${appointmentForm.date}T${appointmentForm.time}`;
    savingAppointment = true;

    try {
      if (isEditing && editingAppointment) {
        await updateAppuntamento({
          id: editingAppointment.id,
          paziente_id: isFollowUpAppointment ? undefined : appointmentForm.pazienteId,
          data_ora_inizio: dateTime,
          motivo: appointmentForm.motivo
        });
        toastStore.show('success', 'Appuntamento aggiornato');
      } else {
        await createAppuntamentoManuale({
          ambulatorio_id: ambulatorioId,
          paziente_id: appointmentForm.pazienteId,
          data_ora_inizio: dateTime,
          motivo: appointmentForm.motivo
        });
        toastStore.show('success', 'Appuntamento creato');
      }

      closeModal();
      await reloadAppointmentsForCurrentRange();
    } catch (error) {
      console.error('Errore salvataggio appuntamento:', error);
      toastStore.show('error', `Errore salvataggio appuntamento: ${getErrorMessage(error)}`);
    } finally {
      savingAppointment = false;
    }
  }

  async function removeAppointment(): Promise<void> {
    if (!editingAppointment) {
      return;
    }

    deletingAppointment = true;
    try {
      await deleteAppuntamento(editingAppointment.id);
      toastStore.show('success', 'Appuntamento eliminato');
      closeModal();
      await reloadAppointmentsForCurrentRange();
    } catch (error) {
      console.error('Errore eliminazione appuntamento:', error);
      toastStore.show('error', `Errore eliminazione appuntamento: ${getErrorMessage(error)}`);
    } finally {
      deletingAppointment = false;
    }
  }

  function changeView(view: CalendarView): void {
    const api = getCalendarApi();
    if (!api) {
      return;
    }

    api.changeView(view);
    currentView = view;
    syncJumpDateFromCalendar();
  }

  function navigatePrev(): void {
    const api = getCalendarApi();
    if (!api) {
      return;
    }

    api.prev();
    syncJumpDateFromCalendar();
  }

  function navigateNext(): void {
    const api = getCalendarApi();
    if (!api) {
      return;
    }

    api.next();
    syncJumpDateFromCalendar();
  }

  function navigateToday(): void {
    const api = getCalendarApi();
    if (!api) {
      return;
    }

    api.today();
    syncJumpDateFromCalendar();
  }

  function jumpToDate(): void {
    if (!jumpDate.trim()) {
      return;
    }

    const api = getCalendarApi();
    if (!api) {
      return;
    }

    api.gotoDate(`${jumpDate}T00:00`);
  }

  $: calendarOptions = {
    plugins: calendarPlugins,
    locales: [itLocale],
    locale: 'it',
    initialView: 'dayGridMonth',
    allDaySlot: false,
    nowIndicator: true,
    editable: true,
    selectable: true,
    selectMirror: false,
    eventDurationEditable: false,
    slotDuration: '00:30:00',
    slotMinTime: '08:00:00',
    slotMaxTime: '20:00:00',
    headerToolbar: false,
    dayMaxEvents: 3,
    dayCellClassNames,
    datesSet: handleDatesSet,
    dateClick: handleDateClick,
    select: handleSelect,
    eventClick: handleEventClick,
    eventDrop: handleEventDrop,
    views: {
      timeGridDay: {
        dayHeaderFormat: {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        },
        titleFormat: {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }
      }
    },
    events: calendarEvents
  };

  onMount(() => {
    void loadPatients();
  });
</script>

<div class="appuntamenti-page">
  <PageHeader
    title="Appuntamenti"
    subtitle="Gestisci il calendario appuntamenti (mese, settimana, giorno)"
    showLogo={$sidebarCollapsedStore}
    onBack={() => goto(`/ambulatori/${ambulatorioId}`)}
  >
    <div slot="actions" class="header-actions">
      <button type="button" class="btn-icon-text" on:click={() => openCreateModal(new Date())}>
        <span class="icon">
          <Icon name="calendar-plus" size={22} />
        </span>
        <span class="text">Nuovo Appuntamento</span>
      </button>
    </div>
  </PageHeader>

  <Card>
    <div class="calendar-toolbar">
      <div class="toolbar-nav">
        <button type="button" class="btn-secondary" on:click={navigatePrev}>Prec</button>
        <button type="button" class="btn-secondary" on:click={navigateToday}>Oggi</button>
        <button type="button" class="btn-secondary" on:click={navigateNext}>Succ</button>
      </div>

      <div class="toolbar-views">
        <button
          type="button"
          class="btn-secondary"
          class:active={currentView === 'dayGridMonth'}
          on:click={() => changeView('dayGridMonth')}
        >
          Mese
        </button>
        <button
          type="button"
          class="btn-secondary"
          class:active={currentView === 'timeGridWeek'}
          on:click={() => changeView('timeGridWeek')}
        >
          Settimana
        </button>
        <button
          type="button"
          class="btn-secondary"
          class:active={currentView === 'timeGridDay'}
          on:click={() => changeView('timeGridDay')}
        >
          Giorno
        </button>
      </div>

      <div class="toolbar-jump">
        <input type="date" bind:value={jumpDate} />
        <button type="button" class="btn-secondary" on:click={jumpToDate}>Vai</button>
      </div>
    </div>

    <div class="calendar-wrapper">
      {#if loading}
        <div class="loading-overlay">Caricamento calendario...</div>
      {/if}
      <FullCalendar bind:this={calendarRef} options={calendarOptions} />
    </div>

    <div class="legend">
      <span class="legend-item">
        <span class="legend-dot manual"></span>
        Manuale
      </span>
      <span class="legend-item">
        <span class="legend-dot followup"></span>
        Da follow-up visita
      </span>
      <span class="legend-note">Vista corrente: {viewLabels[currentView]}</span>
    </div>
  </Card>
</div>

<Modal bind:open={showAppointmentModal} title={modalTitle} size="md">
  <div class="modal-form">
    <div class="form-group">
      <label for="appointment_patient">Paziente *</label>
      <select
        id="appointment_patient"
        bind:value={appointmentForm.pazienteId}
        disabled={loadingPatients || isFollowUpAppointment}
      >
        <option value={0}>Seleziona paziente</option>
        {#each ambulatorioPatients as patient}
          <option value={patient.id}>{patient.cognome} {patient.nome}</option>
        {/each}
      </select>
      {#if isFollowUpAppointment}
        <small class="help-text">
          Appuntamento da follow-up: il paziente della visita origine non è modificabile.
        </small>
      {/if}
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="appointment_date">Data *</label>
        <input id="appointment_date" type="date" bind:value={appointmentForm.date} />
      </div>
      <div class="form-group">
        <label for="appointment_time">Orario *</label>
        <input id="appointment_time" type="time" step="1800" bind:value={appointmentForm.time} />
      </div>
    </div>

    <div class="form-group">
      <label for="appointment_reason">Motivo</label>
      <input id="appointment_reason" type="text" bind:value={appointmentForm.motivo} />
    </div>
  </div>

  <svelte:fragment slot="footer">
    <div class="modal-actions">
      {#if isEditing}
        <button type="button" class="btn-danger" on:click={removeAppointment} disabled={deletingAppointment || savingAppointment}>
          {deletingAppointment ? 'Eliminazione...' : 'Elimina'}
        </button>
      {/if}

      <div class="modal-actions-right">
        <button type="button" class="btn-secondary" on:click={closeModal} disabled={savingAppointment || deletingAppointment}>
          Annulla
        </button>
        <button type="button" class="btn-primary" on:click={saveAppointment} disabled={savingAppointment || deletingAppointment}>
          {savingAppointment ? 'Salvataggio...' : 'Salva'}
        </button>
      </div>
    </div>
  </svelte:fragment>
</Modal>

<style>
  :global(.fc) {
    --fc-border-color: var(--color-border);
    --fc-button-bg-color: var(--color-primary);
    --fc-button-border-color: var(--color-primary);
    --fc-button-hover-bg-color: var(--color-primary-dark);
    --fc-button-hover-border-color: var(--color-primary-dark);
    --fc-button-active-bg-color: var(--color-primary-dark);
    --fc-button-active-border-color: var(--color-primary-dark);
    --fc-event-border-color: transparent;
    --fc-event-text-color: var(--color-text);
    --fc-page-bg-color: var(--color-bg-primary);
    --fc-today-bg-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }

  :global(.fc .fc-toolbar-title) {
    font-size: var(--text-lg);
    font-weight: 600;
  }

  :global(.fc .fc-col-header-cell-cushion) {
    color: var(--color-text);
    font-weight: 600;
  }

  :global(.fc .fc-daygrid-day-number) {
    color: var(--color-text);
  }

  :global(.fc .fc-timegrid-slot-label-cushion) {
    color: var(--color-text-secondary);
  }

  :global(.fc .fc-day-has-appointments) {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  }

  :global(.fc .calendar-event) {
    border-radius: var(--radius-sm);
    padding: 2px 4px;
    font-size: var(--text-xs);
  }

  :global(.fc .calendar-event-manual) {
    background: color-mix(in srgb, var(--color-primary) 20%, var(--color-bg-secondary));
  }

  :global(.fc .calendar-event-followup) {
    background: color-mix(in srgb, var(--color-success) 22%, var(--color-bg-secondary));
  }

  .appuntamenti-page {
    padding: var(--space-6);
    max-width: 1500px;
    margin: 0 auto;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .calendar-toolbar {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .toolbar-nav,
  .toolbar-views,
  .toolbar-jump {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .toolbar-jump input {
    min-width: 170px;
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text);
  }

  .btn-primary,
  .btn-secondary,
  .btn-danger {
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    cursor: pointer;
    font-size: var(--text-sm);
    transition: opacity 0.2s;
  }

  .btn-primary {
    background: var(--color-primary);
    color: #fff;
    border-color: var(--color-primary);
  }

  .btn-secondary {
    background: var(--color-bg-primary);
    color: var(--color-text);
    border-color: var(--color-border);
  }

  .btn-secondary.active {
    background: var(--color-primary);
    color: #fff;
    border-color: var(--color-primary);
  }

  .btn-danger {
    background: color-mix(in srgb, var(--color-error) 14%, var(--color-bg-primary));
    color: var(--color-error);
    border-color: color-mix(in srgb, var(--color-error) 40%, transparent);
  }

  .btn-primary:disabled,
  .btn-secondary:disabled,
  .btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .calendar-wrapper {
    position: relative;
    overflow-x: auto;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--color-bg-primary) 85%, transparent);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
    backdrop-filter: blur(1px);
  }

  .legend {
    margin-top: var(--space-3);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
  }

  .legend-dot.manual {
    background: color-mix(in srgb, var(--color-primary) 50%, #ffffff);
  }

  .legend-dot.followup {
    background: color-mix(in srgb, var(--color-success) 60%, #ffffff);
  }

  .legend-note {
    margin-left: auto;
    font-style: italic;
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text);
  }

  .form-group input,
  .form-group select {
    padding: var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text);
  }

  .help-text {
    color: var(--color-text-secondary);
    font-size: var(--text-xs);
  }

  .modal-actions {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-2);
  }

  .modal-actions-right {
    margin-left: auto;
    display: flex;
    gap: var(--space-2);
  }

  @media (max-width: 900px) {
    .appuntamenti-page {
      padding: var(--space-4);
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .legend-note {
      width: 100%;
      margin-left: 0;
    }
  }
</style>

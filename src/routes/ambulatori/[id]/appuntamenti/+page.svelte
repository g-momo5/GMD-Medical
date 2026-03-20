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
    findFirstQuarterHourSlot,
    findFirstUrgentSlot,
    getAppuntamentiByRange,
    getDailyAppointmentCountsByRange,
    normalizeAppuntamentoDateTimeInput,
    updateAppuntamento
  } from '$lib/db/appuntamenti';
  import { getAmbulatorioOperatingSettingsById } from '$lib/db/ambulatori';
  import { getAllPazienti } from '$lib/db/pazienti';
  import type {
    AmbulatorioOperatingSettings,
    Appuntamento,
    FirstSlotSearchMode,
    AppuntamentoWriteOptions,
    AppuntamentoWriteOutcome,
    Paziente
  } from '$lib/db/types';
  import Card from '$lib/components/Card.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Icon from '$lib/components/Icon.svelte';

  type CalendarView = 'dayGridMonth' | 'timeGridDay';

  type AppointmentFormState = {
    pazienteId: number;
    date: string;
    startTime: string;
    endTime: string;
    motivo: string;
  };

  const viewLabels: Record<CalendarView, string> = {
    dayGridMonth: 'Mese',
    timeGridDay: 'Giorno'
  };

  const CALENDAR_VISIBLE_START_TIME = '08:00:00';
  const CALENDAR_VISIBLE_END_TIME = '20:00:00';
  const DEFAULT_APPOINTMENT_DURATION_MINUTES = 15;
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
  let calendarTitle = '';
  let jumpDate = formatDateOnly(today);
  let currentRangeStart = '';
  let currentRangeEndExclusive = '';
  let appuntamenti: Appuntamento[] = [];
  let calendarEvents: EventInput[] = [];
  let dailyCounts = new Map<string, number>();
  let daysWithAppointments = new Set<string>();
  let patients: Paziente[] = [];
  let operatingSettings: AmbulatorioOperatingSettings | null = null;
  let standardVisitDurationMinutes = DEFAULT_APPOINTMENT_DURATION_MINUTES;
  let calendarSlotMinTime = CALENDAR_VISIBLE_START_TIME;
  let calendarSlotMaxTime = CALENDAR_VISIBLE_END_TIME;
  let calendarSlotDuration = '00:15:00';
  let calendarBusinessHours: CalendarOptions['businessHours'] = false;
  let loadedAmbulatorioId = 0;
  let showAppointmentModal = false;
  let editingAppointment: Appuntamento | null = null;
  let searchingFirstSlotMode: FirstSlotSearchMode | null = null;
  let nextUrgentSearchCursor: string | null = null;
  let nextQuarterHourSearchCursor: string | null = null;
  let appointmentForm: AppointmentFormState = {
    pazienteId: 0,
    date: formatDateOnly(today),
    startTime: '08:00',
    endTime: '08:15',
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
  $: currentDayCount = dailyCounts.get(jumpDate) ?? 0;
  $: standardVisitDurationMinutes = Math.max(
    10,
    operatingSettings?.durataStandardVisitaMinuti ?? DEFAULT_APPOINTMENT_DURATION_MINUTES
  );
  $: {
    if (ambulatorioId > 0 && ambulatorioId !== loadedAmbulatorioId) {
      loadedAmbulatorioId = ambulatorioId;
      nextUrgentSearchCursor = null;
      nextQuarterHourSearchCursor = null;
      void initializeAmbulatorioContext();
    }
  }

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

  function addMinutesToDateTime(dateTime: string, minutes: number): string {
    const date = new Date(normalizeAppuntamentoDateTimeInput(dateTime));
    date.setMinutes(date.getMinutes() + minutes);
    return formatDateTime(date);
  }

  function getDurationStringFromMinutes(minutes: number): string {
    const safeMinutes = Math.max(5, minutes);
    const hours = String(Math.floor(safeMinutes / 60)).padStart(2, '0');
    const remainingMinutes = String(safeMinutes % 60).padStart(2, '0');
    return `${hours}:${remainingMinutes}:00`;
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

  function getIsoWeekday(date: Date): number {
    const day = date.getDay();
    return day === 0 ? 7 : day;
  }

  function hasWorkingWindowForDate(date: Date): boolean {
    if (!operatingSettings) {
      return false;
    }

    const weekday = getIsoWeekday(date);
    return operatingSettings.windows.some((window) => window.weekday === weekday);
  }

  function applyCalendarOperatingSettings(settings: AmbulatorioOperatingSettings | null): void {
    const windows = settings?.windows ?? [];
    const standardDuration = Math.max(
      10,
      settings?.durataStandardVisitaMinuti ?? DEFAULT_APPOINTMENT_DURATION_MINUTES
    );
    calendarSlotDuration = getDurationStringFromMinutes(standardDuration);
    calendarSlotMinTime = CALENDAR_VISIBLE_START_TIME;
    calendarSlotMaxTime = CALENDAR_VISIBLE_END_TIME;

    if (windows.length === 0) {
      calendarBusinessHours = false;
      return;
    }

    const businessHours: NonNullable<CalendarOptions['businessHours']> = [];

    for (const window of windows) {
      businessHours.push({
        daysOfWeek: [window.weekday === 7 ? 0 : window.weekday],
        startTime: window.ora_inizio,
        endTime: window.ora_fine
      });
    }

    calendarBusinessHours = businessHours;
  }

  function syncJumpDateFromCalendar(): void {
    const api = getCalendarApi();
    if (!api) {
      return;
    }

    jumpDate = formatDateOnly(api.getDate());
  }

  function normalizeCalendarView(viewType: string): CalendarView {
    return viewType === 'timeGridDay' ? 'timeGridDay' : 'dayGridMonth';
  }

  function buildEventTitle(appointment: Appuntamento): string {
    const patientName = [appointment.paziente_cognome, appointment.paziente_nome]
      .filter(Boolean)
      .join(' ')
      .trim();
    const normalizedPatientName = patientName || 'Appuntamento';
    const birthDate = formatBirthDateLabel(appointment.paziente_data_nascita);
    const reason = String(appointment.motivo || '').trim();

    const heading = birthDate ? `${normalizedPatientName} (${birthDate})` : normalizedPatientName;
    return reason ? `${heading} - ${reason}` : heading;
  }

  function formatBirthDateLabel(value: string | undefined): string {
    if (!value) {
      return '';
    }

    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    return `${String(parsed.getDate()).padStart(2, '0')}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}`;
  }

  function mapAppointmentsToEvents(items: Appuntamento[]): EventInput[] {
    return items.map((appointment) => ({
      id: String(appointment.id),
      title: buildEventTitle(appointment),
      start: normalizeAppuntamentoDateTimeInput(appointment.data_ora_inizio),
      end: normalizeAppuntamentoDateTimeInput(appointment.data_ora_fine),
      classNames: appointment.origine === 'followup_visita'
        ? ['calendar-event', 'calendar-event-followup']
        : ['calendar-event', 'calendar-event-manual'],
      extendedProps: {
        origine: appointment.origine
      }
    }));
  }

  function areStringArraysEqual(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        return false;
      }
    }

    return true;
  }

  function syncCalendarEvents(nextEvents: EventInput[]): void {
    const api = getCalendarApi();
    if (!api) {
      return;
    }

    const pendingById = new Map<string, EventInput>();
    for (const nextEvent of nextEvents) {
      const eventId = typeof nextEvent.id === 'string' ? nextEvent.id : String(nextEvent.id ?? '');
      if (!eventId) {
        continue;
      }
      pendingById.set(eventId, nextEvent);
    }

    api.batchRendering(() => {
      for (const existingEvent of api.getEvents()) {
        const nextEvent = pendingById.get(existingEvent.id);
        if (!nextEvent) {
          existingEvent.remove();
          continue;
        }

        const nextTitle = typeof nextEvent.title === 'string' ? nextEvent.title : '';
        if (existingEvent.title !== nextTitle) {
          existingEvent.setProp('title', nextTitle);
        }

        const nextStart = typeof nextEvent.start === 'string' ? normalizeAppuntamentoDateTimeInput(nextEvent.start) : '';
        const nextEnd = typeof nextEvent.end === 'string' ? normalizeAppuntamentoDateTimeInput(nextEvent.end) : '';
        const currentStart = existingEvent.start ? formatDateTime(existingEvent.start) : '';
        const currentEnd = existingEvent.end ? formatDateTime(existingEvent.end) : '';
        if (nextStart && nextEnd && (nextStart !== currentStart || nextEnd !== currentEnd)) {
          existingEvent.setDates(nextStart, nextEnd);
        }

        const nextClassNames = Array.isArray(nextEvent.classNames)
          ? nextEvent.classNames.map((className) => String(className))
          : [];
        const currentClassNames = existingEvent.classNames ?? [];
        if (nextClassNames.length > 0 && !areStringArraysEqual(currentClassNames, nextClassNames)) {
          existingEvent.setProp('classNames', nextClassNames);
        }

        pendingById.delete(existingEvent.id);
      }

      for (const pendingEvent of pendingById.values()) {
        api.addEvent(pendingEvent);
      }
    });
  }

  function getCalendarRootElement(): HTMLElement | null {
    const api = getCalendarApi();
    if (!api) {
      return null;
    }

    const root = (api as unknown as { el?: HTMLElement }).el;
    return root instanceof HTMLElement ? root : null;
  }

  function refreshCalendarDecorations(): void {
    const root = getCalendarRootElement();
    if (!root) {
      return;
    }

    const monthDayCells = root.querySelectorAll<HTMLElement>('.fc-daygrid-day[data-date]');
    for (const dayCell of monthDayCells) {
      const dateValue = dayCell.dataset.date;
      if (!dateValue) {
        continue;
      }

      if (daysWithAppointments.has(dateValue)) {
        dayCell.classList.add('fc-day-has-appointments');
      } else {
        dayCell.classList.remove('fc-day-has-appointments');
      }

      const cellDate = new Date(`${dateValue}T00:00`);
      if (!Number.isNaN(cellDate.getTime()) && !hasWorkingWindowForDate(cellDate)) {
        dayCell.classList.add('fc-day-non-working');
      } else {
        dayCell.classList.remove('fc-day-non-working');
      }

      dayCell.querySelector('.day-count-badge')?.remove();
      const count = dailyCounts.get(dateValue) ?? 0;
      if (count <= 0) {
        continue;
      }

      const topCell = dayCell.querySelector('.fc-daygrid-day-top');
      if (!topCell) {
        continue;
      }

      const badge = document.createElement('span');
      badge.className = 'day-count-badge';
      badge.textContent = String(count);
      badge.title = `${count} visite`;
      topCell.appendChild(badge);
    }

    const shouldShowHeaderPills = currentView === 'timeGridDay';
    const headerCells = root.querySelectorAll<HTMLElement>('.fc-col-header-cell[data-date]');
    for (const headerCell of headerCells) {
      const header = headerCell.querySelector('.fc-col-header-cell-cushion');
      if (!header) {
        continue;
      }

      header.querySelector('.fc-day-count-pill')?.remove();

      if (!shouldShowHeaderPills) {
        continue;
      }

      const dateValue = headerCell.dataset.date;
      if (!dateValue) {
        continue;
      }

      const count = dailyCounts.get(dateValue) ?? 0;
      if (count <= 0) {
        continue;
      }

      const pill = document.createElement('span');
      pill.className = 'fc-day-count-pill';
      pill.textContent = String(count);
      pill.title = `${count} visite`;
      header.appendChild(pill);
    }
  }

  function dayCellClassNames(arg: { date: Date; view: { type: string } }): string[] {
    if (arg.view.type !== 'dayGridMonth') {
      return [];
    }

    const day = formatDateOnly(arg.date);
    const classes: string[] = [];
    if (daysWithAppointments.has(day)) {
      classes.push('fc-day-has-appointments');
    }

    if (!hasWorkingWindowForDate(arg.date)) {
      classes.push('fc-day-non-working');
    }

    return classes;
  }

  function dayCellDidMount(arg: { date: Date; view: { type: string }; el: HTMLElement }): void {
    if (arg.view.type !== 'dayGridMonth') {
      return;
    }

    arg.el.querySelector('.day-count-badge')?.remove();

    const day = formatDateOnly(arg.date);
    const count = dailyCounts.get(day) ?? 0;
    if (count <= 0) {
      return;
    }

    const topCell = arg.el.querySelector('.fc-daygrid-day-top');
    if (!topCell) {
      return;
    }

    const badge = document.createElement('span');
    badge.className = 'day-count-badge';
    badge.textContent = String(count);
    badge.title = `${count} visite`;
    topCell.appendChild(badge);
  }

  function dayHeaderDidMount(arg: { date: Date; view: { type: string }; el: HTMLElement }): void {
    if (arg.view.type !== 'timeGridDay') {
      return;
    }

    arg.el.querySelector('.fc-day-count-pill')?.remove();

    const day = formatDateOnly(arg.date);
    const count = dailyCounts.get(day) ?? 0;
    if (count <= 0) {
      return;
    }

    const header = arg.el.querySelector('.fc-col-header-cell-cushion');
    if (!header) {
      return;
    }

    const pill = document.createElement('span');
    pill.className = 'fc-day-count-pill';
    pill.textContent = String(count);
    pill.title = `${count} visite`;
    header.appendChild(pill);
  }

  function buildRequirementsMessage(outcome: AppuntamentoWriteOutcome): string {
    const requirements = outcome.requirements;
    if (!requirements) {
      return 'Conferma richiesta per la prenotazione.';
    }

    const blocks: string[] = [];
    if (requirements.requiresOutsideHoursConfirmation) {
      blocks.push(requirements.outsideHoursMessage || 'Appuntamento fuori orario/giorno di funzionamento.');
    }

    if (requirements.requiresOverlapAdjustmentConfirmation) {
      if (requirements.overlapAdjustments.length === 0) {
        blocks.push('Sono richiesti aggiustamenti automatici per evitare sovrapposizioni.');
      } else {
        const rows = requirements.overlapAdjustments.map((adjustment) => {
          if (adjustment.type === 'trim_previous_end') {
            const subject = `Appuntamento precedente${adjustment.pazienteNome ? ` (${adjustment.pazienteNome})` : ''}`;
            return `- ${subject}: fine ${adjustment.oldEnd.slice(11, 16)} -> ${adjustment.newEnd.slice(11, 16)}`;
          }

          if (adjustment.type === 'trim_next_start') {
            const subject = `Appuntamento successivo${adjustment.pazienteNome ? ` (${adjustment.pazienteNome})` : ''}`;
            return `- ${subject}: inizio ${adjustment.oldEnd.slice(11, 16)} -> ${adjustment.newEnd.slice(11, 16)}`;
          }

          return `- Nuovo appuntamento: fine ${adjustment.oldEnd.slice(11, 16)} -> ${adjustment.newEnd.slice(11, 16)}`;
        });
        blocks.push(`Aggiustamenti proposti:\n${rows.join('\n')}`);
      }
    }

    return blocks.join('\n\n');
  }

  async function executeWithConfirmations(
    operation: (options: AppuntamentoWriteOptions) => Promise<AppuntamentoWriteOutcome>
  ): Promise<AppuntamentoWriteOutcome | null> {
    let options: AppuntamentoWriteOptions = {};

    while (true) {
      const outcome = await operation(options);
      if (outcome.saved) {
        return outcome;
      }

      const requirements = outcome.requirements;
      if (!requirements) {
        return null;
      }

      if (requirements.requiresOutsideHoursConfirmation && !options.confirmOutsideHours) {
        const confirmed =
          typeof window === 'undefined'
            ? true
            : window.confirm(
                `${requirements.outsideHoursMessage || 'Appuntamento fuori orario/giorno di funzionamento.'}\n\nConfermi comunque la prenotazione?`
              );
        if (!confirmed) {
          return null;
        }

        options = {
          ...options,
          confirmOutsideHours: true
        };
        continue;
      }

      if (
        requirements.requiresOverlapAdjustmentConfirmation &&
        !options.confirmOverlapAdjustments
      ) {
        const confirmed =
          typeof window === 'undefined'
            ? true
            : window.confirm(
                `${buildRequirementsMessage(outcome)}\n\nConfermi le modifiche automatiche?`
              );

        if (!confirmed) {
          return null;
        }

        options = {
          ...options,
          confirmOverlapAdjustments: true
        };
        continue;
      }

      return null;
    }
  }

  function formatAppliedAdjustments(outcome: AppuntamentoWriteOutcome): string {
    const adjustments = outcome.appliedAdjustments ?? [];
    if (adjustments.length === 0) {
      return '';
    }

    return ` Modifiche applicate: ${adjustments.length}.`;
  }

  function getInitialEndTime(dateValue: string, startTimeValue: string): string {
    const endDateTime = addMinutesToDateTime(`${dateValue}T${startTimeValue}`, standardVisitDurationMinutes);
    return endDateTime.slice(11, 16);
  }

  function formatDateTimeForToast(value: string): string {
    return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)} ${value.slice(11, 16)}`;
  }

  function applyFoundSlotToAppointmentForm(params: {
    startDateTime: string;
    endDateTime: string;
    resetForCreate: boolean;
  }): void {
    appointmentForm = {
      pazienteId: params.resetForCreate ? 0 : appointmentForm.pazienteId,
      date: params.startDateTime.slice(0, 10),
      startTime: params.startDateTime.slice(11, 16),
      endTime: params.endDateTime.slice(11, 16),
      motivo: params.resetForCreate ? '' : appointmentForm.motivo
    };
  }

  async function handleFindFirstSlot(
    mode: FirstSlotSearchMode,
    source: 'toolbar' | 'modal',
    searchNext = false
  ): Promise<void> {
    if (!ambulatorioId || searchingFirstSlotMode) {
      return;
    }

    searchingFirstSlotMode = mode;
    try {
      const fromDateTime = searchNext
        ? (mode === 'urgent'
            ? (nextUrgentSearchCursor ?? undefined)
            : (nextQuarterHourSearchCursor ?? undefined))
        : undefined;
      const result =
        mode === 'urgent'
          ? await findFirstUrgentSlot({ ambulatorioId, fromDateTime })
          : await findFirstQuarterHourSlot({ ambulatorioId, fromDateTime });

      if (!result.found || !result.startDateTime || !result.endDateTime) {
        toastStore.show(
          'info',
          result.reasonIfNotFound || 'Nessuno slot disponibile trovato entro i prossimi 180 giorni.'
        );
        return;
      }

      const normalizedStart = normalizeAppuntamentoDateTimeInput(result.startDateTime);
      const normalizedEnd = normalizeAppuntamentoDateTimeInput(result.endDateTime);
      if (mode === 'urgent') {
        nextUrgentSearchCursor = normalizedEnd;
      } else {
        nextQuarterHourSearchCursor = normalizedEnd;
      }
      const resetForCreate = source === 'toolbar';
      applyFoundSlotToAppointmentForm({
        startDateTime: normalizedStart,
        endDateTime: normalizedEnd,
        resetForCreate
      });

      if (source === 'toolbar') {
        editingAppointment = null;
        showAppointmentModal = true;
      }

      const slotLabel =
        mode === 'urgent'
          ? (searchNext ? 'Slot urgente successivo' : 'Primo slot urgente')
          : (searchNext ? 'Slot disponibile successivo' : 'Primo slot disponibile');
      toastStore.show(
        'success',
        `${slotLabel}: ${formatDateTimeForToast(normalizedStart)} - ${normalizedEnd.slice(11, 16)}`
      );

      if (mode === 'urgent' && result.requiresAdjustmentHint) {
        toastStore.show(
          'info',
          'Lo slot urgente richiederà conferma degli aggiustamenti anti-overlap al salvataggio.'
        );
      }
    } catch (error) {
      toastStore.show('error', `Errore ricerca primo slot: ${getErrorMessage(error)}`);
    } finally {
      searchingFirstSlotMode = null;
    }
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

  async function loadOperatingSettings(): Promise<void> {
    if (!ambulatorioId) {
      operatingSettings = null;
      applyCalendarOperatingSettings(null);
      return;
    }

    try {
      operatingSettings = await getAmbulatorioOperatingSettingsById(ambulatorioId);
      applyCalendarOperatingSettings(operatingSettings);
    } catch (error) {
      console.error('Errore caricamento orari ambulatorio:', error);
      toastStore.show('error', `Errore caricamento orari ambulatorio: ${getErrorMessage(error)}`);
      operatingSettings = null;
      applyCalendarOperatingSettings(null);
    }
  }

  async function initializeAmbulatorioContext(): Promise<void> {
    await Promise.all([loadPatients(), loadOperatingSettings()]);
    if (currentRangeStart && currentRangeEndExclusive) {
      await reloadAppointmentsForCurrentRange();
    }
  }

  async function reloadAppointmentsForCurrentRange(): Promise<void> {
    if (!currentRangeStart || !currentRangeEndExclusive || !ambulatorioId) {
      loading = false;
      return;
    }

    try {
      const [items, counts] = await Promise.all([
        getAppuntamentiByRange({
          ambulatorioId,
          rangeStart: currentRangeStart,
          rangeEndExclusive: currentRangeEndExclusive
        }),
        getDailyAppointmentCountsByRange({
          ambulatorioId,
          rangeStart: currentRangeStart,
          rangeEndExclusive: currentRangeEndExclusive
        })
      ]);

      appuntamenti = items;
      calendarEvents = mapAppointmentsToEvents(items);
      dailyCounts = new Map(counts.map((row) => [row.date, Number(row.total || 0)]));
      daysWithAppointments = new Set(Array.from(dailyCounts.keys()));
      syncCalendarEvents(calendarEvents);
      refreshCalendarDecorations();
    } catch (error) {
      console.error('Errore caricamento appuntamenti:', error);
      toastStore.show('error', `Errore caricamento appuntamenti: ${getErrorMessage(error)}`);
    } finally {
      loading = false;
    }
  }

  async function handleDatesSet(arg: DatesSetArg): Promise<void> {
    currentView = normalizeCalendarView(arg.view.type);
    calendarTitle = arg.view.title;
    currentRangeStart = formatDateTime(arg.start);
    currentRangeEndExclusive = formatDateTime(arg.end);
    syncJumpDateFromCalendar();
    await reloadAppointmentsForCurrentRange();
  }

  function openCreateModal(startDate: Date, endDate?: Date): void {
    const nextDate = formatDateOnly(startDate);
    const nextStartTime = formatTimeOnly(startDate);
    const nextEndTime = endDate ? formatTimeOnly(endDate) : getInitialEndTime(nextDate, nextStartTime);

    appointmentForm = {
      pazienteId: 0,
      date: nextDate,
      startTime: nextStartTime,
      endTime: nextEndTime,
      motivo: ''
    };
    editingAppointment = null;
    showAppointmentModal = true;
  }

  function openEditModal(appointment: Appuntamento): void {
    const normalizedStart = normalizeAppuntamentoDateTimeInput(appointment.data_ora_inizio);
    const normalizedEnd = normalizeAppuntamentoDateTimeInput(appointment.data_ora_fine);
    appointmentForm = {
      pazienteId: appointment.paziente_id,
      date: normalizedStart.slice(0, 10),
      startTime: normalizedStart.slice(11, 16),
      endTime: normalizedEnd.slice(11, 16),
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
    searchingFirstSlotMode = null;
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

    openCreateModal(arg.start, arg.end);
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
    const newEnd = arg.event.end;

    if (!Number.isInteger(appointmentId) || !newStart || !newEnd) {
      arg.revert();
      return;
    }

    try {
      const outcome = await executeWithConfirmations((options) =>
        updateAppuntamento(
          {
            id: appointmentId,
            data_ora_inizio: formatDateTime(newStart),
            data_ora_fine: formatDateTime(newEnd)
          },
          options
        )
      );

      if (!outcome) {
        arg.revert();
        toastStore.show('info', 'Spostamento appuntamento annullato');
        return;
      }

      if (!outcome.saved) {
        arg.revert();
        toastStore.show('error', buildRequirementsMessage(outcome));
        return;
      }

      toastStore.show('success', `Appuntamento aggiornato.${formatAppliedAdjustments(outcome)}`);
      await reloadAppointmentsForCurrentRange();
    } catch (error) {
      console.error('Errore spostamento appuntamento:', error);
      arg.revert();
      toastStore.show('error', `Impossibile spostare appuntamento: ${getErrorMessage(error)}`);
    }
  }

  async function handleEventResize(arg: any): Promise<void> {
    const appointmentId = Number.parseInt(arg.event.id, 10);
    const newStart = arg.event.start;
    const newEnd = arg.event.end;

    if (!Number.isInteger(appointmentId) || !newStart || !newEnd) {
      arg.revert();
      return;
    }

    try {
      const outcome = await executeWithConfirmations((options) =>
        updateAppuntamento(
          {
            id: appointmentId,
            data_ora_inizio: formatDateTime(newStart),
            data_ora_fine: formatDateTime(newEnd)
          },
          options
        )
      );

      if (!outcome) {
        arg.revert();
        toastStore.show('info', 'Ridimensionamento appuntamento annullato');
        return;
      }

      if (!outcome.saved) {
        arg.revert();
        toastStore.show('error', buildRequirementsMessage(outcome));
        return;
      }

      toastStore.show('success', `Appuntamento aggiornato.${formatAppliedAdjustments(outcome)}`);
      await reloadAppointmentsForCurrentRange();
    } catch (error) {
      console.error('Errore ridimensionamento appuntamento:', error);
      arg.revert();
      toastStore.show('error', `Impossibile aggiornare durata appuntamento: ${getErrorMessage(error)}`);
    }
  }

  function ensureAppointmentFormDateTime(): { startDateTime: string; endDateTime: string } {
    if (!appointmentForm.date || !appointmentForm.startTime || !appointmentForm.endTime) {
      throw new Error('Inserisci data, orario di inizio e orario di fine');
    }

    const startDateTime = `${appointmentForm.date}T${appointmentForm.startTime}`;
    const endDateTime = `${appointmentForm.date}T${appointmentForm.endTime}`;

    if (normalizeAppuntamentoDateTimeInput(endDateTime) <= normalizeAppuntamentoDateTimeInput(startDateTime)) {
      throw new Error('L’orario di fine deve essere successivo all’orario di inizio');
    }

    return {
      startDateTime,
      endDateTime
    };
  }

  async function saveAppointment(): Promise<void> {
    if (!appointmentForm.pazienteId) {
      toastStore.show('error', 'Seleziona un paziente');
      return;
    }

    let startDateTime = '';
    let endDateTime = '';

    try {
      const range = ensureAppointmentFormDateTime();
      startDateTime = range.startDateTime;
      endDateTime = range.endDateTime;
    } catch (error) {
      toastStore.show('error', getErrorMessage(error));
      return;
    }

    savingAppointment = true;

    try {
      const editing = editingAppointment;
      if (isEditing && editing) {
        const outcome = await executeWithConfirmations((options) =>
          updateAppuntamento(
            {
              id: editing.id,
              paziente_id: isFollowUpAppointment ? undefined : appointmentForm.pazienteId,
              data_ora_inizio: startDateTime,
              data_ora_fine: endDateTime,
              motivo: appointmentForm.motivo
            },
            options
          )
        );

        if (!outcome) {
          toastStore.show('info', 'Aggiornamento appuntamento annullato');
          return;
        }

        if (!outcome.saved) {
          toastStore.show('error', buildRequirementsMessage(outcome));
          return;
        }

        toastStore.show('success', `Appuntamento aggiornato.${formatAppliedAdjustments(outcome)}`);
      } else {
        const outcome = await executeWithConfirmations((options) =>
          createAppuntamentoManuale(
            {
              ambulatorio_id: ambulatorioId,
              paziente_id: appointmentForm.pazienteId,
              data_ora_inizio: startDateTime,
              data_ora_fine: endDateTime,
              motivo: appointmentForm.motivo
            },
            options
          )
        );

        if (!outcome) {
          toastStore.show('info', 'Creazione appuntamento annullata');
          return;
        }

        if (!outcome.saved) {
          toastStore.show('error', buildRequirementsMessage(outcome));
          return;
        }

        toastStore.show('success', `Appuntamento creato.${formatAppliedAdjustments(outcome)}`);
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
    height: 'auto',
    contentHeight: 'auto',
    expandRows: false,
    editable: true,
    selectable: true,
    selectMirror: false,
    eventDurationEditable: true,
    eventResizableFromStart: true,
    slotDuration: calendarSlotDuration,
    slotLabelInterval: calendarSlotDuration,
    slotLabelFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    },
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    },
    slotMinTime: calendarSlotMinTime,
    slotMaxTime: calendarSlotMaxTime,
    businessHours: calendarBusinessHours,
    headerToolbar: false,
    dayMaxEvents: true,
    dayCellClassNames,
    dayCellDidMount,
    dayHeaderDidMount,
    dayHeaderFormat: {
      weekday: 'short'
    },
    datesSet: handleDatesSet,
    dateClick: handleDateClick,
    select: handleSelect,
    eventClick: handleEventClick,
    eventDrop: handleEventDrop,
    eventResize: handleEventResize,
    views: {
      dayGridMonth: {
        fixedWeekCount: true,
        dayMaxEvents: 3,
        moreLinkContent: () => '...',
        titleFormat: {
          month: 'long',
          year: 'numeric'
        }
      },
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
    events: []
  };

  onMount(() => {
    void initializeAmbulatorioContext();
  });
</script>

<div class="appuntamenti-page">
  <PageHeader
    title="Appuntamenti"
    subtitle="Gestisci il calendario appuntamenti (mese e giorno)"
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
      <div class="toolbar-title-nav">
        <button type="button" class="btn-nav-arrow" on:click={navigatePrev} aria-label="Periodo precedente">
          <Icon name="chevron-left" size={18} />
        </button>
        <div class="toolbar-title">{calendarTitle || 'Calendario'}</div>
        <button type="button" class="btn-secondary btn-today-inline" on:click={navigateToday}>Oggi</button>
        <button type="button" class="btn-nav-arrow" on:click={navigateNext} aria-label="Periodo successivo">
          <Icon name="chevron-right" size={18} />
        </button>
      </div>

      <div class="toolbar-controls">
        <div class="toolbar-slot-actions">
          <button
            type="button"
            class="btn-secondary"
            on:click={() => handleFindFirstSlot('urgent', 'toolbar')}
            disabled={Boolean(searchingFirstSlotMode) || !ambulatorioId}
          >
            {searchingFirstSlotMode === 'urgent' ? 'Ricerca urgente...' : 'Primo slot urgente'}
          </button>
          <button
            type="button"
            class="btn-secondary"
            on:click={() => handleFindFirstSlot('quarter_hour', 'toolbar')}
            disabled={Boolean(searchingFirstSlotMode) || !ambulatorioId}
          >
            {searchingFirstSlotMode === 'quarter_hour'
              ? 'Ricerca disponibile...'
              : 'Primo slot disponibile'}
          </button>
        </div>

        <div class="view-toggle" role="group" aria-label="Seleziona visualizzazione calendario">
          <button
            type="button"
            class="toggle-btn"
            class:active={currentView === 'dayGridMonth'}
            on:click={() => changeView('dayGridMonth')}
          >
            Mese
          </button>
          <button
            type="button"
            class="toggle-btn"
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
      <span class="legend-note">Vista corrente: {viewLabels[currentView]} - Visite giorno selezionato: {currentDayCount}</span>
    </div>
  </Card>
</div>

<Modal bind:open={showAppointmentModal} title={modalTitle} size="md" closeOnBackdropClick={false}>
  <div class="modal-form">
    <div class="slot-search-actions">
      <button
        type="button"
        class="btn-secondary"
        on:click={() => handleFindFirstSlot('urgent', 'modal')}
        disabled={Boolean(searchingFirstSlotMode) || savingAppointment || deletingAppointment || !ambulatorioId}
      >
        {searchingFirstSlotMode === 'urgent' ? 'Ricerca urgente...' : 'Primo slot urgente'}
      </button>
      <button
        type="button"
        class="btn-secondary"
        on:click={() => handleFindFirstSlot('urgent', 'modal', true)}
        disabled={Boolean(searchingFirstSlotMode) || savingAppointment || deletingAppointment || !ambulatorioId || !nextUrgentSearchCursor}
      >
        Urgente successivo
      </button>
      <button
        type="button"
        class="btn-secondary"
        on:click={() => handleFindFirstSlot('quarter_hour', 'modal')}
        disabled={Boolean(searchingFirstSlotMode) || savingAppointment || deletingAppointment || !ambulatorioId}
      >
        {searchingFirstSlotMode === 'quarter_hour'
          ? 'Ricerca disponibile...'
          : 'Primo slot disponibile'}
      </button>
      <button
        type="button"
        class="btn-secondary"
        on:click={() => handleFindFirstSlot('quarter_hour', 'modal', true)}
        disabled={Boolean(searchingFirstSlotMode) || savingAppointment || deletingAppointment || !ambulatorioId || !nextQuarterHourSearchCursor}
      >
        Disponibile successivo
      </button>
    </div>

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
        <label for="appointment_start_time">Ora inizio *</label>
        <input id="appointment_start_time" type="time" step="300" bind:value={appointmentForm.startTime} />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="appointment_end_time">Ora fine *</label>
        <input id="appointment_end_time" type="time" step="300" bind:value={appointmentForm.endTime} />
      </div>
      <div class="form-group">
        <label for="appointment_reason">Motivo</label>
        <input id="appointment_reason" type="text" bind:value={appointmentForm.motivo} />
      </div>
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

  :global(.fc .fc-day-non-working) {
    background: color-mix(in srgb, var(--color-bg-secondary) 60%, transparent);
  }

  :global(.fc .fc-daygrid-day-top) {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  /* In vista mese le celle restano ad altezza fissa anche con più appuntamenti */
  :global(.calendar-wrapper .fc .fc-daygrid-day-frame) {
    min-height: 118px;
    max-height: 118px;
  }

  :global(.fc .day-count-badge) {
    min-width: 18px;
    height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-primary) 82%, #ffffff);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  :global(.fc .fc-col-header-cell-cushion) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  :global(.fc .fc-day-count-pill) {
    min-width: 18px;
    height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-primary) 82%, #ffffff);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  :global(.calendar-wrapper .fc .fc-dayGridMonth-view .fc-daygrid-more-link) {
    position: relative;
    top: -2px;
    font-size: calc(var(--text-sm) + 1px);
    font-weight: 800;
    line-height: 1;
  }

  :global(.fc .calendar-event) {
    border-radius: var(--radius-sm);
    padding: 2px 4px;
    font-size: var(--text-xs);
  }

  /* Vista settimana/giorno: slot un po' più alti per leggibilità */
  :global(.calendar-wrapper .fc .fc-timegrid-slot) {
    height: 2.2rem;
  }

  /* Vista settimana/giorno: box compatto, testo su una sola riga e centrato verticalmente */
  :global(.calendar-wrapper .fc .fc-timeGridWeek-view .calendar-event),
  :global(.calendar-wrapper .fc .fc-timeGridDay-view .calendar-event) {
    padding: 1px 3px;
    line-height: 1.2;
    text-align: left;
  }

  :global(.calendar-wrapper .fc .fc-timeGridWeek-view .calendar-event .fc-event-main),
  :global(.calendar-wrapper .fc .fc-timeGridDay-view .calendar-event .fc-event-main) {
    padding: 0;
  }

  :global(.calendar-wrapper .fc .fc-timeGridWeek-view .calendar-event .fc-event-main-frame),
  :global(.calendar-wrapper .fc .fc-timeGridDay-view .calendar-event .fc-event-main-frame) {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    height: 100%;
    min-width: 0;
    white-space: nowrap;
    text-align: left;
  }

  /* Anche gli eventi con durata breve restano su una sola riga e a sinistra */
  :global(.calendar-wrapper .fc .fc-timeGridWeek-view .calendar-event.fc-timegrid-event-short .fc-event-main-frame),
  :global(.calendar-wrapper .fc .fc-timeGridDay-view .calendar-event.fc-timegrid-event-short .fc-event-main-frame) {
    flex-direction: row !important;
    align-items: center;
    justify-content: flex-start;
    overflow: hidden;
    white-space: nowrap;
  }

  :global(.calendar-wrapper .fc .fc-timeGridWeek-view .calendar-event .fc-event-time),
  :global(.calendar-wrapper .fc .fc-timeGridDay-view .calendar-event .fc-event-time) {
    flex: 0 0 auto;
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.2;
    text-align: left;
  }

  :global(.calendar-wrapper .fc .fc-timeGridWeek-view .calendar-event .fc-event-title-container),
  :global(.calendar-wrapper .fc .fc-timeGridDay-view .calendar-event .fc-event-title-container) {
    flex: 1 1 auto;
    min-width: 0;
  }

  :global(.calendar-wrapper .fc .fc-timeGridWeek-view .calendar-event .fc-event-title),
  :global(.calendar-wrapper .fc .fc-timeGridDay-view .calendar-event .fc-event-title) {
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.2;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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

  .toolbar-title-nav,
  .toolbar-controls,
  .toolbar-jump,
  .toolbar-slot-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .toolbar-controls {
    margin-left: auto;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .toolbar-slot-actions {
    flex-wrap: wrap;
  }

  .toolbar-title {
    font-size: var(--text-lg);
    font-weight: 700;
    color: var(--color-text);
    text-transform: capitalize;
  }

  .btn-nav-arrow {
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-primary);
    color: var(--color-text);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-nav-arrow:hover:not(:disabled) {
    background: var(--color-bg-secondary);
    border-color: var(--color-text-tertiary);
  }

  .btn-nav-arrow:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-today-inline {
    height: 34px;
    padding: 0 var(--space-4);
  }

  .view-toggle {
    display: inline-flex;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--color-bg-primary);
  }

  .toggle-btn {
    border: 0;
    border-right: 1px solid var(--color-border);
    border-radius: 0;
    padding: 8px 12px;
    background: transparent;
    color: var(--color-text);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .toggle-btn:last-child {
    border-right: 0;
  }

  .toggle-btn:hover:not(.active):not(:disabled) {
    background: var(--color-bg-secondary);
  }

  .toggle-btn.active {
    background: var(--color-primary);
    color: #fff;
  }

  .toolbar-jump input {
    min-width: 170px;
    height: 34px;
    padding: var(--space-1) var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg);
    font-family: var(--font-sans);
    font-size: var(--text-base);
    color: var(--color-text);
    transition: all var(--transition-fast);
    box-sizing: border-box;
  }

  .toolbar-jump input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
  }

  .toolbar-jump input:disabled {
    background-color: var(--color-bg-secondary);
    cursor: not-allowed;
    opacity: 0.6;
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
    overflow-y: visible;
  }

  :global(.calendar-wrapper .fc .fc-scroller) {
    overflow-y: auto !important;
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

  .slot-search-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .form-group label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  .form-group input,
  .form-group select {
    width: 100%;
    height: 34px;
    padding: var(--space-1) var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg);
    font-size: var(--text-base);
    font-family: var(--font-sans);
    color: var(--color-text);
    transition: all var(--transition-fast);
    box-sizing: border-box;
  }

  .form-group select {
    cursor: pointer;
    appearance: none;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
  }

  .form-group input:disabled,
  .form-group select:disabled {
    background-color: var(--color-bg-secondary);
    cursor: not-allowed;
    opacity: 0.6;
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

    :global(.calendar-wrapper .fc .fc-daygrid-day-frame) {
      min-height: 96px;
      max-height: 96px;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .toolbar-controls {
      margin-left: 0;
      width: 100%;
      justify-content: space-between;
    }

    .legend-note {
      width: 100%;
      margin-left: 0;
    }
  }
</style>

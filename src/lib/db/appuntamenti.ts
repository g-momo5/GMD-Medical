import { insertReturningId } from './client';
import { initDatabase } from './schema';
import type {
  Appuntamento,
  AppuntamentoSlotDisponibilita,
  CreateAppuntamentoManualeInput,
  SlotAvailabilityCheck,
  UpdateAppuntamentoInput
} from './types';

const SLOT_DURATION_MINUTES = 30;
const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 20;

function normalizeIntegerForWrite(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isInteger(normalized)) {
    throw new Error(`Valore intero non valido: ${value}`);
  }

  return normalized;
}

function normalizeTextForWrite(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function normalizeDateOnly(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Data non valida: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`Data non valida: ${value}`);
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeDateTime(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    throw new Error(`Data/ora non valida: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const date = new Date(year, month - 1, day, hour, minute);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    throw new Error(`Data/ora non valida: ${value}`);
  }

  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`;
}

function formatDateTime(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function formatDateOnly(date: Date): string {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addMinutes(dateTime: string, minutes: number): string {
  const normalized = normalizeDateTime(dateTime);
  const date = new Date(normalized);
  date.setMinutes(date.getMinutes() + minutes);
  return formatDateTime(date);
}

function getDayBounds(day: string): { start: string; endExclusive: string } {
  const normalizedDay = normalizeDateOnly(day);
  const start = `${normalizedDay}T00:00`;
  const nextDate = new Date(`${normalizedDay}T00:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  return {
    start,
    endExclusive: `${formatDateOnly(nextDate)}T00:00`
  };
}

function normalizeDurationForWrite(value: number | undefined): number {
  const duration = value ?? SLOT_DURATION_MINUTES;
  if (!Number.isInteger(duration) || duration <= 0) {
    throw new Error(`Durata appuntamento non valida: ${value}`);
  }

  if (duration !== SLOT_DURATION_MINUTES) {
    throw new Error(`Durata appuntamento non supportata: ${duration} minuti`);
  }

  return duration;
}

function isSlotInsideWorkingHours(dateTime: string): boolean {
  const normalized = normalizeDateTime(dateTime);
  const hour = Number(normalized.slice(11, 13));
  const minute = Number(normalized.slice(14, 16));

  if (minute % SLOT_DURATION_MINUTES !== 0) {
    return false;
  }

  if (hour < SLOT_START_HOUR) {
    return false;
  }

  if (hour > SLOT_END_HOUR) {
    return false;
  }

  if (hour === SLOT_END_HOUR && minute > 0) {
    return false;
  }

  if (hour === SLOT_END_HOUR && minute === 0) {
    return false;
  }

  return true;
}

function buildSlotsForDay(day: string): Array<{ time: string; dateTime: string }> {
  const normalizedDay = normalizeDateOnly(day);
  const slots: Array<{ time: string; dateTime: string }> = [];
  const current = new Date(`${normalizedDay}T00:00`);
  current.setHours(SLOT_START_HOUR, 0, 0, 0);
  const end = new Date(`${normalizedDay}T00:00`);
  end.setHours(SLOT_END_HOUR, 0, 0, 0);

  while (current < end) {
    const hh = String(current.getHours()).padStart(2, '0');
    const mm = String(current.getMinutes()).padStart(2, '0');
    const time = `${hh}:${mm}`;
    slots.push({
      time,
      dateTime: `${normalizedDay}T${time}`
    });
    current.setMinutes(current.getMinutes() + SLOT_DURATION_MINUTES);
  }

  return slots;
}

async function findConflictBySlot(params: {
  ambulatorioId: number;
  dataOraInizio: string;
  excludeAppuntamentoId?: number;
}): Promise<Appuntamento | null> {
  const db = await initDatabase();
  const queryParams: unknown[] = [
    normalizeIntegerForWrite(params.ambulatorioId),
    normalizeDateTime(params.dataOraInizio)
  ];

  let sql = `
    SELECT
      a.*,
      p.nome AS paziente_nome,
      p.cognome AS paziente_cognome,
      p.codice_fiscale AS paziente_codice_fiscale
    FROM appuntamenti a
    INNER JOIN pazienti p ON p.id = a.paziente_id
    WHERE a.ambulatorio_id = ?
      AND a.data_ora_inizio = ?
  `;

  if (params.excludeAppuntamentoId !== undefined) {
    queryParams.push(normalizeIntegerForWrite(params.excludeAppuntamentoId));
    sql += ' AND a.id <> ?';
  }

  sql += ' LIMIT 1';
  const rows = await db.select<Appuntamento[]>(sql, queryParams);
  return rows[0] ?? null;
}

function formatSlotConflictMessage(dateTime: string, suggestions: string[]): string {
  const normalized = normalizeDateTime(dateTime);
  const datePart = normalized.slice(0, 10);
  const timePart = normalized.slice(11, 16);
  const suggestionsText =
    suggestions.length > 0 ? ` Slot liberi: ${suggestions.join(', ')}.` : '';
  return `Lo slot ${datePart} ${timePart} non è disponibile.${suggestionsText}`;
}

async function throwIfSlotNotAvailable(params: {
  ambulatorioId: number;
  dataOraInizio: string;
  excludeAppuntamentoId?: number;
}): Promise<void> {
  const check = await checkAppuntamentoSlotAvailability({
    ambulatorioId: params.ambulatorioId,
    dataOraInizio: params.dataOraInizio,
    excludeAppuntamentoId: params.excludeAppuntamentoId
  });

  if (!check.available) {
    throw new Error(formatSlotConflictMessage(params.dataOraInizio, check.suggestedTimes));
  }
}

export async function getAppuntamentoById(id: number): Promise<Appuntamento | null> {
  const db = await initDatabase();
  const rows = await db.select<Appuntamento[]>(
    `SELECT
      a.*,
      p.nome AS paziente_nome,
      p.cognome AS paziente_cognome,
      p.codice_fiscale AS paziente_codice_fiscale
    FROM appuntamenti a
    INNER JOIN pazienti p ON p.id = a.paziente_id
    WHERE a.id = ?`,
    [normalizeIntegerForWrite(id)]
  );

  return rows[0] ?? null;
}

export async function getAppuntamentoBySourceVisitaId(visitaId: number): Promise<Appuntamento | null> {
  const db = await initDatabase();
  const rows = await db.select<Appuntamento[]>(
    `SELECT
      a.*,
      p.nome AS paziente_nome,
      p.cognome AS paziente_cognome,
      p.codice_fiscale AS paziente_codice_fiscale
    FROM appuntamenti a
    INNER JOIN pazienti p ON p.id = a.paziente_id
    WHERE a.source_visita_id = ?
    LIMIT 1`,
    [normalizeIntegerForWrite(visitaId)]
  );

  return rows[0] ?? null;
}

export async function getAppuntamentiByRange(params: {
  ambulatorioId: number;
  rangeStart: string;
  rangeEndExclusive: string;
}): Promise<Appuntamento[]> {
  const db = await initDatabase();

  return db.select<Appuntamento[]>(
    `SELECT
      a.*,
      p.nome AS paziente_nome,
      p.cognome AS paziente_cognome,
      p.codice_fiscale AS paziente_codice_fiscale
    FROM appuntamenti a
    INNER JOIN pazienti p ON p.id = a.paziente_id
    WHERE a.ambulatorio_id = ?
      AND a.data_ora_inizio >= ?
      AND a.data_ora_inizio < ?
    ORDER BY a.data_ora_inizio ASC`,
    [
      normalizeIntegerForWrite(params.ambulatorioId),
      normalizeDateTime(params.rangeStart),
      normalizeDateTime(params.rangeEndExclusive)
    ]
  );
}

export async function getAppuntamentiByDay(params: {
  ambulatorioId: number;
  day: string;
}): Promise<Appuntamento[]> {
  const bounds = getDayBounds(params.day);
  return getAppuntamentiByRange({
    ambulatorioId: params.ambulatorioId,
    rangeStart: bounds.start,
    rangeEndExclusive: bounds.endExclusive
  });
}

export async function getSlotDisponibilitaByDay(params: {
  ambulatorioId: number;
  day: string;
  excludeAppuntamentoId?: number;
}): Promise<AppuntamentoSlotDisponibilita[]> {
  const normalizedDay = normalizeDateOnly(params.day);
  const appointments = await getAppuntamentiByDay({
    ambulatorioId: params.ambulatorioId,
    day: normalizedDay
  });

  const occupiedByDateTime = new Map<string, Appuntamento>();
  for (const appointment of appointments) {
    if (
      params.excludeAppuntamentoId !== undefined &&
      appointment.id === params.excludeAppuntamentoId
    ) {
      continue;
    }

    occupiedByDateTime.set(normalizeDateTime(appointment.data_ora_inizio), appointment);
  }

  return buildSlotsForDay(normalizedDay).map((slot) => {
    const occupiedAppointment = occupiedByDateTime.get(slot.dateTime) ?? null;
    return {
      date: normalizedDay,
      time: slot.time,
      dateTime: slot.dateTime,
      available: occupiedAppointment === null,
      appuntamento: occupiedAppointment
    };
  });
}

export async function checkAppuntamentoSlotAvailability(params: {
  ambulatorioId: number;
  dataOraInizio: string;
  excludeAppuntamentoId?: number;
}): Promise<SlotAvailabilityCheck> {
  const normalizedDateTime = normalizeDateTime(params.dataOraInizio);
  const day = normalizedDateTime.slice(0, 10);
  const slotList = await getSlotDisponibilitaByDay({
    ambulatorioId: params.ambulatorioId,
    day,
    excludeAppuntamentoId: params.excludeAppuntamentoId
  });

  const suggestions = slotList.filter((slot) => slot.available).map((slot) => slot.time);
  const slot = slotList.find((entry) => entry.dateTime === normalizedDateTime);

  if (!isSlotInsideWorkingHours(normalizedDateTime) || !slot) {
    return {
      available: false,
      conflict: null,
      suggestedTimes: suggestions
    };
  }

  if (!slot.available) {
    return {
      available: false,
      conflict: slot.appuntamento,
      suggestedTimes: suggestions
    };
  }

  return {
    available: true,
    conflict: null,
    suggestedTimes: suggestions
  };
}

export async function createAppuntamentoManuale(input: CreateAppuntamentoManualeInput): Promise<number> {
  await throwIfSlotNotAvailable({
    ambulatorioId: input.ambulatorio_id,
    dataOraInizio: input.data_ora_inizio
  });

  await initDatabase();
  return insertReturningId(
    `INSERT INTO appuntamenti (
      ambulatorio_id,
      paziente_id,
      data_ora_inizio,
      durata_minuti,
      motivo,
      origine,
      source_visita_id
    ) VALUES (?, ?, ?, ?, ?, 'manuale', NULL)`,
    [
      normalizeIntegerForWrite(input.ambulatorio_id),
      normalizeIntegerForWrite(input.paziente_id),
      normalizeDateTime(input.data_ora_inizio),
      normalizeDurationForWrite(input.durata_minuti),
      normalizeTextForWrite(input.motivo)
    ]
  );
}

export async function updateAppuntamento(input: UpdateAppuntamentoInput): Promise<void> {
  const existing = await getAppuntamentoById(input.id);
  if (!existing) {
    throw new Error(`Appuntamento ${input.id} non trovato`);
  }

  const nextPazienteId =
    input.paziente_id !== undefined
      ? normalizeIntegerForWrite(input.paziente_id)
      : normalizeIntegerForWrite(existing.paziente_id);
  const nextDataOra =
    input.data_ora_inizio !== undefined
      ? normalizeDateTime(input.data_ora_inizio)
      : normalizeDateTime(existing.data_ora_inizio);
  const nextDurata =
    input.durata_minuti !== undefined
      ? normalizeDurationForWrite(input.durata_minuti)
      : normalizeDurationForWrite(existing.durata_minuti);
  const nextMotivo =
    input.motivo !== undefined ? normalizeTextForWrite(input.motivo) : normalizeTextForWrite(existing.motivo);

  await throwIfSlotNotAvailable({
    ambulatorioId: existing.ambulatorio_id,
    dataOraInizio: nextDataOra,
    excludeAppuntamentoId: existing.id
  });

  const db = await initDatabase();
  await db.execute(
    `UPDATE appuntamenti
     SET
       paziente_id = ?,
       data_ora_inizio = ?,
       durata_minuti = ?,
       motivo = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [nextPazienteId, nextDataOra, nextDurata, nextMotivo, normalizeIntegerForWrite(input.id)]
  );
}

export async function deleteAppuntamento(id: number): Promise<void> {
  const db = await initDatabase();
  await db.execute('DELETE FROM appuntamenti WHERE id = ?', [normalizeIntegerForWrite(id)]);
}

export async function createFollowUpAppuntamentoFromVisita(params: {
  visitaId: number;
  ambulatorioId: number;
  pazienteId: number;
  dataOraInizio: string;
  motivo?: string;
}): Promise<number | null> {
  const existing = await getAppuntamentoBySourceVisitaId(params.visitaId);
  if (existing) {
    return existing.id;
  }

  await throwIfSlotNotAvailable({
    ambulatorioId: params.ambulatorioId,
    dataOraInizio: params.dataOraInizio
  });

  await initDatabase();
  return insertReturningId(
    `INSERT INTO appuntamenti (
      ambulatorio_id,
      paziente_id,
      data_ora_inizio,
      durata_minuti,
      motivo,
      origine,
      source_visita_id
    ) VALUES (?, ?, ?, ?, ?, 'followup_visita', ?)`,
    [
      normalizeIntegerForWrite(params.ambulatorioId),
      normalizeIntegerForWrite(params.pazienteId),
      normalizeDateTime(params.dataOraInizio),
      SLOT_DURATION_MINUTES,
      normalizeTextForWrite(params.motivo),
      normalizeIntegerForWrite(params.visitaId)
    ]
  );
}

export function normalizeAppuntamentoDateTimeInput(value: string): string {
  return normalizeDateTime(value);
}

export function getDefaultSlotConfiguration(): {
  startHour: number;
  endHour: number;
  durationMinutes: number;
} {
  return {
    startHour: SLOT_START_HOUR,
    endHour: SLOT_END_HOUR,
    durationMinutes: SLOT_DURATION_MINUTES
  };
}

export function getAppuntamentoEndDateTime(startDateTime: string, durationMinutes = SLOT_DURATION_MINUTES): string {
  return addMinutes(startDateTime, durationMinutes);
}

export function parseFollowUpScheduling(raw: string | null | undefined): {
  dataOraProssimaVisita: string;
  motivoProssimaVisita: string;
} | null {
  if (!raw || !raw.trim()) {
    return null;
  }

  let parsed: { dataOraProssimaVisita?: unknown; motivoProssimaVisita?: unknown };
  try {
    parsed = JSON.parse(raw) as { dataOraProssimaVisita?: unknown; motivoProssimaVisita?: unknown };
  } catch {
    return null;
  }

  if (typeof parsed.dataOraProssimaVisita !== 'string' || !parsed.dataOraProssimaVisita.trim()) {
    return null;
  }

  let normalizedDateTime: string;
  try {
    normalizedDateTime = normalizeDateTime(parsed.dataOraProssimaVisita);
  } catch {
    return null;
  }

  return {
    dataOraProssimaVisita: normalizedDateTime,
    motivoProssimaVisita:
      typeof parsed.motivoProssimaVisita === 'string' ? parsed.motivoProssimaVisita.trim() : ''
  };
}

export async function getSlotConflictByDateTime(params: {
  ambulatorioId: number;
  dataOraInizio: string;
  excludeAppuntamentoId?: number;
}): Promise<Appuntamento | null> {
  return findConflictBySlot(params);
}

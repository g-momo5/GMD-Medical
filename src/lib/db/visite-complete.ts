import type {
  CreateFattoriRischioCVInput,
  CreateVisitaInput,
  UpdateFattoriRischioCVInput,
  UpdateVisitaInput
} from './types';
import {
  createFattoriRischioCV,
  getFattoriRischioCVByVisitaId,
  updateFattoriRischioCV
} from './fattori-rischio-cv';
import {
  checkAppuntamentoSlotAvailability,
  createFollowUpAppuntamentoFromVisita,
  getAppuntamentoBySourceVisitaId,
  parseFollowUpScheduling
} from './appuntamenti';
import { createVisita, getVisitaById, updateVisita } from './visite';

type FattoriRischioPayload = Partial<Omit<CreateFattoriRischioCVInput, 'visita_id'>>;

function hasMeaningfulFattoriRischioCV(input: FattoriRischioPayload): boolean {
  return (
    Boolean(input.familiarita) ||
    Boolean(input.ipertensione) ||
    Boolean(input.diabete) ||
    Boolean(input.dislipidemia) ||
    Boolean(input.obesita) ||
    Boolean(input.familiarita_note?.trim()) ||
    Boolean(input.diabete_durata?.trim()) ||
    Boolean(input.diabete_tipo?.trim()) ||
    Boolean(input.fumo?.trim()) ||
    Boolean(input.fumo_ex_eta?.trim())
  );
}

function buildFollowUpSlotErrorMessage(
  dataOraProssimaVisita: string,
  suggestedTimes: string[]
): string {
  const datePart = dataOraProssimaVisita.slice(0, 10);
  const timePart = dataOraProssimaVisita.slice(11, 16);
  const suggestionsText =
    suggestedTimes.length > 0 ? ` Slot disponibili: ${suggestedTimes.join(', ')}.` : '';
  return `Lo slot della prossima visita (${datePart} ${timePart}) non è disponibile.${suggestionsText}`;
}

async function validateFollowUpSlot(params: {
  ambulatorioId: number;
  dataOraProssimaVisita: string;
}): Promise<void> {
  const availability = await checkAppuntamentoSlotAvailability({
    ambulatorioId: params.ambulatorioId,
    dataOraInizio: params.dataOraProssimaVisita
  });

  if (!availability.available) {
    throw new Error(
      buildFollowUpSlotErrorMessage(params.dataOraProssimaVisita, availability.suggestedTimes)
    );
  }
}

export async function createVisitaCompleta(input: {
  visita: CreateVisitaInput;
  fattoriRischioCV: Omit<CreateFattoriRischioCVInput, 'visita_id'>;
}): Promise<number> {
  const followUpScheduling = parseFollowUpScheduling(input.visita.pianificazione_followup);
  if (followUpScheduling) {
    await validateFollowUpSlot({
      ambulatorioId: input.visita.ambulatorio_id,
      dataOraProssimaVisita: followUpScheduling.dataOraProssimaVisita
    });
  }

  const visitaId = await createVisita(input.visita);

  if (hasMeaningfulFattoriRischioCV(input.fattoriRischioCV)) {
    await createFattoriRischioCV({
      ...input.fattoriRischioCV,
      visita_id: visitaId
    });
  }

  if (followUpScheduling) {
    await createFollowUpAppuntamentoFromVisita({
      visitaId,
      ambulatorioId: input.visita.ambulatorio_id,
      pazienteId: input.visita.paziente_id,
      dataOraInizio: followUpScheduling.dataOraProssimaVisita,
      motivo: followUpScheduling.motivoProssimaVisita
    });
  }

  return visitaId;
}

export async function updateVisitaCompleta(input: {
  visita: UpdateVisitaInput;
  fattoriRischioCV: Omit<UpdateFattoriRischioCVInput, 'id'>;
}): Promise<void> {
  const visitaId = input.fattoriRischioCV.visita_id ?? input.visita.id;
  if (!visitaId) {
    throw new Error('visita_id richiesto per aggiornare i fattori di rischio');
  }

  let pendingFollowUpCreation:
    | {
        ambulatorioId: number;
        pazienteId: number;
        dataOraInizio: string;
        motivo: string;
      }
    | null = null;

  const followUpScheduling = parseFollowUpScheduling(input.visita.pianificazione_followup);
  if (followUpScheduling) {
    const existingSourceAppointment = await getAppuntamentoBySourceVisitaId(visitaId);
    if (!existingSourceAppointment) {
      const visita = await getVisitaById(visitaId);
      if (!visita) {
        throw new Error(`Visita ${visitaId} non trovata per sincronizzare la prossima visita`);
      }

      const ambulatorioId = input.visita.ambulatorio_id ?? visita.ambulatorio_id;
      const pazienteId = input.visita.paziente_id ?? visita.paziente_id;

      await validateFollowUpSlot({
        ambulatorioId,
        dataOraProssimaVisita: followUpScheduling.dataOraProssimaVisita
      });

      pendingFollowUpCreation = {
        ambulatorioId,
        pazienteId,
        dataOraInizio: followUpScheduling.dataOraProssimaVisita,
        motivo: followUpScheduling.motivoProssimaVisita
      };
    }
  }

  await updateVisita(input.visita);

  const hasMeaningfulData = hasMeaningfulFattoriRischioCV(input.fattoriRischioCV);
  const existingRecord = await getFattoriRischioCVByVisitaId(visitaId);

  if (existingRecord) {
    await updateFattoriRischioCV({
      id: existingRecord.id,
      ...input.fattoriRischioCV,
      visita_id: visitaId
    });
  } else if (hasMeaningfulData) {
    await createFattoriRischioCV({
      visita_id: visitaId,
      familiarita: Boolean(input.fattoriRischioCV.familiarita),
      familiarita_note: input.fattoriRischioCV.familiarita_note,
      ipertensione: Boolean(input.fattoriRischioCV.ipertensione),
      diabete: Boolean(input.fattoriRischioCV.diabete),
      diabete_durata: input.fattoriRischioCV.diabete_durata,
      diabete_tipo: input.fattoriRischioCV.diabete_tipo,
      dislipidemia: Boolean(input.fattoriRischioCV.dislipidemia),
      obesita: Boolean(input.fattoriRischioCV.obesita),
      fumo: input.fattoriRischioCV.fumo || '',
      fumo_ex_eta: input.fattoriRischioCV.fumo_ex_eta
    });
  }

  if (!pendingFollowUpCreation) {
    return;
  }

  await createFollowUpAppuntamentoFromVisita({
    visitaId,
    ambulatorioId: pendingFollowUpCreation.ambulatorioId,
    pazienteId: pendingFollowUpCreation.pazienteId,
    dataOraInizio: pendingFollowUpCreation.dataOraInizio,
    motivo: pendingFollowUpCreation.motivo
  });
}

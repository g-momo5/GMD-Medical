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
import { createVisita, updateVisita } from './visite';

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

export async function createVisitaCompleta(input: {
  visita: CreateVisitaInput;
  fattoriRischioCV: Omit<CreateFattoriRischioCVInput, 'visita_id'>;
}): Promise<number> {
  const visitaId = await createVisita(input.visita);

  if (hasMeaningfulFattoriRischioCV(input.fattoriRischioCV)) {
    await createFattoriRischioCV({
      ...input.fattoriRischioCV,
      visita_id: visitaId
    });
  }

  return visitaId;
}

export async function updateVisitaCompleta(input: {
  visita: UpdateVisitaInput;
  fattoriRischioCV: Omit<UpdateFattoriRischioCVInput, 'id'>;
}): Promise<void> {
  await updateVisita(input.visita);

  const visitaId = input.fattoriRischioCV.visita_id ?? input.visita.id;
  if (!visitaId) {
    throw new Error('visita_id richiesto per aggiornare i fattori di rischio');
  }

  const hasMeaningfulData = hasMeaningfulFattoriRischioCV(input.fattoriRischioCV);
  const existingRecord = await getFattoriRischioCVByVisitaId(visitaId);

  if (existingRecord) {
    await updateFattoriRischioCV({
      id: existingRecord.id,
      ...input.fattoriRischioCV,
      visita_id: visitaId
    });
    return;
  }

  if (!hasMeaningfulData) {
    return;
  }

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

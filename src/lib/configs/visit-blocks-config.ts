// Configurazione dei blocchi per ogni ambulatorio

export interface VisitBlockConfig {
  id: string;
  component: string;
  allAmbulatori?: boolean;
  ambulatori: number[]; // IDs degli ambulatori che possono vedere questo blocco
}

export const visitBlocksConfig: VisitBlockConfig[] = [
  {
    id: 'fattori-rischio-cv',
    component: 'FattoriRischioCV',
    allAmbulatori: true,
    ambulatori: []
  },
  {
    id: 'fh-assessment',
    component: 'IpercolesterolemiaFamiliareFH',
    allAmbulatori: true,
    ambulatori: []
  },
  {
    id: 'terapia-ipolipemizzante',
    component: 'TerapiaIpolipemizzante',
    allAmbulatori: true,
    ambulatori: []
  },
  {
    id: 'anamnesi-cardiologica',
    component: 'AnamnesiCardiologica',
    ambulatori: [1] // Solo Ambulatorio Dislipidemie (ID 1)
  },
  {
    id: 'terapia-domiciliare',
    component: 'TerapiaDomiciliare',
    ambulatori: [1] // Solo Ambulatorio Dislipidemie (ID 1)
  },
  {
    id: 'valutazione-odierna',
    component: 'ValutazioneOdierna',
    ambulatori: [1] // Solo Ambulatorio Dislipidemie (ID 1)
  },
  {
    id: 'esami-ematici',
    component: 'EsamiEmatici',
    allAmbulatori: true,
    ambulatori: []
  },
  {
    id: 'valutazione-rischio-cv',
    component: 'ValutazioneRischioCardiovascolare',
    allAmbulatori: true,
    ambulatori: []
  },
  {
    id: 'ecocardiografia',
    component: 'Ecocardiografia',
    ambulatori: [1] // Solo Ambulatorio Dislipidemie (ID 1)
  },
  {
    id: 'firme-visita',
    component: 'FirmeVisita',
    allAmbulatori: true,
    ambulatori: []
  }
  // Altri blocchi verranno aggiunti qui
];

/**
 * Verifica se un blocco è visibile per un dato ambulatorio
 */
export function isBlockVisibleForAmbulatorio(
  blockId: string,
  ambulatorioId: number
): boolean {
  const block = visitBlocksConfig.find((b) => b.id === blockId);
  if (!block) return false;
  if (block.allAmbulatori) return true;
  return block.ambulatori.includes(ambulatorioId);
}

/**
 * Ottiene tutti i blocchi visibili per un ambulatorio
 */
export function getVisibleBlocksForAmbulatorio(ambulatorioId: number): string[] {
  return visitBlocksConfig
    .filter((block) => block.allAmbulatori || block.ambulatori.includes(ambulatorioId))
    .map((block) => block.id);
}

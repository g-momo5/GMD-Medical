<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth';
  import { sidebarCollapsedStore } from '$lib/stores/sidebar';
  import { toastStore } from '$lib/stores/toast';
  import { getAllPazienti } from '$lib/db/pazienti';
  import { getFattoriRischioCVByVisitaId } from '$lib/db/fattori-rischio-cv';
  import { checkAppuntamentoSlotAvailability } from '$lib/db/appuntamenti';
  import { getPreviousEsamiEmaticiByPaziente, getVisiteByPaziente } from '$lib/db/visite';
  import { createVisitaCompleta } from '$lib/db/visite-complete';
  import type { DiabeteTipo, Paziente, PreviousEsamiEmaticiMap, Visita } from '$lib/db/types';
  import Card from '$lib/components/Card.svelte';
  import Input from '$lib/components/Input.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import PazienteFormModal from '$lib/components/PazienteFormModal.svelte';
  import FattoriRischioCV from '$lib/components/visit-blocks/FattoriRischioCV.svelte';
  import IpercolesterolemiaFamiliareFH from '$lib/components/visit-blocks/IpercolesterolemiaFamiliareFH.svelte';
  import AnamnesiCardiologica from '$lib/components/visit-blocks/AnamnesiCardiologica.svelte';
  import TerapiaIpolipemizzante from '$lib/components/visit-blocks/TerapiaIpolipemizzante.svelte';
  import TerapiaDomiciliare from '$lib/components/visit-blocks/TerapiaDomiciliare.svelte';
  import ValutazioneOdierna from '$lib/components/visit-blocks/ValutazioneOdierna.svelte';
  import EsamiEmatici from '$lib/components/visit-blocks/EsamiEmatici.svelte';
  import ValutazioneRischioCardiovascolare from '$lib/components/visit-blocks/ValutazioneRischioCardiovascolare.svelte';
  import Ecocardiografia from '$lib/components/visit-blocks/Ecocardiografia.svelte';
  import Conclusioni from '$lib/components/visit-blocks/Conclusioni.svelte';
  import FirmeVisita from '$lib/components/visit-blocks/FirmeVisita.svelte';
  import { isBlockVisibleForAmbulatorio } from '$lib/configs/visit-blocks-config';
  import {
    createEmptyEsamiEmatici,
    createEmptyFHAssessment,
    createEmptyFirmeVisita,
    createEmptyPianificazioneFollowUp,
    createEmptyTerapiaIpolipemizzante,
    createEmptyValutazioneRischioCV,
    isValutazioneRischioCVEqual,
    normalizeFHAssessment,
    normalizeTerapiaIpolipemizzante,
    normalizeValutazioneRischioCV,
    parseFHAssessment,
    parseFirmeVisita,
    parseTerapiaIpolipemizzante,
    parseValutazioneRischioCV,
    serializeEsamiEmatici,
    serializeFirmeVisita,
    serializeFHAssessment,
    serializePianificazioneFollowUp,
    serializeTerapiaIpolipemizzante,
    serializeValutazioneRischioCV,
    validateFHAssessment,
    validateTerapiaIpolipemizzante
  } from '$lib/utils/visit-clinical';

  $: user = $authStore.user;
  $: ambulatorioId = parseInt($page.params.id || '0');
  $: cameFromDashboard = $page.url.searchParams.get('from') === 'dashboard';
  $: preselectedPazienteId = parseInt($page.url.searchParams.get('pazienteId') || '0');

  type VisitFlowStep = 'select_patient' | 'compile_visit';
  type SelectPazienteOptions = {
    prefillFromHistory?: boolean;
  };
  type EcocardiografiaState = {
    vs_dtd: string;
    vs_siv: string;
    vs_pp: string;
    vs_rwt: string;
    vs_fe: string;
    vd_rvd1: string;
    vd_tapse: string;
    vd_s_prime: string;
    as_a4c: string;
    as_lavi: string;
    ad_a4c: string;
    ao_lvot: string;
    ao_radice: string;
    ao_giunto: string;
    ao_ascendente: string;
    ao_arco: string;
    ao_discendente: string;
    ao_addominale: string;
    va_vmax: string;
    va_gmax: string;
    va_gmed: string;
    va_pht: string;
    va_ava_vti: string;
    va_ava_plan: string;
    vm_gmed: string;
    vm_pisar: string;
    vm_eroa: string;
    vt_gmax: string;
    vt_vmax: string;
    vci: string;
    referto: string;
  };
  const EXISTING_PATIENT_DEFAULT_VISIT_TYPE = 'Controllo';

  function getTodayVisitDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  function createEmptyFattoriRischio() {
    return {
      familiarita: false,
      familiarita_note: '',
      ipertensione: false,
      diabete: false,
      diabete_durata: '',
      diabete_tipo: '' as DiabeteTipo,
      dislipidemia: false,
      obesita: false,
      fumo: '',
      fumo_ex_eta: ''
    };
  }

  function createEmptyEcocardiografia(): EcocardiografiaState {
    return {
      vs_dtd: '',
      vs_siv: '',
      vs_pp: '',
      vs_rwt: '',
      vs_fe: '',
      vd_rvd1: '',
      vd_tapse: '',
      vd_s_prime: '',
      as_a4c: '',
      as_lavi: '',
      ad_a4c: '',
      ao_lvot: '',
      ao_radice: '',
      ao_giunto: '',
      ao_ascendente: '',
      ao_arco: '',
      ao_discendente: '',
      ao_addominale: '',
      va_vmax: '',
      va_gmax: '',
      va_gmed: '',
      va_pht: '',
      va_ava_vti: '',
      va_ava_plan: '',
      vm_gmed: '',
      vm_pisar: '',
      vm_eroa: '',
      vt_gmax: '',
      vt_vmax: '',
      vci: '',
      referto: ''
    };
  }

  function parseEcocardiografia(raw?: string | null): EcocardiografiaState {
    const fallback = createEmptyEcocardiografia();
    if (!raw) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<Record<keyof EcocardiografiaState, unknown>>;
      const normalized = createEmptyEcocardiografia();
      for (const key of Object.keys(fallback) as Array<keyof EcocardiografiaState>) {
        const value = parsed[key];
        normalized[key] = typeof value === 'string' ? value : value == null ? '' : String(value);
      }
      return normalized;
    } catch {
      return fallback;
    }
  }

  let pazienti: Paziente[] = [];
  let selectedPaziente: Paziente | null = null;
  let currentStep: VisitFlowStep = 'select_patient';
  let searchTerm = '';
  let showNewPatientModal = false;
  let filteredPazienti: Paziente[] = [];
  let loading = false;
  let savingWithReport = false;
  let hasAppliedPreselectedPaziente = false;
  let latestVisitaPrefillRequestKey = '';

  // Opzioni per il campo Tipo Visita
  const tipoVisitaOptions = [
    { value: 'Prima visita', label: 'Prima visita' },
    { value: 'Controllo', label: 'Controllo' }
  ];

  // Form data
  let formData = {
    data_visita: getTodayVisitDate(),
    tipo_visita: '',
    motivo: '',
    altezza: '',
    peso: '',
    bmi: '',
    bsa: '',
    anamnesi: '',
    esame_obiettivo: '',
    diagnosi: '',
    terapia: '',
    note: ''
  };

  // Fattori di Rischio CV
  let fattoriRischio = createEmptyFattoriRischio();

  let fhAssessment = createEmptyFHAssessment();

  // Anamnesi Patologica Remota
  let anamnesiCardiologica = '';

  let terapiaIpolipemizzante = createEmptyTerapiaIpolipemizzante();

  // Terapia Domiciliare
  let terapiaDomiciliare = '';

  // Valutazione Odierna
  let valutazioneOdierna = '';

  // Esami Ematici
  let esamiEmatici = createEmptyEsamiEmatici();
  let previousEsamiEmatici: PreviousEsamiEmaticiMap = {};
  let previousEsamiLookupKey = '';
  let valutazioneRischioCV = createEmptyValutazioneRischioCV();

  // Ecocardiografia
  let ecocardiografia = createEmptyEcocardiografia();

  // Conclusioni
  let conclusioni = '';
  let pianificazioneFollowUp = createEmptyPianificazioneFollowUp();
  let firmeVisita = createEmptyFirmeVisita();

  let etaPaziente: number | null = null;
  let sessoPaziente: 'M' | 'F' | 'Altro' | null = null;
  let pesoKg: number | null = null;
  const RISK_CV_DEBUG = true;
  let lastRiskReactiveSnapshot = '';

  $: etaPaziente = selectedPaziente ? calculateAge(selectedPaziente.data_nascita) : null;
  $: sessoPaziente = selectedPaziente?.sesso || null;
  $: if (currentStep === 'compile_visit' && !selectedPaziente) {
    currentStep = 'select_patient';
  }
  $: {
    const parsedPeso = formData.peso ? parseFloat(formData.peso) : NaN;
    pesoKg = Number.isFinite(parsedPeso) ? parsedPeso : null;
  }
  $: {
    const normalizedRisk = normalizeValutazioneRischioCV(valutazioneRischioCV, esamiEmatici);
    if (RISK_CV_DEBUG) {
      const snapshot = [
        String(valutazioneRischioCV.rischio || ''),
        String(normalizedRisk.rischio || ''),
        normalizedRisk.status,
        normalizedRisk.statusMessage,
        String(normalizedRisk.ldlAttuale ?? 'null'),
        String(esamiEmatici.ldl_diretto || ''),
        String(esamiEmatici.ldl_calcolato || '')
      ].join('|');

      if (snapshot !== lastRiskReactiveSnapshot) {
        lastRiskReactiveSnapshot = snapshot;
        console.info('[RISK-CV][PAGE] reactive normalize', {
          before: valutazioneRischioCV,
          after: normalizedRisk,
          esami: {
            ldl_diretto: esamiEmatici.ldl_diretto,
            ldl_calcolato: esamiEmatici.ldl_calcolato
          }
        });
      }
    }
    if (!isValutazioneRischioCVEqual(valutazioneRischioCV, normalizedRisk)) {
      if (RISK_CV_DEBUG) {
        console.info('[RISK-CV][PAGE] apply normalizedRisk overwrite', {
          from: valutazioneRischioCV,
          to: normalizedRisk
        });
      }
      valutazioneRischioCV = normalizedRisk;
    }
  }

  // Calcolo automatico BMI e BSA
  $: {
    const altezza = parseFloat(formData.altezza);
    const peso = parseFloat(formData.peso);
    if (altezza > 0 && peso > 0) {
      // Calcolo BMI
      const altezzaMetri = altezza / 100;
      const bmi = peso / (altezzaMetri * altezzaMetri);
      formData.bmi = bmi.toFixed(2);

      // Calcolo BSA (Body Surface Area) con formula di Du Bois
      const bsa = 0.007184 * Math.pow(altezza, 0.725) * Math.pow(peso, 0.425);
      formData.bsa = bsa.toFixed(2);
    } else {
      formData.bmi = '';
      formData.bsa = '';
    }
  }

  // Filtra pazienti in base alla ricerca
  $: if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredPazienti = pazienti.filter(
      (p) =>
        p.cognome.toLowerCase().includes(term) ||
        p.nome.toLowerCase().includes(term) ||
        p.codice_fiscale.toLowerCase().includes(term)
    );
  } else {
    filteredPazienti = pazienti;
  }

  $: {
    const esamiReferenceDate = (esamiEmatici.data_ee || '').trim() || formData.data_visita;
    const nextLookupKey = selectedPaziente ? `${selectedPaziente.id}:${esamiReferenceDate}` : '';
    if (previousEsamiLookupKey !== nextLookupKey) {
      previousEsamiLookupKey = nextLookupKey;
      void loadPreviousEsamiEmatici(nextLookupKey);
    }
  }

  function resetVisitState(defaultTipoVisita = ''): void {
    formData = {
      data_visita: getTodayVisitDate(),
      tipo_visita: defaultTipoVisita,
      motivo: '',
      altezza: '',
      peso: '',
      bmi: '',
      bsa: '',
      anamnesi: '',
      esame_obiettivo: '',
      diagnosi: '',
      terapia: '',
      note: ''
    };

    fattoriRischio = createEmptyFattoriRischio();
    fhAssessment = createEmptyFHAssessment();
    anamnesiCardiologica = '';
    terapiaIpolipemizzante = createEmptyTerapiaIpolipemizzante();
    terapiaDomiciliare = '';
    valutazioneOdierna = '';
    esamiEmatici = createEmptyEsamiEmatici();
    previousEsamiEmatici = {};
    valutazioneRischioCV = createEmptyValutazioneRischioCV();
    ecocardiografia = createEmptyEcocardiografia();
    conclusioni = '';
    pianificazioneFollowUp = createEmptyPianificazioneFollowUp();
    firmeVisita = createEmptyFirmeVisita();
  }

  function applyLatestVisitaData(latestVisita: Visita): void {
    formData = {
      data_visita: getTodayVisitDate(),
      tipo_visita: EXISTING_PATIENT_DEFAULT_VISIT_TYPE,
      motivo: latestVisita.motivo || '',
      altezza: latestVisita.altezza != null ? String(latestVisita.altezza) : '',
      peso: latestVisita.peso != null ? String(latestVisita.peso) : '',
      bmi: latestVisita.bmi != null ? String(latestVisita.bmi) : '',
      bsa: latestVisita.bsa != null ? String(latestVisita.bsa) : '',
      anamnesi: latestVisita.anamnesi || '',
      esame_obiettivo: latestVisita.esame_obiettivo || '',
      diagnosi: latestVisita.diagnosi || '',
      terapia: latestVisita.terapia || '',
      note: latestVisita.note || ''
    };

    anamnesiCardiologica = latestVisita.anamnesi_cardiologica || '';
    terapiaIpolipemizzante = parseTerapiaIpolipemizzante(latestVisita.terapia_ipolipemizzante);
    terapiaDomiciliare = latestVisita.terapia_domiciliare || '';
    valutazioneOdierna = latestVisita.valutazione_odierna || '';
    esamiEmatici = createEmptyEsamiEmatici();
    valutazioneRischioCV = parseValutazioneRischioCV(latestVisita.valutazione_rischio_cv, esamiEmatici);
    if (RISK_CV_DEBUG) {
      console.info('[RISK-CV][PAGE] applyLatestVisitaData', {
        visitaId: latestVisita.id,
        rawValutazioneRischio: latestVisita.valutazione_rischio_cv,
        parsedValutazioneRischio: valutazioneRischioCV,
        parsedEsami: {
          ldl_diretto: esamiEmatici.ldl_diretto,
          ldl_calcolato: esamiEmatici.ldl_calcolato
        }
      });
    }
    ecocardiografia = parseEcocardiografia(latestVisita.ecocardiografia);
    fhAssessment = parseFHAssessment(latestVisita.fh_assessment);
    firmeVisita = parseFirmeVisita(latestVisita.firme_visita);
  }

  async function prefillFromLatestVisita(paziente: Paziente): Promise<void> {
    const requestKey = `${paziente.id}:${Date.now()}`;
    latestVisitaPrefillRequestKey = requestKey;

    resetVisitState(EXISTING_PATIENT_DEFAULT_VISIT_TYPE);

    try {
      const visite = await getVisiteByPaziente(paziente.id);
      if (latestVisitaPrefillRequestKey !== requestKey || selectedPaziente?.id !== paziente.id) {
        return;
      }

      const latestVisita = visite[0];
      if (!latestVisita) {
        return;
      }

      applyLatestVisitaData(latestVisita);

      try {
        const fattori = await getFattoriRischioCVByVisitaId(latestVisita.id);
        if (latestVisitaPrefillRequestKey !== requestKey || selectedPaziente?.id !== paziente.id) {
          return;
        }

        if (!fattori) {
          fattoriRischio = createEmptyFattoriRischio();
          return;
        }

        fattoriRischio = {
          familiarita: fattori.familiarita,
          familiarita_note: fattori.familiarita_note || '',
          ipertensione: fattori.ipertensione,
          diabete: fattori.diabete,
          diabete_durata: fattori.diabete_durata || '',
          diabete_tipo: fattori.diabete_tipo || '',
          dislipidemia: fattori.dislipidemia,
          obesita: fattori.obesita,
          fumo: fattori.fumo || '',
          fumo_ex_eta: fattori.fumo_ex_eta || ''
        };
      } catch (fattoriError) {
        console.error('Errore precompilazione fattori rischio:', fattoriError);
        if (latestVisitaPrefillRequestKey === requestKey && selectedPaziente?.id === paziente.id) {
          fattoriRischio = createEmptyFattoriRischio();
        }
      }
    } catch (prefillError) {
      console.error('Errore precompilazione visita precedente:', prefillError);
    }
  }

  async function loadPazienti() {
    try {
      pazienti = await getAllPazienti();
    } catch (error) {
      console.error('Errore caricamento pazienti:', error);
      toastStore.show('error', 'Errore durante il caricamento dei pazienti');
    }
  }

  function applyPreselectedPaziente() {
    if (hasAppliedPreselectedPaziente) {
      return;
    }

    hasAppliedPreselectedPaziente = true;
    if (!preselectedPazienteId) {
      return;
    }

    const preselectedPaziente = pazienti.find((paziente) => paziente.id === preselectedPazienteId);
    if (preselectedPaziente) {
      selectPaziente(preselectedPaziente);
      currentStep = 'compile_visit';
      return;
    }

    toastStore.show('info', 'Il paziente pre-selezionato non è stato trovato. Selezionalo manualmente.');
  }

  async function initializePage() {
    await loadPazienti();
    applyPreselectedPaziente();
  }

  async function loadPreviousEsamiEmatici(requestKey = previousEsamiLookupKey) {
    const esamiReferenceDate = (esamiEmatici.data_ee || '').trim() || formData.data_visita;
    if (!selectedPaziente || !esamiReferenceDate) {
      previousEsamiEmatici = {};
      return;
    }

    try {
      const nextValues = await getPreviousEsamiEmaticiByPaziente({
        pazienteId: selectedPaziente.id,
        beforeDate: esamiReferenceDate
      });

      if (requestKey !== previousEsamiLookupKey) {
        return;
      }

      previousEsamiEmatici = nextValues;
    } catch (error) {
      console.error('Errore caricamento storico esami:', error);
      if (requestKey === previousEsamiLookupKey) {
        previousEsamiEmatici = {};
      }
    }
  }

  function selectPaziente(paziente: Paziente, options: SelectPazienteOptions = {}) {
    const prefillFromHistory = options.prefillFromHistory ?? true;

    selectedPaziente = paziente;

    if (prefillFromHistory) {
      void prefillFromLatestVisita(paziente);
      return;
    }

    latestVisitaPrefillRequestKey = `${paziente.id}:skip:${Date.now()}`;
    resetVisitState('');
  }

  function handleSelectPazienteForVisit(paziente: Paziente): void {
    selectPaziente(paziente);
  }

  function handleContinueToVisitForm(): void {
    if (!selectedPaziente) {
      toastStore.show('error', 'Seleziona un paziente per continuare');
      return;
    }

    currentStep = 'compile_visit';
  }

  function handleChangePaziente(): void {
    if (!selectedPaziente) {
      currentStep = 'select_patient';
      return;
    }

    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(
            'Cambiare paziente? I dati inseriti nella visita corrente verranno azzerati.'
          );

    if (!confirmed) {
      return;
    }

    latestVisitaPrefillRequestKey = '';
    selectedPaziente = null;
    searchTerm = '';
    resetVisitState('');
    currentStep = 'select_patient';
  }

  function openNewPatientModal() {
    showNewPatientModal = true;
  }

  async function handleNewPatientSubmit(event: CustomEvent) {
    const newPaziente = event.detail;
    // Ricarica la lista dei pazienti
    await loadPazienti();
    // Seleziona automaticamente il nuovo paziente
    selectPaziente(newPaziente, { prefillFromHistory: false });
    currentStep = 'compile_visit';
    // Mostra un messaggio di successo
    toastStore.show('success', 'Paziente creato con successo!');
    // Chiudi il modal
    showNewPatientModal = false;
  }

  function calculateAge(dataNascita: string): number {
    const today = new Date();
    const birthDate = new Date(dataNascita);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

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

  function getReportErrorMessage(error: unknown): string {
    const message = getErrorMessage(error);
    return message.startsWith('Errore') ? message : `Errore referto: ${message}`;
  }

  async function openReportInWord(reportPath: string): Promise<void> {
    const { openPath } = await import('@tauri-apps/plugin-opener');

    // Try explicit Word targets first, then fallback to the OS default app for DOCX.
    const wordOpeners = ['winword', 'Microsoft Word', 'com.microsoft.Word', '/Applications/Microsoft Word.app'];

    for (const opener of wordOpeners) {
      try {
        await openPath(reportPath, opener);
        return;
      } catch {
        // Ignore and try next candidate.
      }
    }

    await openPath(reportPath);
  }

  async function submitVisit(generateReport = false) {
    if (!selectedPaziente) {
      toastStore.show('error', 'Seleziona un paziente');
      return;
    }

    if (!formData.tipo_visita) {
      toastStore.show('error', 'Seleziona il tipo di visita');
      return;
    }

    if (!formData.motivo.trim()) {
      toastStore.show('error', 'Inserisci il motivo della visita');
      return;
    }

    if (fattoriRischio.diabete && !fattoriRischio.diabete_tipo) {
      toastStore.show('error', 'Seleziona il tipo di diabete mellito');
      return;
    }

    const fhAssessmentError = validateFHAssessment(fhAssessment);
    if (fhAssessmentError) {
      toastStore.show('error', fhAssessmentError);
      return;
    }

    const terapiaIpolipemizzanteError = validateTerapiaIpolipemizzante(terapiaIpolipemizzante);
    if (terapiaIpolipemizzanteError) {
      toastStore.show('error', terapiaIpolipemizzanteError);
      return;
    }

    const followUpDateTime = (pianificazioneFollowUp.dataOraProssimaVisita || '').trim();
    if (followUpDateTime) {
      try {
        const followUpAvailability = await checkAppuntamentoSlotAvailability({
          ambulatorioId,
          dataOraInizio: followUpDateTime
        });

        if (!followUpAvailability.available) {
          const suggestionsText =
            followUpAvailability.suggestedTimes.length > 0
              ? ` Slot disponibili: ${followUpAvailability.suggestedTimes.join(', ')}.`
              : '';
          toastStore.show(
            'error',
            `Lo slot scelto per la prossima visita non è disponibile.${suggestionsText}`
          );
          return;
        }
      } catch (slotError) {
        toastStore.show(
          'error',
          `Impossibile validare lo slot della prossima visita: ${getErrorMessage(slotError)}`
        );
        return;
      }
    }

    if (!user) {
      toastStore.show('error', 'Utente non autenticato');
      return;
    }

    loading = true;
    savingWithReport = generateReport;
    try {
      const hasEsamiEmatici = Object.values(esamiEmatici).some((value) => String(value || '').trim());
      const esamiEmaticiPayload = hasEsamiEmatici ? serializeEsamiEmatici(esamiEmatici) : undefined;

      const hasEcocardiografia = Object.values(ecocardiografia).some((value) => String(value || '').trim());
      const ecocardiografiaPayload = hasEcocardiografia ? JSON.stringify(ecocardiografia) : undefined;

      fhAssessment = normalizeFHAssessment(fhAssessment);
      terapiaIpolipemizzante = normalizeTerapiaIpolipemizzante(terapiaIpolipemizzante);
      valutazioneRischioCV = normalizeValutazioneRischioCV(valutazioneRischioCV, esamiEmatici);

      const visitaId = await createVisitaCompleta({
        visita: {
          ambulatorio_id: ambulatorioId,
          paziente_id: selectedPaziente.id,
          medico_id: user.id,
          data_visita: formData.data_visita || getTodayVisitDate(),
          tipo_visita: formData.tipo_visita,
          motivo: formData.motivo,
          altezza: formData.altezza ? parseFloat(formData.altezza) : undefined,
          peso: formData.peso ? parseFloat(formData.peso) : undefined,
          bmi: formData.bmi ? parseFloat(formData.bmi) : undefined,
          bsa: formData.bsa ? parseFloat(formData.bsa) : undefined,
          anamnesi_cardiologica: anamnesiCardiologica || undefined,
          terapia_ipolipemizzante: serializeTerapiaIpolipemizzante(terapiaIpolipemizzante),
          terapia_domiciliare: terapiaDomiciliare || undefined,
          valutazione_odierna: valutazioneOdierna || undefined,
          esami_ematici: esamiEmaticiPayload,
          valutazione_rischio_cv: serializeValutazioneRischioCV(valutazioneRischioCV, esamiEmatici),
          ecocardiografia: ecocardiografiaPayload,
          fh_assessment: serializeFHAssessment(fhAssessment),
          firme_visita: serializeFirmeVisita(firmeVisita),
          pianificazione_followup: serializePianificazioneFollowUp(pianificazioneFollowUp),
          conclusioni: conclusioni || undefined,
          anamnesi: formData.anamnesi || undefined,
          esame_obiettivo: formData.esame_obiettivo || undefined,
          diagnosi: formData.diagnosi || undefined,
          terapia: formData.terapia || undefined,
          note: formData.note || undefined
        },
        fattoriRischioCV: {
          familiarita: fattoriRischio.familiarita,
          familiarita_note: fattoriRischio.familiarita_note,
          ipertensione: fattoriRischio.ipertensione,
          diabete: fattoriRischio.diabete,
          diabete_durata: fattoriRischio.diabete_durata,
          diabete_tipo: fattoriRischio.diabete_tipo,
          dislipidemia: fattoriRischio.dislipidemia,
          obesita: fattoriRischio.obesita,
          fumo: fattoriRischio.fumo,
          fumo_ex_eta: fattoriRischio.fumo_ex_eta
        }
      });

      if (generateReport) {
        try {
          const { generateVisitaReferto } = await import('$lib/reports/generateVisitaReferto');
          const reportResult = await generateVisitaReferto({
            paziente: selectedPaziente,
            formData: {
              data_visita: formData.data_visita,
              tipo_visita: formData.tipo_visita,
              motivo: formData.motivo,
              altezza: formData.altezza,
              peso: formData.peso,
              bmi: formData.bmi
            },
            fattoriRischio: {
              familiarita: fattoriRischio.familiarita,
              familiarita_note: fattoriRischio.familiarita_note,
              ipertensione: fattoriRischio.ipertensione,
              diabete: fattoriRischio.diabete,
              diabete_durata: fattoriRischio.diabete_durata,
              diabete_tipo: fattoriRischio.diabete_tipo,
              dislipidemia: fattoriRischio.dislipidemia,
              obesita: fattoriRischio.obesita,
              fumo: fattoriRischio.fumo,
              fumo_ex_eta: fattoriRischio.fumo_ex_eta
            },
            fhAssessment,
            anamnesiPatologicaRemota: anamnesiCardiologica,
            terapiaIpolipemizzante,
            terapiaDomiciliare,
            esamiEmatici,
            valutazioneRischioCV,
            conclusioni,
            pianificazioneFollowUp,
            firmeVisita,
            visitaId
          });

          if (reportResult.saved) {
            if (reportResult.path) {
              try {
                await openReportInWord(reportResult.path);
                toastStore.show('success', 'Visita e referto DOCX salvati. Referto aperto in Word.');
              } catch (openError) {
                console.error('Errore apertura referto DOCX:', openError);
                toastStore.show('warning', `Visita e referto DOCX salvati, ma non è stato possibile aprire Word. ${getReportErrorMessage(openError)}`);
              }
            } else {
              toastStore.show('success', 'Visita e referto DOCX salvati con successo!');
            }
          } else {
            toastStore.show('success', 'Visita creata. Salvataggio referto annullato.');
          }
        } catch (reportError) {
          console.error('Errore generazione referto DOCX:', reportError);
          toastStore.show('warning', `Visita salvata, ma il referto DOCX non è stato creato. ${getReportErrorMessage(reportError)}`);
        }
      } else {
        toastStore.show('success', 'Visita creata con successo!');
      }

      goto(`/ambulatori/${ambulatorioId}/visite`);
    } catch (error) {
      console.error('Errore creazione visita:', error);
      toastStore.show('error', `Errore durante la creazione della visita: ${getErrorMessage(error)}`);
    } finally {
      loading = false;
      savingWithReport = false;
    }
  }

  async function handleSubmit() {
    await submitVisit(false);
  }

  async function handleSubmitAndGenerateReport() {
    await submitVisit(true);
  }

  function handleBack() {
    goto(cameFromDashboard ? `/ambulatori/${ambulatorioId}` : `/ambulatori/${ambulatorioId}/visite`);
  }

  onMount(() => {
    void initializePage();
  });
</script>

<div class="nuova-visita-page">
  <PageHeader
    title="Nuova Visita"
    subtitle={currentStep === 'compile_visit'
      ? 'Inserisci i dati della nuova visita medica'
      : 'Seleziona o crea un paziente per iniziare la visita'}
    showLogo={$sidebarCollapsedStore}
    onBack={handleBack}
  >
    <svelte:fragment slot="actions">
      <button type="button" class="btn-icon-text" on:click={openNewPatientModal}>
        <span class="icon">
          <Icon name="user-plus" size={24} />
        </span>
        <span class="text">Nuovo Paziente</span>
      </button>
      {#if currentStep === 'compile_visit'}
        <button type="button" class="btn-icon-text" on:click={handleChangePaziente}>
          <span class="icon">
            <Icon name="user" size={24} />
          </span>
          <span class="text">Cambia Paziente</span>
        </button>
      {/if}
    </svelte:fragment>
  </PageHeader>

  {#if currentStep === 'select_patient'}
    <section class="patient-selection-step">
      <Card>
        <h2 class="section-title">Scelta Paziente</h2>
        <p class="patient-selection-description">
          Seleziona un paziente esistente dalla lista oppure usa il pulsante in alto per crearne uno
          nuovo.
        </p>

        <div class="search-box patient-selection-search">
          <input
            type="text"
            bind:value={searchTerm}
            placeholder="Cerca per nome, cognome o codice fiscale..."
          />
        </div>

        <div class="patient-table-container patient-selection-table">
          {#if filteredPazienti.length === 0}
            <div class="empty-state">Nessun paziente trovato</div>
          {:else}
            <table class="patient-table">
              <thead>
                <tr>
                  <th>Cognome</th>
                  <th>Nome</th>
                  <th>Codice Fiscale</th>
                  <th>Data Nascita</th>
                  <th>Sesso</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredPazienti as paziente}
                  <tr
                    class="patient-row"
                    class:selected={selectedPaziente?.id === paziente.id}
                    on:click={() => handleSelectPazienteForVisit(paziente)}
                  >
                    <td><strong>{paziente.cognome}</strong></td>
                    <td>{paziente.nome}</td>
                    <td class="text-muted">{paziente.codice_fiscale}</td>
                    <td>{new Date(paziente.data_nascita).toLocaleDateString('it-IT')}</td>
                    <td>{paziente.sesso}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>

        <div class="patient-selection-actions">
          <button type="button" class="btn-secondary" on:click={handleBack}>
            Annulla
          </button>
          <button
            type="button"
            class="btn-primary"
            disabled={!selectedPaziente}
            on:click={handleContinueToVisitForm}
          >
            Continua
          </button>
        </div>
      </Card>
    </section>
  {:else if selectedPaziente}
    <form on:submit|preventDefault={handleSubmit} class="page-content">
    <!-- Dati Anagrafici Paziente -->
    <Card>
      <h2 class="section-title">Dati Anagrafici</h2>
      <div class="patient-info-grid">
        <div class="info-item">
          <span class="info-label">Nome Completo:</span>
          <span class="info-value"
            >{selectedPaziente.cognome} {selectedPaziente.nome}</span
          >
        </div>
        <div class="info-item">
          <span class="info-label">Codice Fiscale:</span>
          <span class="info-value">{selectedPaziente.codice_fiscale}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Data di Nascita:</span>
          <span class="info-value">
            {new Date(selectedPaziente.data_nascita).toLocaleDateString('it-IT')}
            ({calculateAge(selectedPaziente.data_nascita)} anni)
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">Esenzione:</span>
          <span class="info-value">
            {#if selectedPaziente.esenzioni && selectedPaziente.esenzioni.trim() && selectedPaziente.esenzioni.toLowerCase() !== 'nessuno'}
              {selectedPaziente.esenzioni}
            {:else}
              Non esente
            {/if}
          </span>
        </div>
        {#if selectedPaziente.telefono}
          <div class="info-item">
            <span class="info-label">Telefono:</span>
            <span class="info-value">{selectedPaziente.telefono}</span>
          </div>
        {/if}
        {#if selectedPaziente.email}
          <div class="info-item">
            <span class="info-label">Email:</span>
            <span class="info-value">{selectedPaziente.email}</span>
          </div>
        {/if}
      </div>
    </Card>

    <!-- Dati Visita -->
    <Card>
      <h2 class="section-title">Dati Visita</h2>
      <div class="form-row">
        <div class="form-group">
          <Input
            id="data_visita"
            type="date"
            label="Data Visita"
            bind:value={formData.data_visita}
            required
          />
        </div>
        <div class="form-group">
          <span class="field-label">Tipo Visita *</span>
          <div class="visit-type-radio-group">
            {#each tipoVisitaOptions as option}
              <label class="visit-type-radio-option">
                <input
                  type="radio"
                  name="tipo_visita"
                  value={option.value}
                  bind:group={formData.tipo_visita}
                  required
                />
                <span>{option.label}</span>
              </label>
            {/each}
          </div>
        </div>
      </div>
      <Input
        id="motivo"
        label="Motivo"
        bind:value={formData.motivo}
        placeholder="Motivo della visita"
        required
      />
    </Card>

    <!-- Dati Antropometrici -->
    <Card>
      <h2 class="section-title">Dati Antropometrici</h2>
      <div class="anthropometric-row">
        <div class="form-group">
          <Input
            id="altezza"
            type="number"
            label="Altezza (cm)"
            bind:value={formData.altezza}
            placeholder="es. 175"
          />
        </div>
        <div class="form-group">
          <Input
            id="peso"
            type="number"
            label="Peso (kg)"
            bind:value={formData.peso}
            placeholder="es. 70"
          />
        </div>
        <div class="form-group">
          <Input
            id="bmi"
            type="text"
            label="BMI"
            value={formData.bmi}
            disabled
            placeholder="Automatico"
          />
          {#if formData.bmi}
            <small class="bmi-info" class:sottopeso={parseFloat(formData.bmi) < 18.5} class:normopeso={parseFloat(formData.bmi) >= 18.5 && parseFloat(formData.bmi) < 25} class:sovrappeso={parseFloat(formData.bmi) >= 25 && parseFloat(formData.bmi) < 30} class:obesita1={parseFloat(formData.bmi) >= 30 && parseFloat(formData.bmi) < 35} class:obesita2={parseFloat(formData.bmi) >= 35 && parseFloat(formData.bmi) < 40} class:obesita3={parseFloat(formData.bmi) >= 40}>
              {#if parseFloat(formData.bmi) < 18.5}
                Sottopeso
              {:else if parseFloat(formData.bmi) < 25}
                Normopeso
              {:else if parseFloat(formData.bmi) < 30}
                Sovrappeso
              {:else if parseFloat(formData.bmi) < 35}
                Obesità Classe I
              {:else if parseFloat(formData.bmi) < 40}
                Obesità Classe II
              {:else}
                Obesità Classe III
              {/if}
            </small>
          {/if}
        </div>
        <div class="form-group">
          <Input
            id="bsa"
            type="text"
            label="BSA (m²)"
            value={formData.bsa}
            disabled
            placeholder="es. 1.5"
          />
        </div>
      </div>
    </Card>

    <!-- Fattori di Rischio CV (solo per Ambulatorio Dislipidemie) -->
    {#if isBlockVisibleForAmbulatorio('fattori-rischio-cv', ambulatorioId)}
      <FattoriRischioCV
        bind:familiarita={fattoriRischio.familiarita}
        bind:familiarita_note={fattoriRischio.familiarita_note}
        bind:ipertensione={fattoriRischio.ipertensione}
        bind:diabete={fattoriRischio.diabete}
        bind:diabete_durata={fattoriRischio.diabete_durata}
        bind:diabete_tipo={fattoriRischio.diabete_tipo}
        bind:dislipidemia={fattoriRischio.dislipidemia}
        bind:obesita={fattoriRischio.obesita}
        bind:fumo={fattoriRischio.fumo}
        bind:fumo_ex_eta={fattoriRischio.fumo_ex_eta}
        bmi={formData.bmi ? parseFloat(formData.bmi) : null}
      />
    {/if}

    {#if isBlockVisibleForAmbulatorio('fh-assessment', ambulatorioId)}
      <IpercolesterolemiaFamiliareFH
        bind:enabled={fhAssessment.enabled}
        bind:familyHistoryOnePoint={fhAssessment.familyHistoryOnePoint}
        bind:familyHistoryTwoPoints={fhAssessment.familyHistoryTwoPoints}
        bind:clinicalPrematureCAD={fhAssessment.clinicalPrematureCAD}
        bind:clinicalPrematureCerebralOrPeripheral={fhAssessment.clinicalPrematureCerebralOrPeripheral}
        bind:physicalTendonXanthomas={fhAssessment.physicalTendonXanthomas}
        bind:physicalCornealArcusBefore45={fhAssessment.physicalCornealArcusBefore45}
        bind:untreatedLdlRange={fhAssessment.untreatedLdlRange}
        bind:geneticMutation={fhAssessment.geneticMutation}
        bind:totalScore={fhAssessment.totalScore}
        bind:classification={fhAssessment.classification}
      />
    {/if}

    <!-- Anamnesi Patologica Remota (solo per Ambulatorio Dislipidemie) -->
    {#if isBlockVisibleForAmbulatorio('anamnesi-cardiologica', ambulatorioId)}
      <AnamnesiCardiologica bind:anamnesi_cardiologica={anamnesiCardiologica} />
    {/if}

    {#if isBlockVisibleForAmbulatorio('terapia-ipolipemizzante', ambulatorioId)}
      <TerapiaIpolipemizzante bind:terapia={terapiaIpolipemizzante} />
    {/if}

    <!-- Terapia Domiciliare (solo per Ambulatorio Dislipidemie) -->
    {#if isBlockVisibleForAmbulatorio('terapia-domiciliare', ambulatorioId)}
      <TerapiaDomiciliare bind:terapia_domiciliare={terapiaDomiciliare} />
    {/if}

    <!-- Valutazione Odierna (solo per Ambulatorio Dislipidemie) -->
    {#if isBlockVisibleForAmbulatorio('valutazione-odierna', ambulatorioId)}
      <ValutazioneOdierna bind:valutazione_odierna={valutazioneOdierna} />
    {/if}

    <!-- Esami Ematici (solo per Ambulatorio Dislipidemie) -->
    {#if isBlockVisibleForAmbulatorio('esami-ematici', ambulatorioId)}
      <EsamiEmatici
        bind:esami={esamiEmatici}
        eta={etaPaziente}
        peso={pesoKg}
        sesso={sessoPaziente}
        previousValues={previousEsamiEmatici}
      />
    {/if}

    {#if isBlockVisibleForAmbulatorio('valutazione-rischio-cv', ambulatorioId)}
      <ValutazioneRischioCardiovascolare
        bind:valutazione={valutazioneRischioCV}
        esami={esamiEmatici}
        terapia={terapiaIpolipemizzante}
        eta={etaPaziente}
      />
    {/if}

    <!-- Ecocardiografia (solo per Ambulatorio Dislipidemie) -->
    {#if isBlockVisibleForAmbulatorio('ecocardiografia', ambulatorioId)}
      <Ecocardiografia bind:eco={ecocardiografia} />
    {/if}

    <!-- Conclusioni -->
    <Conclusioni
      bind:conclusioni={conclusioni}
      bind:pianificazioneFollowUp={pianificazioneFollowUp}
      ambulatorioId={ambulatorioId}
    />

    {#if isBlockVisibleForAmbulatorio('firme-visita', ambulatorioId)}
      <FirmeVisita bind:firme={firmeVisita} />
    {/if}

    <!-- Azioni -->
    <div class="form-actions">
      <button type="button" class="btn-secondary" on:click={handleBack} disabled={loading}>
        Annulla
      </button>
      <button
        type="button"
        class="btn-report"
        on:click={handleSubmitAndGenerateReport}
        disabled={loading}
      >
        {loading && savingWithReport ? 'Creazione referto...' : 'Concludi e salva referto'}
      </button>
      <button type="submit" class="btn-primary" disabled={loading}>
        {loading && !savingWithReport ? 'Salvataggio...' : 'Concludi Visita'}
      </button>
    </div>
    </form>
  {/if}
</div>

<!-- Modal Nuovo Paziente -->
<PazienteFormModal
  bind:isOpen={showNewPatientModal}
  paziente={null}
  {ambulatorioId}
  on:submit={handleNewPatientSubmit}
  on:close={() => (showNewPatientModal = false)}
/>

<style>
  .nuova-visita-page {
    padding: var(--space-6);
    max-width: 1200px;
    margin: 0 auto;
  }

  .page-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .patient-selection-step {
    padding-top: var(--space-2);
  }

  .patient-selection-description {
    margin: 0 0 var(--space-4);
    font-size: var(--text-base);
    color: var(--color-text-secondary);
  }

  .patient-selection-search {
    margin-bottom: var(--space-4);
  }

  .patient-selection-table {
    max-height: 440px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .patient-selection-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    margin-top: var(--space-5);
  }

  .section-title {
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 var(--space-4) 0;
    padding-bottom: var(--space-3);
    border-bottom: 2px solid var(--color-border);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  .anthropometric-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-4);
    align-items: start;
  }

  .anthropometric-row .form-group {
    margin-bottom: 0;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }

  .field-label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  .visit-type-radio-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    min-height: 34px;
    align-items: center;
    padding: var(--space-2) 0;
  }

  .visit-type-radio-option {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text);
    cursor: pointer;
  }

  .visit-type-radio-option input {
    margin: 0;
    cursor: pointer;
  }

  .search-box {
    margin-bottom: var(--space-4);
  }

  .search-box input {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    color: var(--color-text);
    background: #ffffff;
    transition: all 0.2s;
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .patient-table-container {
    max-height: 400px;
    overflow-y: auto;
  }

  .patient-table {
    width: 100%;
    border-collapse: collapse;
  }

  .patient-table thead {
    background: var(--color-bg-secondary);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .patient-table th {
    text-align: left;
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 2px solid var(--color-border);
  }

  .patient-table td {
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
    font-size: var(--text-sm);
    color: var(--color-text);
  }

  .patient-row {
    cursor: pointer;
    transition: background 0.2s;
  }

  .patient-row:hover {
    background: var(--color-bg-secondary);
  }

  .patient-row.selected {
    background: rgba(30, 58, 138, 0.1);
  }

  .patient-row:active {
    background: var(--color-bg-tertiary);
  }

  .empty-state {
    text-align: center;
    padding: var(--space-8);
    color: var(--color-text-secondary);
  }

  .patient-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
    margin-top: var(--space-5);
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .info-label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .info-value {
    font-size: var(--text-base);
    color: var(--color-text-primary);
  }

  .bmi-info {
    display: block;
    font-size: var(--text-sm);
    font-weight: 600;
    margin-top: 2px;
  }

  .bmi-info.sottopeso {
    color: #d97706;
  }

  .bmi-info.normopeso {
    color: #16a34a;
  }

  .bmi-info.sovrappeso {
    color: #eab308;
  }

  .bmi-info.obesita1 {
    color: #f97316;
  }

  .bmi-info.obesita2 {
    color: #ef4444;
  }

  .bmi-info.obesita3 {
    color: #dc2626;
  }

  .form-actions {
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .btn-primary,
  .btn-secondary,
  .btn-report {
    padding: var(--space-3) var(--space-6);
    border-radius: var(--radius-md);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    font-size: var(--text-base);
  }

  .btn-primary {
    background: var(--color-success);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #059669;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-report {
    background: rgba(30, 58, 138, 0.08);
    color: var(--color-primary);
    border: 1px solid rgba(30, 58, 138, 0.24);
  }

  .btn-report:hover:not(:disabled) {
    background: rgba(30, 58, 138, 0.14);
  }

  .btn-report:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: transparent;
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--color-bg-secondary);
  }

  @media (max-width: 768px) {
    .anthropometric-row {
      grid-template-columns: 1fr;
    }

    .patient-selection-actions {
      flex-direction: column;
    }

    .form-row,
    .patient-info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

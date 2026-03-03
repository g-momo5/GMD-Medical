<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth';
  import { sidebarCollapsedStore } from '$lib/stores/sidebar';
  import { toastStore } from '$lib/stores/toast';
  import { getAllPazienti } from '$lib/db/pazienti';
  import { getPreviousEsamiEmaticiByPaziente } from '$lib/db/visite';
  import { createVisitaCompleta } from '$lib/db/visite-complete';
  import type { DiabeteTipo, Paziente, PreviousEsamiEmaticiMap } from '$lib/db/types';
  import Card from '$lib/components/Card.svelte';
  import Input from '$lib/components/Input.svelte';
  import Select from '$lib/components/Select.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
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
  import { getE2EConfig } from '$lib/testing/e2e-config';
  import {
    createEmptyEsamiEmatici,
    createEmptyFHAssessment,
    createEmptyFirmeVisita,
    createEmptyPianificazioneFollowUp,
    createEmptyTerapiaIpolipemizzante,
    createEmptyValutazioneRischioCV,
    isValutazioneRischioCVEqual,
    normalizeFHAssessment,
    normalizeValutazioneRischioCV,
    normalizeTerapiaIpolipemizzante,
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
  $: e2eConfig = getE2EConfig($page.url.searchParams);
  $: e2eReportPath =
    $page.url.searchParams.get('reportPath')?.trim() || e2eConfig.fixedReportPath;

  type PatientLookupField = 'nome' | 'cognome' | 'codice_fiscale';
  type PatientLookupState = Record<PatientLookupField, string>;
  const MIN_PATIENT_LOOKUP_LENGTH = 2;

  let pazienti: Paziente[] = [];
  let selectedPaziente: Paziente | null = null;
  let searchTerm = '';
  let showPatientModal = false;
  let showNewPatientModal = false;
  let filteredPazienti: Paziente[] = [];
  let patientSuggestions: Paziente[] = [];
  let hasActivePatientLookup = false;
  let showPatientSuggestions = false;
  let loading = false;
  let savingWithReport = false;
  let hasAppliedPreselectedPaziente = false;

  // Opzioni per il select Tipo Visita
  const tipoVisitaOptions = [
    { value: 'Prima visita', label: 'Prima visita' },
    { value: 'Controllo', label: 'Controllo' }
  ];

  // Form data
  let formData = {
    data_visita: new Date().toISOString().split('T')[0],
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
  let fattoriRischio = {
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
  let ecocardiografia = {
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

  // Conclusioni
  let conclusioni = '';
  let pianificazioneFollowUp = createEmptyPianificazioneFollowUp();
  let firmeVisita = createEmptyFirmeVisita();

  let etaPaziente: number | null = null;
  let sessoPaziente: 'M' | 'F' | 'Altro' | null = null;
  let pesoKg: number | null = null;
  let patientLookup = createEmptyPatientLookup();

  $: etaPaziente = selectedPaziente ? calculateAge(selectedPaziente.data_nascita) : null;
  $: sessoPaziente = selectedPaziente?.sesso || null;
  $: {
    const parsedPeso = formData.peso ? parseFloat(formData.peso) : NaN;
    pesoKg = Number.isFinite(parsedPeso) ? parsedPeso : null;
  }
  $: {
    const normalizedRisk = normalizeValutazioneRischioCV(valutazioneRischioCV, esamiEmatici);
    if (!isValutazioneRischioCVEqual(valutazioneRischioCV, normalizedRisk)) {
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
    const nome = patientLookup.nome.trim().toLowerCase();
    const cognome = patientLookup.cognome.trim().toLowerCase();
    const codiceFiscale = patientLookup.codice_fiscale.trim().toLowerCase();

    hasActivePatientLookup =
      nome.length >= MIN_PATIENT_LOOKUP_LENGTH ||
      cognome.length >= MIN_PATIENT_LOOKUP_LENGTH ||
      codiceFiscale.length >= MIN_PATIENT_LOOKUP_LENGTH;

    if (!hasActivePatientLookup) {
      patientSuggestions = [];
    } else {
      patientSuggestions = pazienti
        .filter(
          (p) =>
            (nome.length < MIN_PATIENT_LOOKUP_LENGTH || p.nome.toLowerCase().includes(nome)) &&
            (cognome.length < MIN_PATIENT_LOOKUP_LENGTH ||
              p.cognome.toLowerCase().includes(cognome)) &&
            (codiceFiscale.length < MIN_PATIENT_LOOKUP_LENGTH ||
              p.codice_fiscale.toLowerCase().includes(codiceFiscale))
        )
        .slice(0, 8);
    }
  }
  $: {
    const nextLookupKey = selectedPaziente ? `${selectedPaziente.id}:${formData.data_visita}` : '';
    if (previousEsamiLookupKey !== nextLookupKey) {
      previousEsamiLookupKey = nextLookupKey;
      void loadPreviousEsamiEmatici(nextLookupKey);
    }
  }

  function createEmptyPatientLookup(): PatientLookupState {
    return {
      nome: '',
      cognome: '',
      codice_fiscale: ''
    };
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
    }
  }

  async function initializePage() {
    await loadPazienti();
    applyPreselectedPaziente();
  }

  async function loadPreviousEsamiEmatici(requestKey = previousEsamiLookupKey) {
    if (!selectedPaziente || !formData.data_visita) {
      previousEsamiEmatici = {};
      return;
    }

    try {
      const nextValues = await getPreviousEsamiEmaticiByPaziente({
        pazienteId: selectedPaziente.id,
        beforeDate: formData.data_visita
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

  function selectPaziente(paziente: Paziente) {
    selectedPaziente = paziente;
    patientLookup = {
      nome: paziente.nome,
      cognome: paziente.cognome,
      codice_fiscale: paziente.codice_fiscale
    };
    showPatientSuggestions = false;
    searchTerm = '';
    showPatientModal = false;
  }

  function openPatientModal() {
    showPatientModal = true;
    searchTerm = '';
  }

  function openNewPatientModal() {
    showNewPatientModal = true;
  }

  async function handleNewPatientSubmit(event: CustomEvent) {
    const newPaziente = event.detail;
    // Ricarica la lista dei pazienti
    await loadPazienti();
    // Seleziona automaticamente il nuovo paziente
    selectPaziente(newPaziente);
    // Mostra un messaggio di successo
    toastStore.show('success', 'Paziente creato con successo!');
    // Chiudi il modal
    showNewPatientModal = false;
  }

  function getSelectedPatientFieldValue(field: PatientLookupField): string {
    if (!selectedPaziente) {
      return '';
    }

    if (field === 'nome') {
      return selectedPaziente.nome;
    }

    if (field === 'cognome') {
      return selectedPaziente.cognome;
    }

    return selectedPaziente.codice_fiscale;
  }

  function handlePatientLookupInput(field: PatientLookupField, event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    const rawValue = target.value;
    const value = field === 'codice_fiscale' ? rawValue.toUpperCase() : rawValue;
    const isStartingNewSearch =
      !!selectedPaziente && value !== getSelectedPatientFieldValue(field);

    if (isStartingNewSearch) {
      selectedPaziente = null;
      patientLookup = createEmptyPatientLookup();
    }

    if (field === 'nome') {
      patientLookup = {
        ...patientLookup,
        nome: value
      };
    } else if (field === 'cognome') {
      patientLookup = {
        ...patientLookup,
        cognome: value
      };
    } else {
      patientLookup = {
        ...patientLookup,
        codice_fiscale: value
      };
    }

    showPatientSuggestions = true;
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
          data_visita: formData.data_visita || new Date().toISOString(),
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
            anamnesiPatologicaRemota: anamnesiCardiologica,
            terapiaIpolipemizzante,
            terapiaDomiciliare,
            esamiEmatici,
            valutazioneRischioCV,
            conclusioni,
            pianificazioneFollowUp,
            firmeVisita,
            visitaId
          }, e2eConfig.enabled ? {
            saveMode: 'fixed-path',
            fixedPath: e2eReportPath
          } : undefined);

          if (reportResult.saved) {
            toastStore.show('success', 'Visita e referto DOCX salvati con successo!');
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
    subtitle={selectedPaziente
      ? 'Inserisci i dati della nuova visita medica'
      : 'Seleziona o crea un paziente per iniziare la visita'}
    showLogo={$sidebarCollapsedStore}
    onBack={handleBack}
  >
    <svelte:fragment slot="actions">
      {#if selectedPaziente}
        <button type="button" class="btn-icon-text" on:click={openNewPatientModal}>
          <span class="icon">
            <svg class="icon-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </span>
          <span class="text">Nuovo Paziente</span>
        </button>
        <button type="button" class="btn-icon-text" on:click={openPatientModal}>
          <span class="icon">
            <svg class="icon-svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </span>
          <span class="text">Cambia Paziente</span>
        </button>
      {/if}
    </svelte:fragment>
  </PageHeader>

  {#if !selectedPaziente}
    <section class="patient-start-screen">
      <div class="patient-start-content">
        <p class="patient-start-kicker">Prima di iniziare</p>
        <h2 class="patient-start-title">Scegli il paziente della visita</h2>
        <p class="patient-start-description">
          Crea un nuovo paziente oppure selezionane uno gia presente in archivio.
        </p>

        <div class="patient-start-actions">
          <button type="button" class="patient-start-button" on:click={openNewPatientModal}>
            <span class="icon">
              <svg class="icon-svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </span>
            <span class="patient-start-button-title">Nuovo Paziente</span>
            <span class="patient-start-button-text">Apri subito la scheda anagrafica e aggiungilo.</span>
          </button>

          <button
            type="button"
            class="patient-start-button patient-start-button-secondary"
            on:click={openPatientModal}
          >
            <span class="icon">
              <svg class="icon-svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </span>
            <span class="patient-start-button-title">Seleziona Paziente</span>
            <span class="patient-start-button-text">Cerca un paziente esistente e collega la visita.</span>
          </button>
        </div>
      </div>
    </section>
  {:else}
    <form on:submit|preventDefault={handleSubmit} class="page-content">
    <!-- Dati Anagrafici Paziente -->
    <Card>
      <h2 class="section-title">Dati Anagrafici</h2>

      {#if !selectedPaziente}
        <div class="patient-lookup-grid">
          <div class="form-group patient-lookup-field">
            <label for="paziente-cognome" class="field-label">Cognome</label>
            <input
              id="paziente-cognome"
              type="text"
              value={patientLookup.cognome}
              placeholder="Digita almeno 2 caratteri"
              autocomplete="off"
              on:input={(event) => handlePatientLookupInput('cognome', event)}
            />
          </div>
          <div class="form-group patient-lookup-field">
            <label for="paziente-nome" class="field-label">Nome</label>
            <input
              id="paziente-nome"
              type="text"
              value={patientLookup.nome}
              placeholder="Digita almeno 2 caratteri"
              autocomplete="off"
              on:input={(event) => handlePatientLookupInput('nome', event)}
            />
          </div>
          <div class="form-group patient-lookup-field">
            <label for="paziente-codice-fiscale" class="field-label">Codice Fiscale</label>
            <input
              id="paziente-codice-fiscale"
              type="text"
              value={patientLookup.codice_fiscale}
              placeholder="Digita almeno 2 caratteri"
              autocomplete="off"
              on:input={(event) => handlePatientLookupInput('codice_fiscale', event)}
            />
          </div>
        </div>

        {#if showPatientSuggestions && hasActivePatientLookup}
          <div class="patient-suggestions-panel">
            {#if patientSuggestions.length === 0}
              <div class="patient-lookup-hint">Nessun paziente trovato con questi criteri.</div>
            {:else}
              <div class="patient-suggestions-list">
                {#each patientSuggestions as paziente}
                  <button
                    type="button"
                    class="patient-suggestion"
                    on:click={() => selectPaziente(paziente)}
                  >
                    <span class="patient-suggestion-name">{paziente.cognome} {paziente.nome}</span>
                    <span class="patient-suggestion-meta">
                      {paziente.codice_fiscale} • {new Date(paziente.data_nascita).toLocaleDateString('it-IT')}
                    </span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          <p class="patient-lookup-hint">
            Digita almeno 2 caratteri in nome, cognome o codice fiscale per cercare un paziente
            esistente.
          </p>
        {/if}
      {/if}

      {#if selectedPaziente}
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
      {/if}
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
          <Select
            id="tipo_visita"
            label="Tipo Visita"
            bind:value={formData.tipo_visita}
            options={tipoVisitaOptions}
            placeholder="Seleziona tipo visita"
            required
          />
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
      <ValutazioneRischioCardiovascolare bind:valutazione={valutazioneRischioCV} esami={esamiEmatici} />
    {/if}

    <!-- Ecocardiografia (solo per Ambulatorio Dislipidemie) -->
    {#if isBlockVisibleForAmbulatorio('ecocardiografia', ambulatorioId)}
      <Ecocardiografia bind:eco={ecocardiografia} />
    {/if}

    <!-- Conclusioni -->
    <Conclusioni bind:conclusioni={conclusioni} bind:pianificazioneFollowUp={pianificazioneFollowUp} />

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

<!-- Modal Selezione Paziente -->
{#if showPatientModal}
  <div class="modal-overlay" on:click={() => (showPatientModal = false)}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Seleziona Paziente</h2>
        <button class="close-btn" on:click={() => (showPatientModal = false)}>×</button>
      </div>
      <div class="modal-body">
        <div class="search-box">
          <input
            type="text"
            bind:value={searchTerm}
            placeholder="Cerca per nome, cognome o codice fiscale..."
          />
        </div>
        <div class="patient-table-container">
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
                  <tr class="patient-row" on:click={() => selectPaziente(paziente)}>
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
      </div>
    </div>
  </div>
{/if}

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

  .patient-start-screen {
    min-height: 62vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-8) 0;
  }

  .patient-start-content {
    width: min(100%, 860px);
    padding: clamp(2rem, 5vw, 4rem);
    border: 1px solid rgba(30, 58, 138, 0.12);
    border-radius: 28px;
    background:
      radial-gradient(circle at top right, rgba(30, 58, 138, 0.08), transparent 32%),
      linear-gradient(135deg, #ffffff 0%, rgba(241, 245, 249, 0.9) 100%);
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
    text-align: center;
  }

  .patient-start-kicker {
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-primary);
  }

  .patient-start-title {
    margin: 0;
    font-size: clamp(2rem, 4vw, 3rem);
    line-height: 1.1;
    color: var(--color-text-primary);
  }

  .patient-start-description {
    max-width: 620px;
    margin: var(--space-4) auto 0;
    font-size: var(--text-lg);
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .patient-start-actions {
    margin-top: clamp(1.75rem, 4vw, 3rem);
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(1rem, 3vw, 1.5rem);
  }

  .patient-start-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    min-height: 250px;
    padding: clamp(1.5rem, 3vw, 2.25rem);
    border: 1px solid rgba(30, 58, 138, 0.12);
    border-radius: 24px;
    background: #ffffff;
    color: var(--color-text-primary);
    cursor: pointer;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease,
      border-color 0.2s ease;
  }

  .patient-start-button:hover {
    transform: translateY(-4px);
    border-color: rgba(30, 58, 138, 0.28);
    box-shadow: 0 20px 32px rgba(15, 23, 42, 0.08);
  }

  .patient-start-button .icon {
    width: 96px;
    height: 96px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: rgba(30, 58, 138, 0.08);
    color: var(--color-primary);
  }

  .patient-start-button-secondary .icon {
    background: rgba(16, 185, 129, 0.1);
    color: var(--color-success);
  }

  .patient-start-button-title {
    font-size: clamp(1.35rem, 2vw, 1.75rem);
    font-weight: 700;
    line-height: 1.2;
  }

  .patient-start-button-text {
    max-width: 280px;
    font-size: var(--text-base);
    line-height: 1.6;
    color: var(--color-text-secondary);
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

  .patient-lookup-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .patient-lookup-field {
    margin-bottom: 0;
  }

  .patient-lookup-field input {
    width: 100%;
    height: 34px;
    padding: var(--space-1) var(--space-4);
    font-size: var(--text-base);
    font-family: var(--font-sans);
    color: var(--color-text);
    background-color: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    transition: all var(--transition-fast);
    box-sizing: border-box;
  }

  .patient-lookup-field input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1);
  }

  .patient-suggestions-panel {
    margin-top: var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-secondary);
    overflow: hidden;
  }

  .patient-suggestions-list {
    display: flex;
    flex-direction: column;
  }

  .patient-suggestion {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-3) var(--space-4);
    border: none;
    border-bottom: 1px solid var(--color-border);
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s;
  }

  .patient-suggestion:last-child {
    border-bottom: none;
  }

  .patient-suggestion:hover {
    background: rgba(30, 58, 138, 0.06);
  }

  .patient-suggestion-name {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .patient-suggestion-meta {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  .patient-lookup-hint {
    margin: var(--space-4) 0 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: #ffffff !important;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    width: 90%;
    max-width: 900px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-6);
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h2 {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .close-btn {
    background: none !important;
    border: none !important;
    font-size: var(--text-3xl);
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0 !important;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--color-bg-secondary) !important;
    color: var(--color-text-primary);
    border: none !important;
  }

  .modal-body {
    padding: var(--space-6);
    overflow-y: auto;
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

    .patient-start-screen {
      min-height: auto;
      padding: var(--space-4) 0 var(--space-6);
    }

    .patient-start-content {
      padding: var(--space-6);
      border-radius: 22px;
    }

    .patient-start-actions {
      grid-template-columns: 1fr;
    }

    .patient-start-button {
      min-height: 200px;
    }

    .form-row,
    .patient-lookup-grid,
    .patient-info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { Paziente, CreatePazienteInput } from '$lib/db/types';
  import { createPaziente, updatePaziente } from '$lib/db/pazienti';
  import Button from './Button.svelte';
  import Input from './Input.svelte';
  import Select from './Select.svelte';
  import Autocomplete from './Autocomplete.svelte';
  import Modal from './Modal.svelte';
  import { calcolaCodiceFiscale } from '$lib/utils/codiceFiscale';
  import type { AutocompleteItem } from '$lib/types/autocomplete';

  export let isOpen = false;
  export let paziente: Paziente | null = null;
  export let ambulatorioId: number;

  const dispatch = createEventDispatcher();

  // Dati per autocomplete
  let comuniData: AutocompleteItem[] = [];
  let statiData: AutocompleteItem[] = [];

  // Codici catastali per il calcolo CF
  let codiceCatastaleNascita = '';

  // Checkbox per esenzione
  let nessunaEsenzione = true;

  // Form fields
  let formData: CreatePazienteInput = {
    ambulatorio_id: ambulatorioId,
    nome: '',
    cognome: '',
    data_nascita: '',
    luogo_nascita: '',
    codice_fiscale: '',
    sesso: 'M',
    esenzioni: '',
    indirizzo: '',
    citta: '',
    cap: '',
    provincia: '',
    telefono: '',
    email: ''
  };

  let formErrors: Record<string, string> = {};

  // Calcola automaticamente il codice fiscale quando tutti i dati sono disponibili
  $: {
    if (formData.nome && formData.cognome && formData.data_nascita && formData.sesso && codiceCatastaleNascita) {
      const cf = calcolaCodiceFiscale({
        nome: formData.nome,
        cognome: formData.cognome,
        dataNascita: formData.data_nascita,
        sesso: formData.sesso,
        codiceComuneNascita: codiceCatastaleNascita
      });
      if (cf) {
        formData.codice_fiscale = cf;
      }
    }
  }

  // Aggiorna formData quando cambia il paziente
  $: if (isOpen && paziente) {
    nessunaEsenzione = !paziente.esenzioni || paziente.esenzioni.toLowerCase() === 'nessuno';
    formData = {
      ambulatorio_id: paziente.ambulatorio_id,
      nome: paziente.nome,
      cognome: paziente.cognome,
      data_nascita: paziente.data_nascita,
      luogo_nascita: paziente.luogo_nascita,
      codice_fiscale: paziente.codice_fiscale,
      sesso: paziente.sesso,
      esenzioni: (paziente.esenzioni && paziente.esenzioni.toLowerCase() !== 'nessuno') ? paziente.esenzioni : '',
      indirizzo: paziente.indirizzo || '',
      citta: paziente.citta || '',
      cap: paziente.cap || '',
      provincia: paziente.provincia || '',
      telefono: paziente.telefono || '',
      email: paziente.email || ''
    };
    formErrors = {};
  } else if (isOpen && !paziente) {
    nessunaEsenzione = true;
    formData = {
      ambulatorio_id: ambulatorioId,
      nome: '',
      cognome: '',
      data_nascita: '',
      luogo_nascita: '',
      codice_fiscale: '',
      sesso: 'M',
      esenzioni: '',
      indirizzo: '',
      citta: '',
      cap: '',
      provincia: '',
      telefono: '',
      email: ''
    };
    formErrors = {};
  }

  onMount(async () => {
    try {
      // Carica dati comuni e stati
      const [comuniResponse, statiResponse] = await Promise.all([
        fetch('/comuni.json'),
        fetch('/stati.json')
      ]);
      comuniData = await comuniResponse.json();
      statiData = await statiResponse.json();
    } catch (error) {
      console.error('Errore caricamento dati:', error);
    }
  });

  function validateForm(): boolean {
    formErrors = {};

    if (!formData.nome.trim()) formErrors.nome = 'Nome obbligatorio';
    if (!formData.cognome.trim()) formErrors.cognome = 'Cognome obbligatorio';
    if (!formData.data_nascita) formErrors.data_nascita = 'Data di nascita obbligatoria';
    if (!formData.luogo_nascita.trim()) formErrors.luogo_nascita = 'Luogo di nascita obbligatorio';
    if (!formData.codice_fiscale.trim()) formErrors.codice_fiscale = 'Codice fiscale obbligatorio';

    // Validazione codice fiscale (16 caratteri)
    if (formData.codice_fiscale.length !== 16) {
      formErrors.codice_fiscale = 'Il codice fiscale deve essere di 16 caratteri';
    }

    return Object.keys(formErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) return;

    try {
      let newPaziente;
      if (paziente) {
        await updatePaziente({ ...formData, id: paziente.id });
        newPaziente = { ...paziente, ...formData };
      } else {
        const id = await createPaziente(formData);
        newPaziente = { ...formData, id };
      }
      dispatch('submit', newPaziente);
      isOpen = false;
    } catch (error) {
      console.error('Errore salvataggio paziente:', error);
    }
  }

  function handleClose() {
    dispatch('close');
    isOpen = false;
  }

  const sessoOptions = [
    { value: 'M', label: 'Maschio' },
    { value: 'F', label: 'Femmina' },
    { value: 'Altro', label: 'Altro' }
  ];
</script>

<Modal bind:open={isOpen} title={paziente ? 'Modifica Paziente' : 'Nuovo Paziente'} size="lg" on:close={handleClose}>
  <form on:submit|preventDefault={handleSubmit} class="paziente-form">
    <div class="form-row">
      <div class="form-col">
        <Input
          id="nome"
          label="Nome"
          bind:value={formData.nome}
          error={formErrors.nome}
          format="capitalize"
          required
        />
      </div>
      <div class="form-col">
        <Input
          id="cognome"
          label="Cognome"
          bind:value={formData.cognome}
          error={formErrors.cognome}
          format="capitalize"
          required
        />
      </div>
    </div>

    <div class="form-row">
      <div class="form-col">
        <Input
          id="data_nascita"
          type="date"
          label="Data di Nascita"
          bind:value={formData.data_nascita}
          error={formErrors.data_nascita}
          required
        />
      </div>
      <div class="form-col">
        <Autocomplete
          id="luogo_nascita"
          label="Luogo di Nascita"
          bind:value={formData.luogo_nascita}
          items={[...comuniData, ...statiData]}
          placeholder="Scrivi almeno 3 caratteri..."
          error={formErrors.luogo_nascita}
          minChars={3}
          onSelect={(item: AutocompleteItem) => { codiceCatastaleNascita = item.codiceCatastale; }}
          required
        />
      </div>
    </div>

    <div class="form-row">
      <div class="form-col">
        <Input
          id="codice_fiscale"
          label="Codice Fiscale"
          bind:value={formData.codice_fiscale}
          error={formErrors.codice_fiscale}
          placeholder="RSSMRA80E15H501Z"
          format="uppercase"
          required
        />
      </div>
      <div class="form-col">
        <Select
          id="sesso"
          label="Sesso"
          bind:value={formData.sesso}
          options={sessoOptions}
          required
        />
      </div>
    </div>

    <div class="form-row">
      <div class="form-col">
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={nessunaEsenzione} on:change={() => {
              if (nessunaEsenzione) {
                formData.esenzioni = '';
              }
            }} />
            <span>Nessuna esenzione</span>
          </label>
        </div>
        {#if !nessunaEsenzione}
          <Input
            id="esenzioni"
            label="Codice Esenzione"
            bind:value={formData.esenzioni}
            placeholder="E01, E02, etc."
            required
          />
        {/if}
      </div>
    </div>

    <h3 class="form-section-title">Residenza</h3>

    <div class="form-row">
      <div class="form-col-full">
        <Input
          id="indirizzo"
          label="Indirizzo"
          bind:value={formData.indirizzo}
          placeholder="Via/Piazza..."
        />
      </div>
    </div>

    <div class="form-row">
      <div class="form-col">
        <Autocomplete
          id="citta"
          label="Città"
          bind:value={formData.citta}
          items={comuniData}
          placeholder="Scrivi almeno 3 caratteri..."
          minChars={3}
        />
      </div>
      <div class="form-col-sm">
        <Input
          id="cap"
          label="CAP"
          bind:value={formData.cap}
          placeholder="00100"
        />
      </div>
      <div class="form-col-sm">
        <Input
          id="provincia"
          label="Provincia"
          bind:value={formData.provincia}
          placeholder="RM"
          format="uppercase"
        />
      </div>
    </div>

    <h3 class="form-section-title">Contatti</h3>

    <div class="form-row">
      <div class="form-col">
        <Input
          id="telefono"
          type="tel"
          label="Telefono"
          bind:value={formData.telefono}
          placeholder="+39 ..."
        />
      </div>
      <div class="form-col">
        <Input
          id="email"
          type="email"
          label="Email"
          bind:value={formData.email}
          placeholder="email@esempio.it"
        />
      </div>
    </div>
  </form>

  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={handleClose}>
      Annulla
    </Button>
    <Button variant="primary" on:click={handleSubmit}>
      {paziente ? 'Salva Modifiche' : 'Crea Paziente'}
    </Button>
  </svelte:fragment>
</Modal>

<style>
  .paziente-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
  }

  .form-col {
    display: flex;
    flex-direction: column;
  }

  .form-col-full {
    grid-column: 1 / -1;
  }

  .form-col-sm {
    grid-column: span 1;
  }

  .form-section-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text);
    margin: var(--space-4) 0 0 0;
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .checkbox-group {
    margin-bottom: var(--space-3);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    font-size: var(--text-sm);
    color: var(--color-text);
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }

    .form-col-sm {
      grid-column: 1;
    }
  }
</style>

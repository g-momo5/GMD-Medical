<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth';
  import { ambulatorioStore } from '$lib/stores/ambulatorio';
  import { initDatabase } from '$lib/db/schema';
  import '../app.css';

  onMount(async () => {
    // Inizializza database
    try {
      await initDatabase();
      console.log('Database inizializzato con successo');
    } catch (error) {
      console.error('Errore inizializzazione database:', error);
    }

    // Ripristina sessione utente
    authStore.restore();
    ambulatorioStore.restore();
  });
</script>

<div class="app">
  <slot />
</div>

<style>
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding-top: 0px; /* Spazio per la titlebar macOS */
    overflow-y: auto; /* Lo scroll avviene qui, non sul body */
    overflow-x: hidden;
    box-sizing: border-box;
  }
</style>

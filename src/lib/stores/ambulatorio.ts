// GMD Medical Platform - Ambulatorio Store
import { writable } from 'svelte/store';
import type { Ambulatorio } from '$lib/db/types';

interface AmbulatorioState {
  current: Ambulatorio | null;
}

function createAmbulatorioStore() {
  const { subscribe, set, update } = writable<AmbulatorioState>({
    current: null
  });

  return {
    subscribe,
    select: (ambulatorio: Ambulatorio) => {
      set({ current: ambulatorio });

      // Applica tema
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--color-primary', ambulatorio.color_primary);
        document.documentElement.style.setProperty('--color-secondary', ambulatorio.color_secondary);
        document.documentElement.style.setProperty('--color-accent', ambulatorio.color_accent);
      }

      // Salva in sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('gmd_ambulatorio', JSON.stringify(ambulatorio));
      }
    },
    clear: () => {
      set({ current: null });
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('gmd_ambulatorio');
      }
    },
    restore: () => {
      if (typeof window !== 'undefined') {
        const stored = sessionStorage.getItem('gmd_ambulatorio');
        if (stored) {
          const ambulatorio = JSON.parse(stored);
          set({ current: ambulatorio });

          // Riapplica tema
          if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--color-primary', ambulatorio.color_primary);
            document.documentElement.style.setProperty('--color-secondary', ambulatorio.color_secondary);
            document.documentElement.style.setProperty('--color-accent', ambulatorio.color_accent);
          }
        }
      }
    }
  };
}

export const ambulatorioStore = createAmbulatorioStore();

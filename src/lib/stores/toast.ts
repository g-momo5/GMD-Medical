// GMD Medical Platform - Toast Notifications Store
import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  dismissing?: boolean;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  const show = (type: ToastType, message: string, duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9);
    const toast: Toast = { id, type, message, duration, dismissing: false };

    update(toasts => [...toasts, toast]);

    if (duration > 0) {
      setTimeout(() => {
        // Mark as dismissing to trigger animation
        update(toasts => toasts.map(t => t.id === id ? { ...t, dismissing: true } : t));
        // Remove after animation completes (300ms)
        setTimeout(() => {
          update(toasts => toasts.filter(t => t.id !== id));
        }, 300);
      }, duration);
    }

    return id;
  };

  return {
    subscribe,
    show,
    dismiss: (id: string) => {
      // Mark as dismissing to trigger animation
      update(toasts => toasts.map(t => t.id === id ? { ...t, dismissing: true } : t));
      // Remove after animation completes (300ms)
      setTimeout(() => {
        update(toasts => toasts.filter(t => t.id !== id));
      }, 300);
    },
    success: (message: string, duration?: number) => {
      return show('success', message, duration);
    },
    error: (message: string, duration?: number) => {
      return show('error', message, duration);
    },
    warning: (message: string, duration?: number) => {
      return show('warning', message, duration);
    },
    info: (message: string, duration?: number) => {
      return show('info', message, duration);
    }
  };
}

export const toastStore = createToastStore();

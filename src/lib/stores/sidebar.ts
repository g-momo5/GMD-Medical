import { writable } from 'svelte/store';

export const sidebarCollapsedStore = writable<boolean>(false);

import { createContext, useContext, useSyncExternalStore } from 'react';
import { openRepo } from '../storage/repo';
import { tabChannel } from './channel';
import { createStore, type AppState, type Store } from './store';

export const StoreContext = createContext<Store>(createStore(() => openRepo(), tabChannel()));
export const useStore = (): Store => useContext(StoreContext);

/** Select a piece of the state. Return something already in the state (not a new array or object). */
export function useApp<T>(select: (s: AppState) => T): T {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}

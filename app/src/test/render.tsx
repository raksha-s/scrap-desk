import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createStore, type Store } from '../state/store';
import { StoreContext } from '../state/useApp';
import { memoryRepo } from '../storage/memory';
import type { Repo } from '../storage/repo';

export async function readyStore(repo: Repo = memoryRepo()): Promise<Store> {
  const store = createStore(async () => repo);
  await store.init(); await store.flush();
  return store;
}
export const renderWith = (store: Store, ui: ReactNode) => render(<StoreContext.Provider value={store}>{ui}</StoreContext.Provider>);

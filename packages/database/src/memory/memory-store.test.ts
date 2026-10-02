import { InMemoryContentStore } from './memory-store';
import { describeContentStoreContract } from '../testing/store-contract';

describeContentStoreContract('in-memory', () => {
  let store = new InMemoryContentStore();
  return Promise.resolve({
    store: () => store,
    reset: () => {
      store = new InMemoryContentStore();
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  });
});

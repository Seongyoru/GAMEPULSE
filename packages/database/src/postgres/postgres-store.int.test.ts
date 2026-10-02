import { PostgresContentStore } from './postgres-store';
import { createTestDatabase } from '../testing/test-database';
import { describeContentStoreContract } from '../testing/store-contract';

describeContentStoreContract(process.env.TEST_DATABASE_URL ? 'postgresql' : 'postgresql (PGlite)', async () => {
  const database = await createTestDatabase();
  const store = new PostgresContentStore(database.db);
  return {
    store: () => store,
    reset: () => database.reset(),
    close: () => database.close(),
  };
});

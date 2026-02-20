import { configureRepositories, getLocalRepositories } from '@/src/data/repositories';

let initialized = false;

export const initializeDataLayer = () => {
  if (initialized) return;

  // Local-first architecture: repositories always write/read local DB.
  // Remote providers are used by the sync engine, not as direct repositories.
  configureRepositories(getLocalRepositories());
  initialized = true;
};

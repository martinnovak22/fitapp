import { DataRepositories } from '@/src/data/repositories';

export type DataMode = 'local' | 'remote';

export interface RemoteDataProvider extends DataRepositories {
  name: string;
  healthcheck?: () => Promise<void>;
}

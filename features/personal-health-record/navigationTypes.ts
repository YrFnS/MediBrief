import type { PersonalHealthDataModule } from './planningModuleTypes';

export type PersonalHealthDataArea =
    | 'record'
    | 'medications'
    | 'results'
    | 'care'
    | 'documents'
    | 'manage';

export interface PersonalHealthDataNavigationIntent {
    area: PersonalHealthDataArea;
    module: PersonalHealthDataModule;
}

export interface PersonalHealthDataNavigationTarget
    extends PersonalHealthDataNavigationIntent {
    requestId: number;
}

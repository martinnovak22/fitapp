import { createCachedExerciseRepository } from '@/src/data/exercisesCache'
import { type Exercise, type ExerciseDetails, ExerciseRepository, type ExerciseUpdate } from '@/src/db/exercises'
import {
    type HistorySet,
    type SetData,
    type SetSummaryRow,
    type SetWithExerciseName,
    type Workout,
    WorkoutRepository,
} from '@/src/db/workouts'
import { type WorkoutTemplate, type WorkoutTemplateInput, WorkoutTemplateRepository } from '@/src/db/workoutTemplates'

export interface ExerciseRepositoryPort {
    getAll: () => Promise<Exercise[]>
    getById: (id: number) => Promise<Exercise | null>
    create: (name: string, type: Exercise['type'], details?: ExerciseDetails) => Promise<number>
    update: (id: number, data: ExerciseUpdate) => Promise<void>
    updatePositions: (updates: { id: number; position: number }[]) => Promise<void>
    delete: (id: number) => Promise<void>
}

export interface WorkoutRepositoryPort {
    create: (date: string, templateUuid?: string | null) => Promise<number>
    finish: (id: number) => Promise<void>
    delete: (id: number) => Promise<void>
    getById: (id: number) => Promise<Workout | null>
    getActiveWorkout: () => Promise<Workout | null>
    getAllWorkouts: () => Promise<Workout[]>
    getWorkoutsForDate: (date: string) => Promise<Workout[]>
    getWorkoutsForPeriod: (startDate: string, endDate: string) => Promise<Workout[]>
    getRecentWorkouts: (limit?: number) => Promise<Workout[]>
    addSet: (workoutId: number, exerciseId: number, data: SetData) => Promise<void>
    updateSet: (setId: number, data: SetData) => Promise<void>
    deleteSet: (setId: number) => Promise<void>
    getSets: (workoutId: number) => Promise<SetWithExerciseName[]>
    getSetExercises: (workoutId: number) => Promise<Exercise[]>
    getFinishedExerciseSets: (exerciseIds: readonly number[], excludeWorkoutId: number) => Promise<HistorySet[]>
    getAllSetRows: () => Promise<SetSummaryRow[]>
    getWorkoutCountForMonth: (month: string) => Promise<number>
    getAvgWorkoutDuration: (month: string) => Promise<number>
    updateTiming: (id: number, date: string, startTime: string, endTime?: string) => Promise<void>
}

export interface WorkoutTemplateRepositoryPort {
    getAll: () => Promise<WorkoutTemplate[]>
    getById: (id: number) => Promise<WorkoutTemplate | null>
    getByUuid: (uuid: string) => Promise<WorkoutTemplate | null>
    create: (input: WorkoutTemplateInput) => Promise<number>
    update: (id: number, input: Partial<WorkoutTemplateInput>) => Promise<number>
    delete: (id: number) => Promise<void>
}

export interface DataRepositories {
    exercises: ExerciseRepositoryPort
    workouts: WorkoutRepositoryPort
    templates: WorkoutTemplateRepositoryPort
}

const localRepositories: DataRepositories = {
    exercises: createCachedExerciseRepository(ExerciseRepository),
    workouts: WorkoutRepository,
    templates: WorkoutTemplateRepository,
}

let activeRepositories: DataRepositories = localRepositories

export const getRepositories = (): DataRepositories => activeRepositories

export const configureRepositories = (repositories: Partial<DataRepositories>) => {
    activeRepositories = {
        ...activeRepositories,
        ...repositories,
    }
}

export const getLocalRepositories = (): DataRepositories => localRepositories

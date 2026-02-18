import { Exercise, ExerciseRepository } from '@/src/db/exercises';
import { ExerciseHistory, SetData, SetWithExerciseName, Workout, WorkoutRepository } from '@/src/db/workouts';

export interface ExerciseRepositoryPort {
    getAll: () => Promise<Exercise[]>;
    getById: (id: number) => Promise<Exercise | null>;
    create: (name: string, type: Exercise['type'], muscle_group?: string, photo_uri?: string) => Promise<number>;
    update: (id: number, data: Partial<Exercise>) => Promise<void>;
    updatePositions: (updates: { id: number; position: number }[]) => Promise<void>;
    delete: (id: number) => Promise<void>;
}

export interface WorkoutRepositoryPort {
    create: (date: string) => Promise<number>;
    finish: (id: number) => Promise<void>;
    delete: (id: number) => Promise<void>;
    getById: (id: number) => Promise<Workout | null>;
    getActiveWorkout: () => Promise<Workout | null>;
    getAllWorkouts: () => Promise<Workout[]>;
    getWorkoutsForDate: (date: string) => Promise<Workout[]>;
    getWorkoutsForPeriod: (startDate: string, endDate: string) => Promise<Workout[]>;
    getRecentWorkouts: (limit?: number) => Promise<Workout[]>;
    addSet: (workoutId: number, exerciseId: number, data: SetData) => Promise<void>;
    updateSet: (setId: number, data: SetData) => Promise<void>;
    deleteSet: (setId: number) => Promise<void>;
    updateSetPosition: (setId: number, position: number) => Promise<void>;
    getSets: (workoutId: number) => Promise<SetWithExerciseName[]>;
    getExerciseHistory: (exerciseId: number) => Promise<ExerciseHistory[]>;
    getWorkoutCountForMonth: (month: string) => Promise<number>;
    getAvgWorkoutDuration: (month: string) => Promise<number>;
}

export interface DataRepositories {
    exercises: ExerciseRepositoryPort;
    workouts: WorkoutRepositoryPort;
}

const localRepositories: DataRepositories = {
    exercises: ExerciseRepository,
    workouts: WorkoutRepository,
};

let activeRepositories: DataRepositories = localRepositories;

export const getRepositories = (): DataRepositories => activeRepositories;

export const configureRepositories = (repositories: Partial<DataRepositories>) => {
    activeRepositories = {
        ...activeRepositories,
        ...repositories,
    };
};

export const resetRepositories = () => {
    activeRepositories = localRepositories;
};

export const getLocalRepositories = (): DataRepositories => localRepositories;

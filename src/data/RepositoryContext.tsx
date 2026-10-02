import { createContext, type ReactNode, useContext, useRef } from 'react'
import {
    type DataRepositories,
    type ExerciseRepositoryPort,
    getRepositories,
    type WorkoutRepositoryPort,
    type WorkoutTemplateRepositoryPort,
} from '@/src/data/repositories'

const RepositoryContext = createContext<DataRepositories | null>(null)

export function RepositoryProvider({ children }: { children: ReactNode }) {
    const repos = useRef(getRepositories()).current
    return <RepositoryContext.Provider value={repos}>{children}</RepositoryContext.Provider>
}

export function useWorkoutRepo(): WorkoutRepositoryPort {
    const ctx = useContext(RepositoryContext)
    if (!ctx) throw new Error('useWorkoutRepo must be used within a RepositoryProvider')
    return ctx.workouts
}

export function useExerciseRepo(): ExerciseRepositoryPort {
    const ctx = useContext(RepositoryContext)
    if (!ctx) throw new Error('useExerciseRepo must be used within a RepositoryProvider')
    return ctx.exercises
}

export function useWorkoutTemplateRepo(): WorkoutTemplateRepositoryPort {
    const ctx = useContext(RepositoryContext)
    if (!ctx) throw new Error('useWorkoutTemplateRepo must be used within a RepositoryProvider')
    return ctx.templates
}

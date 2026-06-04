import { useLocalSearchParams } from 'expo-router'
import { ExerciseFormScreen } from '@/src/modules/exercises/screens/AddExerciseScreen'

export default function EditExerciseRoute() {
    const { id } = useLocalSearchParams<{ id: string }>()
    const exerciseId = Number(id)

    return <ExerciseFormScreen mode="edit" exerciseId={Number.isFinite(exerciseId) ? exerciseId : undefined} />
}

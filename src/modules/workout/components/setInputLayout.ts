import type { SetFormValues } from '../setPayload'

// Which numeric field a cell binds to in the set form.
export type SetFieldKey = keyof SetFormValues

export type SetInputField = {
    key: SetFieldKey
    labelKey: string
    placeholder: string
    returnKey: 'next' | 'done'
    minWidth: `${number}%`
}

// The full set of fields to render for a given exercise type: standalone cells
// plus an optional two-cell duration row. Pure so the layout matrix is tested
// directly and SetInputFields can render without branching.
export type SetInputLayout = {
    fields: SetInputField[]
    duration: { minWidth: `${number}%`; fields: SetInputField[] } | null
}

export const resolveSetInputLayout = (type: string | undefined): SetInputLayout => {
    const fields: SetInputField[] = []

    if (type !== 'cardio') {
        fields.push({
            key: 'weight',
            labelKey: 'weightKg',
            placeholder: '0',
            returnKey: 'next',
            minWidth: type === 'bodyweight_timer' ? '100%' : '46%',
        })
    }

    if (type === 'weight' || type === 'bodyweight') {
        fields.push({ key: 'reps', labelKey: 'reps', placeholder: '0', returnKey: 'done', minWidth: '46%' })
    }

    if (type === 'cardio') {
        fields.push({ key: 'distance', labelKey: 'distM', placeholder: '0', returnKey: 'next', minWidth: '100%' })
    }

    let duration: SetInputLayout['duration'] = null
    if (type === 'cardio' || type === 'bodyweight_timer') {
        duration = {
            minWidth: type === 'cardio' ? '65%' : '100%',
            fields: [
                { key: 'durationMinutes', labelKey: 'minutes', placeholder: '00', returnKey: 'next', minWidth: '100%' },
                { key: 'durationSeconds', labelKey: 'seconds', placeholder: '00', returnKey: 'done', minWidth: '100%' },
            ],
        }
    }

    return { fields, duration }
}

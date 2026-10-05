// A tiny pub/sub so whatever starts, finishes or deletes a Workout can tell
// listeners (the Workout tab's running dot) to re-read the Active Workout,
// without the screens knowing who listens.

type Listener = () => void

const listeners = new Set<Listener>()

export const notifyActiveWorkoutChanged = () => {
    for (const listener of listeners) listener()
}

export const onActiveWorkoutChanged = (listener: Listener) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

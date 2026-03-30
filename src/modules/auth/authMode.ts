export const isRemoteDataMode = (): boolean => {
    const mode = (process.env.EXPO_PUBLIC_DATA_MODE ?? 'remote').toLowerCase()
    return mode !== 'local'
}

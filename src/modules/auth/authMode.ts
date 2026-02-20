export const isRemoteDataMode = (): boolean => process.env.EXPO_PUBLIC_DATA_MODE?.toLowerCase() === 'remote'

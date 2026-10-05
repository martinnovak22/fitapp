import { StyleSheet } from 'react-native'
import { Spacing } from './Spacing'

export const GlobalStyles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: Spacing.md,
    },
    card: {
        padding: Spacing.md,
        borderRadius: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
    },
})

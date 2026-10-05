import { StyleSheet } from 'react-native'
import { Spacing } from './Spacing'
import { FontSize, FontWeight } from './Typography'

export const GlobalStyles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: Spacing.md,
    },
    subtitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
    },
    card: {
        padding: Spacing.md,
        borderRadius: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
    },
    text: {
        fontSize: FontSize.md,
    },
})

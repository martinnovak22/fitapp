import { StyleSheet } from 'react-native';
import { Theme } from './Colors';
import { Spacing } from './Spacing';

export const GlobalStyles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: Spacing.md,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: Spacing.md,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: Spacing.sm,
    },
    card: {
        padding: Spacing.md,
        borderRadius: Spacing.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
    },
    text: {
        fontSize: 16,
    },
    input: {
        padding: Spacing.md,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: Spacing.md,
    },
    fab: {
        position: 'absolute',
        right: Spacing.lg,
        bottom: Spacing.lg,
        backgroundColor: Theme.primary,
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.27,
        shadowRadius: 4.65,
    }
});

import { StyleSheet } from 'react-native';
import { Theme } from './Colors';

export const GlobalStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.background,
        padding: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Theme.text,
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Theme.textSecondary,
        marginBottom: 8,
    },
    card: {
        backgroundColor: Theme.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    text: {
        color: Theme.text,
        fontSize: 16,
    },
    input: {
        backgroundColor: Theme.surface,
        color: Theme.text,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Theme.border,
        marginBottom: 12,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 30,
        backgroundColor: Theme.tint,
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

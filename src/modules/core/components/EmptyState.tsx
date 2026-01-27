import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

interface EmptyStateProps {
    message: string;
    subMessage?: string;
    icon?: keyof typeof FontAwesome.glyphMap;
    style?: StyleProp<ViewStyle>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    message,
    subMessage,
    icon,
    style
}) => {
    return (
        <View style={[styles.container, style]}>
            {icon && (
                <FontAwesome
                    name={icon}
                    size={40}
                    color={Theme.textSecondary}
                    style={styles.icon}
                />
            )}
            <Text style={styles.message}>{message}</Text>
            {subMessage && <Text style={styles.subMessage}>{subMessage}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    icon: {
        marginBottom: 16,
    },
    message: {
        ...GlobalStyles.text,
        color: Theme.textSecondary,
        textAlign: 'center',
        fontWeight: '500',
    },
    subMessage: {
        ...GlobalStyles.text,
        color: Theme.textSecondary,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
        opacity: 0.7,
    },
});

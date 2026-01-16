import { Theme } from '@/src/constants/Colors';
import { GlobalStyles } from '@/src/constants/Styles';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ScreenHeaderProps {
    title: string;
    onDelete?: () => void;
    rightAction?: {
        label: string;
        onPress: () => void;
        color?: string; // Defaults to Theme.secondary
    };
    /* Optional content to render on the right if rightAction is not enough */
    rightElement?: React.ReactNode;
}

export const ScreenHeader = ({ title, onDelete, rightAction, rightElement }: ScreenHeaderProps) => {
    return (
        <View style={styles.container}>
            <Text style={[GlobalStyles.title, { flex: 1, marginBottom: 0 }]} numberOfLines={1}>
                {title}
            </Text>

            <View style={styles.actions}>
                {/* Delete Button (Icon) */}
                {onDelete && (
                    <TouchableOpacity onPress={onDelete} style={styles.iconButton}>
                        <FontAwesome name="trash" size={24} color={Theme.error} />
                    </TouchableOpacity>
                )}

                {/* Right Text Action (e.g. Finish) */}
                {rightAction && (
                    <TouchableOpacity onPress={rightAction.onPress} style={styles.textButton}>
                        <Text style={[styles.actionText, { color: rightAction.color || Theme.secondary }]}>
                            {rightAction.label}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Custom Right Element */}
                {rightElement}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        gap: 16,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    iconButton: {
        padding: 4,
    },
    textButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    actionText: {
        fontWeight: 'bold',
        fontSize: 16,
    }
});

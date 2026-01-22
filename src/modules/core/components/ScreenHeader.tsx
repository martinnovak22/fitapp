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
    };
}

export const ScreenHeader = ({ title, onDelete, rightAction }: ScreenHeaderProps) => {
    return (
        <View style={styles.container}>
            <Text style={[GlobalStyles.title, { flex: 1, marginBottom: 0 }]} numberOfLines={1}>
                {title}
            </Text>

            <View style={styles.actions}>
                {rightAction && (
                    <TouchableOpacity onPress={rightAction.onPress} style={styles.textButton}>
                        <Text style={[styles.actionText]}>
                            {rightAction.label}
                        </Text>
                    </TouchableOpacity>
                )}

                {onDelete && (
                    <TouchableOpacity onPress={onDelete} style={styles.iconButton}>
                        <FontAwesome name="trash" size={24} color={Theme.error} />
                    </TouchableOpacity>
                )}
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
        backgroundColor: Theme.primary,
    },
    actionText: {
        fontWeight: 'bold',
        fontSize: 16,
        color: "#fff",
    }
});

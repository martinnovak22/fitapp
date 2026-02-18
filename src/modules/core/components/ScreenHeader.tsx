import { Spacing } from '@/src/constants/Spacing';
import { GlobalStyles } from '@/src/constants/Styles';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';


interface ScreenHeaderProps {
    title: string;
    onDelete?: () => void;
    rightAction?: {
        label: string;
        onPress: () => void;
    };
}

export const ScreenHeader = ({ title, onDelete, rightAction }: ScreenHeaderProps) => {
    const { theme } = useTheme();
    const { t } = useTranslation();
    return (
        <View style={styles.container}>
            <Text style={[GlobalStyles.title, { color: theme.text, flex: 1, marginBottom: 0 }]} numberOfLines={1}>
                {title}
            </Text>

            <View style={styles.actions}>
                {rightAction && (
                    <TouchableOpacity
                        onPress={rightAction.onPress}
                        style={[styles.textButton, { backgroundColor: theme.primary }]}
                        accessibilityRole={"button"}
                        accessibilityLabel={rightAction.label}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                        <Text style={[styles.actionText, { color: theme.onPrimary }]} allowFontScaling={true}>
                            {rightAction.label}
                        </Text>
                    </TouchableOpacity>
                )}

                {onDelete && (
                    <TouchableOpacity
                        onPress={onDelete}
                        style={styles.iconButton}
                        accessibilityRole={"button"}
                        accessibilityLabel={t('delete')}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                        <FontAwesome name={"trash"} size={24} color={theme.error} />
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
        paddingVertical: Spacing.md,
        gap: Spacing.md,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    iconButton: {
        padding: Spacing.xs,
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textButton: {
        paddingVertical: 6,
        paddingHorizontal: Spacing.md,
        borderRadius: Spacing.sm,
        minHeight: 44,
        justifyContent: 'center',
    },
    actionText: {
        fontWeight: 'bold',
        fontSize: 16,
    }
});

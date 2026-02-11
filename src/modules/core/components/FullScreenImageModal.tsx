import { Spacing } from '@/src/constants/Spacing';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Portal } from 'react-native-teleport';
import { useTheme } from '../hooks/useTheme';

interface FullScreenImageModalProps {
    visible: boolean;
    onClose: () => void;
    imageUri: string | null;
}

export const FullScreenImageModal: React.FC<FullScreenImageModalProps> = ({ visible, onClose, imageUri }) => {
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();

    if (!visible || !imageUri) return null;

    return (
        <Portal hostName="overlay">
            <View style={[styles.container, { backgroundColor: theme.overlayScrim }]}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                <Image source={{ uri: imageUri }} style={styles.image} />
                <TouchableOpacity
                    onPress={onClose}
                    style={[
                        styles.closeButton,
                        {
                            top: insets.top + Spacing.sm,
                            right: Spacing.sm,
                            backgroundColor: theme.surfaceMuted,
                        }
                    ]}
                >
                    <FontAwesome name={"close"} size={20} color={theme.error} />
                </TouchableOpacity>
            </View>
        </Portal>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
    },
    closeButton: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
});

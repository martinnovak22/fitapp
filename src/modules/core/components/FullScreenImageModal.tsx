import { Spacing } from '@/src/constants/Spacing';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { Image, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FullScreenImageModalProps {
    visible: boolean;
    onClose: () => void;
    imageUri: string | null;
}

export const FullScreenImageModal: React.FC<FullScreenImageModalProps> = ({ visible, onClose, imageUri }) => {
    const insets = useSafeAreaInsets();

    if (!imageUri) return null;

    return (
        <Modal
            visible={visible}
            onRequestClose={onClose}
            animationType="fade"
            transparent={false}
        >
            <View style={styles.container}>
                <Image source={{ uri: imageUri }} style={styles.image} />
                <TouchableOpacity
                    onPress={onClose}
                    style={[
                        styles.closeButton,
                        {
                            top: insets.top + Spacing.sm,
                            right: Spacing.sm,
                        }
                    ]}
                >
                    <FontAwesome name={"close"} size={20} color={"#FF6B6B"} />
                </TouchableOpacity>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
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
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        width: 40,
        height: 40,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
});

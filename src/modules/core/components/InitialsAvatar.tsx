import { Image, StyleSheet, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { useTheme } from '../hooks/useTheme'
import { initialsOf } from './initials'
import { Typography } from './Typography'

type InitialsAvatarProps = {
    name: string
    // Shown instead of the initials when there is one (an Exercise's photo).
    photoUri?: string | null
    size?: number
}

// The leading mark of a list row: a photo when there is one, otherwise the
// name's initials on a neutral tile, so rows are told apart at a glance
// without decorative icons or accent colour.
export function InitialsAvatar({ name, photoUri, size = 40 }: InitialsAvatarProps) {
    const { theme } = useTheme()
    const box = { width: size, height: size, borderRadius: Radius.sm }
    if (photoUri) {
        return <Image source={{ uri: photoUri }} style={[box, styles.photo]} accessibilityElementsHidden />
    }
    return (
        <View style={[box, styles.tile, { backgroundColor: theme.inputBackgroundActive }]} accessibilityElementsHidden>
            <Typography.Label color={'text'} weight={'bold'}>
                {initialsOf(name)}
            </Typography.Label>
        </View>
    )
}

const styles = StyleSheet.create({
    photo: {
        resizeMode: 'cover',
    },
    tile: {
        alignItems: 'center',
        justifyContent: 'center',
    },
})

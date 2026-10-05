import { StyleSheet, View } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { planInitials } from '../templateSummary'

// A plan's leading mark in lists: its initials on an accent tint, so plans
// are told apart at a glance without decorative icons.
export function PlanAvatar({ name }: { name: string }) {
    const { theme } = useTheme()
    return (
        <View style={[styles.avatar, { backgroundColor: `${theme.primary}1F` }]} accessibilityElementsHidden>
            <Typography.Label color={'primary'} weight={'bold'}>
                {planInitials(name)}
            </Typography.Label>
        </View>
    )
}

const styles = StyleSheet.create({
    avatar: {
        width: 40,
        height: 40,
        borderRadius: Radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
})

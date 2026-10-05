import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import type { ThemeType } from '@/src/constants/Colors'
import { Spacing } from '@/src/constants/Spacing'
import { Typography } from '@/src/modules/core/components/Typography'
import { useTheme } from '@/src/modules/core/hooks/useTheme'
import { formatElapsed } from '../liveWorkout'

type ElapsedTimeProps = {
    startTime: string
    // Text colour token; the clock glyph follows it.
    color?: 'textSecondary' | 'onPrimary' | 'text'
    // 'display' is the hero clock: large digits, no glyph.
    size?: 'meta' | 'display'
}

// Time since a Workout started, ticking each second. The clock glyph marks it
// as elapsed time, not the time of day.
export function ElapsedTime({ startTime, color = 'textSecondary', size = 'meta' }: ElapsedTimeProps) {
    const { t } = useTranslation()
    const { theme } = useTheme()
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(interval)
    }, [])
    const startMs = new Date(startTime).getTime()
    if (!Number.isFinite(startMs)) return null
    const text = formatElapsed(now - startMs)
    const tint = theme[color as keyof ThemeType]
    if (size === 'display') {
        return (
            <Typography.Title size={'display'} numeric style={{ color: tint }} accessibilityRole={'timer'}>
                {text}
            </Typography.Title>
        )
    }
    return (
        <View style={styles.row} accessibilityLabel={t('elapsedTime', { time: text })}>
            <FontAwesome name={'clock-o'} size={11} color={tint} />
            <Typography.Meta numeric style={{ color: tint }}>
                {text}
            </Typography.Meta>
        </View>
    )
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
})

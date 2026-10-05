import type React from 'react'
import { Children, Fragment, isValidElement } from 'react'
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import { Radius } from '@/src/constants/Radius'
import { Spacing } from '@/src/constants/Spacing'
import { useTheme } from '../hooks/useTheme'
import { Typography } from './Typography'

type ListSectionProps = {
    // Section header above the group (sentence case; rendered as a quiet label).
    title?: string
    // Explanatory text under the group.
    footer?: string
    children: React.ReactNode
    style?: StyleProp<ViewStyle>
}

// Inset grouped list section: rows on one surface, separated by hairlines
// inset to the text column. No outline — the surface tone alone groups them.
// Falsy children (`{cond && <ListRow />}`) are skipped, so separators only
// ever sit between rendered rows.
export function ListSection({ title, footer, children, style }: ListSectionProps) {
    const { theme } = useTheme()
    const rows = Children.toArray(children).filter(isValidElement)

    return (
        <View style={[styles.root, style]}>
            {title && (
                <Typography.Label style={styles.title} accessibilityRole={'header'}>
                    {title}
                </Typography.Label>
            )}
            <View style={[styles.group, { backgroundColor: theme.surface }]}>
                {rows.map((row, index) => (
                    <Fragment key={row.key ?? index}>
                        {index > 0 && <View style={[styles.separator, { backgroundColor: theme.hairline }]} />}
                        {row}
                    </Fragment>
                ))}
            </View>
            {footer && (
                <Typography.Meta style={styles.footer} color={'textSecondary'}>
                    {footer}
                </Typography.Meta>
            )}
        </View>
    )
}

// For lists too long for a ListSection (a FlatList or SectionList of rows):
// the same inset group, built row by row. The first and last row of a group
// round their outer corners.
export const groupedRowCorners = (index: number, count: number) => [
    index === 0 && styles.firstRow,
    index === count - 1 && styles.lastRow,
]

const styles = StyleSheet.create({
    firstRow: {
        borderTopLeftRadius: Radius.md,
        borderTopRightRadius: Radius.md,
    },
    lastRow: {
        borderBottomLeftRadius: Radius.md,
        borderBottomRightRadius: Radius.md,
    },
    root: {
        gap: Spacing.sm,
    },
    title: {
        paddingHorizontal: Spacing.md,
    },
    group: {
        borderRadius: Radius.md,
        overflow: 'hidden',
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        marginLeft: Spacing.md,
    },
    footer: {
        paddingHorizontal: Spacing.md,
    },
})

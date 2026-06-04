import type { TextStyle } from 'react-native'

/**
 * Type scale. Collapses the 9 ad-hoc font sizes found across the app
 * (10,11,12,13,14,15,16,18,20,24) into 6 semantic steps, mirroring the
 * naming of the Spacing scale.
 */
export const FontSize = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
} as const

/**
 * Weight scale. `'bold'` and `'700'` were used interchangeably — both map to
 * `bold` here. `'400'..'800'` collapse to five named steps.
 */
export const FontWeight = {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800',
} as const satisfies Record<string, TextStyle['fontWeight']>

export type FontSizeToken = keyof typeof FontSize
export type FontWeightToken = keyof typeof FontWeight

/**
 * Border-radius scale. Collapses the 13 ad-hoc radius values found across the
 * app (1,2,3,4,6,8,10,12,14,20,22,100,999) into five semantic steps, mirroring
 * the naming of the Spacing and Typography scales.
 *
 * `pill` is the single source of truth for fully-rounded shapes — previously
 * expressed three different ways (100, 999, 22).
 */
export const Radius = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 20,
    pill: 9999,
} as const

export type RadiusToken = keyof typeof Radius

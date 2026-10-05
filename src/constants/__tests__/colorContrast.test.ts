import { describe, expect, it } from 'vitest'
import { Colors, type ThemeType } from '../Colors'

// WCAG 2.x relative luminance and contrast ratio for #RRGGBB colours.
const luminance = (hex: string): number => {
    const channel = (offset: number) => {
        const c = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

const contrast = (a: string, b: string): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
}

// Text-bearing pairs: body text, captions, accent text and labels on filled
// buttons must meet 4.5:1 (WCAG AA for normal-size text) in both themes.
const TEXT_PAIRS: [keyof ThemeType, keyof ThemeType][] = [
    ['text', 'background'],
    ['text', 'surface'],
    ['text', 'card'],
    ['textSecondary', 'background'],
    ['textSecondary', 'surface'],
    ['primary', 'background'],
    ['primary', 'surface'],
    ['onPrimary', 'primary'],
    ['error', 'background'],
    ['error', 'surface'],
    ['onPrimary', 'error'],
    ['info', 'surface'],
]

describe.each(Object.entries(Colors))('%s theme contrast', (_name, theme) => {
    it.each(TEXT_PAIRS)('%s on %s meets 4.5:1', (foreground, background) => {
        expect(contrast(theme[foreground], theme[background])).toBeGreaterThanOrEqual(4.5)
    })
})

// A #RRGGBBAA tint laid over an opaque #RRGGBB colour, as the screen shows it.
const blend = (tint: string, under: string): string => {
    const alpha = Number.parseInt(tint.slice(7, 9), 16) / 255
    const mix = (offset: number) => {
        const top = Number.parseInt(tint.slice(offset, offset + 2), 16)
        const bottom = Number.parseInt(under.slice(offset, offset + 2), 16)
        return Math.round(top * alpha + bottom * (1 - alpha))
            .toString(16)
            .padStart(2, '0')
    }
    return `#${mix(1)}${mix(3)}${mix(5)}`
}

// Text on the accent tints, which sit on a surface (rows, panels) or on the
// background (filter chips, calendar days).
const TINT_PAIRS: [keyof ThemeType, keyof ThemeType, keyof ThemeType][] = [
    ['text', 'primaryTint', 'surface'],
    ['textSecondary', 'primaryTint', 'surface'],
    ['primary', 'primaryTint', 'surface'],
    ['text', 'primaryTintStrong', 'background'],
    ['text', 'primaryTintStrong', 'surface'],
]

describe.each(Object.entries(Colors))('%s theme tints', (_name, theme) => {
    it.each(TINT_PAIRS)('%s on %s over %s meets 4.5:1', (foreground, tint, under) => {
        expect(contrast(theme[foreground], blend(theme[tint], theme[under]))).toBeGreaterThanOrEqual(4.5)
    })
})

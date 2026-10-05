export const Colors = {
    dark: {
        background: '#121212',
        iconBackground: '#607d8b',
        surface: '#252525',
        surfaceMuted: 'rgba(255,255,255,0.05)',
        // Desaturated on dark (Material dark theme) and paired with dark text:
        // white on a mid green stays under 4.5:1.
        primary: '#6FBF8B',
        // The accent laid over a surface: logged rows, the running workout,
        // a selected day or filter. Text on them stays text-coloured.
        primaryTint: '#6FBF8B14',
        primaryTintStrong: '#6FBF8B33',
        error: '#F2B8B5',
        errorSurface: '#B0382F',
        text: '#E1E1E1',
        textSecondary: '#A0A0A0',
        // Readable but clearly not part of the current set (days outside the month).
        textDisabled: '#6E6E6E',
        onPrimary: '#0B2915',
        border: '#404040',
        card: '#1E1E1E',
        tabBar: '#121212',
        info: '#64B5F6',
        inputBackground: 'rgba(255,255,255,0.05)',
        inputBackgroundActive: 'rgba(255,255,255,0.1)',
        // The chosen segment of a segmented control; light enough on dark
        // to read as raised against its track on the page and on a card.
        segmentActive: '#4A4A4A',
        // Behind a full-screen photo.
        overlayScrim: 'rgba(0,0,0,0.8)',
        // Behind a sheet or dialog; dark surfaces need a heavier one to stand off the page.
        sheetScrim: 'rgba(0,0,0,0.6)',
        hairline: 'rgba(255,255,255,0.08)',
        skeletonBase: '#2C2C2C',
    },
    light: {
        // A step darker than the white surface so grouped sections read as groups.
        background: '#F1F2F4',
        iconBackground: '#607d8b',
        surface: '#FFFFFF',
        surfaceMuted: '#F0F0F0',
        // Dark enough for 4.5:1 both as text on the background and under white text.
        primary: '#2B7A4B',
        primaryTint: '#2B7A4B14',
        primaryTintStrong: '#2B7A4B33',
        error: '#B00020',
        errorSurface: '#B0382F',
        text: '#121212',
        textSecondary: '#666666',
        textDisabled: '#A6A6A6',
        onPrimary: '#FFFFFF',
        border: '#E0E0E0',
        card: '#FFFFFF',
        tabBar: '#FFFFFF',
        info: '#1565C0',
        inputBackground: 'rgba(0,0,0,0.05)',
        inputBackgroundActive: 'rgba(0,0,0,0.1)',
        segmentActive: '#FFFFFF',
        overlayScrim: 'rgba(0,0,0,0.8)',
        sheetScrim: 'rgba(0,0,0,0.4)',
        hairline: 'rgba(0,0,0,0.08)',
        skeletonBase: '#D4D4D4',
    },
}

export type ThemeType = typeof Colors.dark

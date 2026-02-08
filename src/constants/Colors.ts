export const Colors = {
    dark: {
        background: '#121212',
        surface: '#252525',
        primary: '#51a06f',
        secondary: '#077121',
        error: '#CF6679',
        text: '#E1E1E1',
        textSecondary: '#A0A0A0',
        border: '#404040',
        card: '#1E1E1E',
        tabBar: '#121212',
        info: '#2196F3',
    },
    light: {
        background: '#F8F9FA',
        surface: '#FFFFFF',
        primary: '#51a06f',
        secondary: '#077121',
        error: '#B00020',
        text: '#121212',
        textSecondary: '#666666',
        border: '#E0E0E0',
        card: '#FFFFFF',
        tabBar: '#FFFFFF',
        info: '#2196F3',
    },
};

export type ThemeType = typeof Colors.dark;
export const Theme = Colors.dark;

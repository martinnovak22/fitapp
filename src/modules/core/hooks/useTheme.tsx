import { Colors, ThemeType } from '@/src/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    theme: ThemeType;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'app-theme-mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [mode, setMode] = useState<ThemeMode>('system');

    useEffect(() => {
        const loadTheme = async () => {
            const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
            if (savedMode) {
                setMode(savedMode as ThemeMode);
            }
        };
        loadTheme();
    }, []);

    const handleSetMode = async (newMode: ThemeMode) => {
        setMode(newMode);
        await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    };

    const isDark = mode === 'system' ? systemColorScheme === 'dark' : mode === 'dark';
    const theme = isDark ? Colors.dark : Colors.light;

    return (
        <ThemeContext.Provider value={{ mode, setMode: handleSetMode, theme, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

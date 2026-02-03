import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
    en: {
        translation: {
            exercises: 'Exercises',
            workout: 'Workout',
            history: 'History',
            addExercise: 'Add Exercise',
            editExercise: 'Edit Exercise',
            exerciseDetails: 'Exercise Details',
            name: 'Name',
            muscleGroup: 'Muscle Group',
            exerciseType: 'Exercise Type',
            photo: 'Photo',
            saveChanges: 'Save Changes',
            createExercise: 'Create Exercise',
            delete: 'Delete',
            cancel: 'Cancel',
            update: 'Update',
            addSet: 'Add Set',
            inputSet: 'Input Set',
            editSet: 'Edit Set',
            weight: 'Weight',
            reps: 'Reps',
            distance: 'Distance',
            minutes: 'Minutes',
            seconds: 'Seconds',
            noExercises: 'No exercises found',
            addFirstExercise: 'Add your first exercise to get started',
            export: 'Export',
            import: 'Import',
            pyramidSet: 'Pyramid Set',
            exerciseTitle: 'Exercise',
            weightKg: 'Weight (kg)',
            distM: 'Dist (m)',
            noDropSets: 'No drop sets added yet',
            cleanState: 'Clean State',
            czech: 'Čeština',
            english: 'English',
            language: 'Language',
            avgTime: 'AVG TIME',
            perSession: 'Per session',
            weeklyActivity: 'Weekly Activity',
            activeSession: 'Active Session',
            resumeSession: 'Resume Session',
            startNewWorkout: 'Start New Workout',
            readyToCrush: 'Ready to crush your goals today?',
            noWorkoutsRecorded: 'No workouts recorded',
            sessions: 'Sessions',
            completed: 'Completed',
            incomplete: 'Incomplete',
            startedAt: 'Started at',
            loading: 'Loading...',
            notSpecified: 'Not specified',
            statsComingSoon: 'Stats coming soon',
            inProgress: 'In Progress',
            noWorkoutsYet: 'No workouts logged yet',
            edit: 'Edit',
            type: 'Type',
            deleteExerciseConfirm: 'Are you sure? This will delete all history for this exercise.',
            progress: 'Progress',
            meters: 'Meters',
            time: 'Time',
            personalBest: 'Personal Best',
            average: 'Average',
            noHistoryData: 'No history data available',
        }
    },
    cs: {
        translation: {
            exercises: 'Cviky',
            workout: 'Trénink',
            history: 'Historie',
            addExercise: 'Přidat cvik',
            editExercise: 'Upravit cvik',
            exerciseDetails: 'Detaily cviku',
            name: 'Název',
            muscleGroup: 'Svalová skupina',
            exerciseType: 'Typ cviku',
            photo: 'Fotka',
            saveChanges: 'Uložit změny',
            createExercise: 'Vytvořit cvik',
            delete: 'Smazat',
            cancel: 'Zrušit',
            update: 'Upravit',
            addSet: 'Přidat sérii',
            inputSet: 'Zadat sérii',
            editSet: 'Upravit sérii',
            weight: 'Váha',
            reps: 'Opakování',
            distance: 'Vzdálenost',
            minutes: 'Minuty',
            seconds: 'Sekundy',
            noExercises: 'Žádné cviky nenalezeny',
            addFirstExercise: 'Přidejte svůj první cvik a začněte',
            export: 'Exportovat',
            import: 'Importovat',
            pyramidSet: 'Pyramidová série',
            exerciseTitle: 'Cvik',
            weightKg: 'Váha',
            distM: 'Vzdálenost (m)',
            noDropSets: 'Zatím žádné série',
            cleanState: 'Prázdný stav',
            czech: 'Čeština',
            english: 'Angličtina',
            language: 'Jazyk',
            avgTime: 'PRŮM. ČAS',
            perSession: 'Na trénink',
            weeklyActivity: 'Týdenní aktivita',
            activeSession: 'Aktivní trénink',
            resumeSession: 'Pokračovat',
            startNewWorkout: 'Začít trénink',
            readyToCrush: 'Jste připraveni makat?',
            noWorkoutsRecorded: 'Žádné tréninky',
            sessions: 'Tréninky',
            completed: 'Dokončeno',
            incomplete: 'Nedokončeno',
            startedAt: 'Začalo v',
            loading: 'Načítání...',
            notSpecified: 'Nespecifikováno',
            statsComingSoon: 'Statistiky již brzy',
            inProgress: 'Probíhá',
            noWorkoutsYet: 'Zatím žádné tréninky',
            edit: 'Upravit',
            type: 'Typ',
            deleteExerciseConfirm: 'Jste si jisti? Toto smaže veškerou historii pro tento cvik.',
            progress: 'Pokrok',
            meters: 'Metry',
            time: 'Čas',
            personalBest: 'Osobní rekord',
            average: 'Průměr',
            noHistoryData: 'Nejsou k dispozici žádná data historie',
        }
    }
};

const LANGUAGE_KEY = 'user-language';

const languageDetector = {
    type: 'languageDetector' as const,
    async: true,
    detect: async (callback: (lang: string) => void) => {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (savedLanguage) {
            return callback(savedLanguage);
        }
        const locales = Localization.getLocales();
        const deviceLanguage = locales && locales.length > 0 ? locales[0].languageCode : 'en';
        callback(deviceLanguage || 'en');
    },
    init: () => { },
    cacheUserLanguage: async (language: string) => {
        await AsyncStorage.setItem(LANGUAGE_KEY, language);
    }
};

i18n
    .use(languageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        },
        react: {
            useSuspense: false
        }
    });

export default i18n;

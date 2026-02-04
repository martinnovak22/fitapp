import { Exercise, ExerciseRepository, ExerciseType } from '@/src/db/exercises';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';

export const exportExercisesToCSV = async (exercises: Exercise[]) => {
    try {
        const header = 'name,type,muscle_group,position\n';
        const rows = exercises.map(ex =>
            `"${ex.name}","${ex.type}","${ex.muscle_group || ''}",${ex.position}`
        ).join('\n');

        const csvContent = header + rows;

        // Android special handling for direct save
        if (Platform.OS === 'android') {
            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (permissions.granted) {
                try {
                    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                        permissions.directoryUri,
                        'exercises_export',
                        'text/csv'
                    );
                    await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
                    Toast.show({
                        type: 'success',
                        text1: 'Success',
                        text2: 'CSV saved successfully'
                    });
                    return;
                } catch (e) {
                    console.error('SAF Save failed', e);
                    // Fallback to sharing if SAF fails
                }
            }
        }

        // Default sharing flow (iOS and Android fallback)
        const fileUri = FileSystem.documentDirectory + 'exercises_export.csv';
        await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'text/csv',
                dialogTitle: 'Export Exercises',
                UTI: 'public.comma-separated-values-text'
            });
        } else {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Sharing is not available on this device'
            });
        }
    } catch (error) {
        console.error('Export failed', error);
        Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to export exercises'
        });
    }
};

export const importExercisesFromCSV = async (onComplete: () => void) => {
    try {
        const result = await DocumentPicker.getDocumentAsync({
            type: ['text/csv', 'text/comma-separated-values'],
        });

        if (result.canceled) return;

        const fileUri = result.assets[0].uri;
        const content = await FileSystem.readAsStringAsync(fileUri);

        const lines = content.split('\n');
        // Simple CSV parsing (handles quotes and commas)
        const exercisesToImport = lines.slice(1).filter(line => line.trim() !== '');

        let importedCount = 0;
        for (const line of exercisesToImport) {
            // Regex to handle quoted strings with commas
            const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (!matches || matches.length < 2) continue;

            const name = matches[0].replace(/"/g, '');
            const type = matches[1].replace(/"/g, '') as ExerciseType;
            const muscle_group = matches[2]?.replace(/"/g, '') || undefined;

            await ExerciseRepository.create(name, type, muscle_group);
            importedCount++;
        }

        Toast.show({
            type: 'success',
            text1: 'Success',
            text2: `Imported ${importedCount} exercises`
        });
        onComplete();
    } catch (error) {
        console.error('Import failed', error);
        Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to import exercises. Make sure the CSV format is correct.'
        });
    }
};


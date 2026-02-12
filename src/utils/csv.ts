import { Exercise, ExerciseRepository, ExerciseType } from '@/src/db/exercises';
import i18n from '@/src/modules/core/utils/i18n';
import { showToast } from '@/src/modules/core/utils/toast';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const EXPORT_FILE_NAME = 'exercises_export.csv';
const EXPORT_FILE_BASENAME = 'exercises_export';
const VALID_TYPES: ExerciseType[] = ['weight', 'cardio', 'bodyweight', 'bodyweight_timer'];
const VALID_TYPE_SET = new Set<ExerciseType>(VALID_TYPES);

type ExportAction = 'share' | 'save';

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const buildExerciseKey = (name: string, type: ExerciseType, muscleGroup?: string) =>
    `${normalize(name)}|${normalize(type)}|${normalize(muscleGroup)}`;

const parseCsvLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"' && inQuotes && nextChar === '"') {
            current += '"';
            i++;
            continue;
        }

        if (char === '"') {
            inQuotes = !inQuotes;
            continue;
        }

        if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current.trim());
    return values;
};

const resolveExerciseType = (rawType: string): ExerciseType | null => {
    const normalized = normalize(rawType).replace(/\s+/g, '_') as ExerciseType;
    return VALID_TYPE_SET.has(normalized) ? normalized : null;
};

const getExportTimestamp = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
};

const writeTempExportCsv = async (csvContent: string): Promise<string> => {
    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) {
        throw new Error('DOCUMENT_DIRECTORY_UNAVAILABLE');
    }

    const fileUri = `${baseDir}${EXPORT_FILE_NAME}`;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
    return fileUri;
};

const shareCsvFile = async (fileUri: string) => {
    if (!(await Sharing.isAvailableAsync())) {
        showToast.danger({
            title: i18n.t('error'),
            message: i18n.t('sharingUnavailable')
        });
        return;
    }

    await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: i18n.t('export'),
        UTI: 'public.comma-separated-values-text'
    });
};

const saveCsvToAndroidDownloads = async (csvContent: string) => {
    const downloadsUri = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download');
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(downloadsUri);
    if (!permissions.granted) {
        throw new Error('DOWNLOADS_PERMISSION_DENIED');
    }

    const fileNameBase = `${EXPORT_FILE_BASENAME}_${getExportTimestamp()}`;
    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        fileNameBase,
        'text/csv'
    );

    await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
    showToast.success({
        title: i18n.t('success'),
        message: i18n.t('csvSavedToDownloads')
    });
};

export const exportExercisesToCSV = async (
    exercises: Exercise[],
    options?: { androidAction?: ExportAction }
) => {
    try {
        const header = 'name,type,muscle_group,position\n';
        const rows = exercises.map(ex =>
            `"${ex.name}","${ex.type}","${ex.muscle_group || ''}",${ex.position}`
        ).join('\n');
        const csvContent = header + rows;

        if (Platform.OS === 'android') {
            const action = options?.androidAction ?? 'save';
            if (action === 'share') {
                const fileUri = await writeTempExportCsv(csvContent);
                await shareCsvFile(fileUri);
                return;
            }
            await saveCsvToAndroidDownloads(csvContent);
            return;
        }

        const fileUri = await writeTempExportCsv(csvContent);
        await shareCsvFile(fileUri);
    } catch (error) {
        if (error instanceof Error && error.message === 'DOWNLOADS_PERMISSION_DENIED') {
            return;
        }
        console.error('Export failed', error);
        showToast.danger({
            title: i18n.t('error'),
            message: i18n.t('exportFailed')
        });
    }
};

export const importExercisesFromCSV = async (
    onComplete: () => void
) => {
    try {
        const result = await DocumentPicker.getDocumentAsync();
        if (result.canceled) return;

        const selectedAsset = result.assets[0];
        const nameFromUri = decodeURIComponent(selectedAsset.uri).split('/').pop()?.toLowerCase() ?? '';
        const selectedName = (selectedAsset.name ?? nameFromUri).toLowerCase();
        if (!selectedName.endsWith('.csv')) {
            showToast.danger({
                title: i18n.t('error'),
                message: i18n.t('importFailed')
            });
            return;
        }

        const content = await FileSystem.readAsStringAsync(selectedAsset.uri);

        const lines = content.split('\n');
        const exercisesToImport = lines.slice(1).filter(line => line.trim().length > 0);

        const existingExercises = await ExerciseRepository.getAll();
        const existingByKey = new Map(
            existingExercises.map(ex => [buildExerciseKey(ex.name, ex.type, ex.muscle_group), ex])
        );
        const processedImportKeys = new Set<string>();

        let addedCount = 0;
        let mergedCount = 0;
        let skippedCount = 0;
        for (const line of exercisesToImport) {
            const cells = parseCsvLine(line);
            if (cells.length < 2) {
                skippedCount++;
                continue;
            }

            const name = cells[0].trim();
            const resolvedType = resolveExerciseType(cells[1]);
            const muscle_group = cells[2]?.trim() || undefined;
            if (!name || !resolvedType) {
                skippedCount++;
                continue;
            }

            const key = buildExerciseKey(name, resolvedType, muscle_group);
            if (processedImportKeys.has(key)) {
                skippedCount++;
                continue;
            }

            const existing = existingByKey.get(key);
            if (!existing) {
                await ExerciseRepository.create(name, resolvedType, muscle_group);
                existingByKey.set(key, {
                    id: -1,
                    name,
                    type: resolvedType,
                    muscle_group,
                    position: 0,
                });
                addedCount++;
            } else {
                await ExerciseRepository.update(existing.id, {
                    name,
                    type: resolvedType,
                    muscle_group,
                });
                mergedCount++;
            }

            processedImportKeys.add(key);
        }

        showToast.success({
            title: i18n.t('success'),
            message: skippedCount > 0
                ? i18n.t('importSummary', {
                    added: addedCount,
                    merged: mergedCount,
                    skipped: skippedCount
                })
                : i18n.t('importSummaryNoSkipped', {
                    added: addedCount,
                    merged: mergedCount
                })
        });
        onComplete();
    } catch (error) {
        console.error('Import failed', error);
        showToast.danger({
            title: i18n.t('error'),
            message: i18n.t('importFailed')
        });
    }
};

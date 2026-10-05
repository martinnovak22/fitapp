import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { Button } from '@/src/modules/core/components/Button'
import { Sheet } from '@/src/modules/core/components/Sheet'
import { formatHourMinute, formatLocalDateYYYYMMDD, formatLocalizedDate } from '@/src/utils/dateTime'
import { DateTimeField } from './DateTimeField'

type Props = {
    visible: boolean
    language: string
    /** Stored as `YYYY-MM-DD`. */
    date: string
    /** Stored as `HH:mm`. */
    startTime: string
    /** Stored as `HH:mm`; empty string means "not specified". */
    endTime: string
    onChangeDate: (value: string) => void
    onChangeStartTime: (value: string) => void
    onChangeEndTime: (value: string) => void
    onSave: () => void
    onClose: () => void
    isSaving: boolean
}

const pad = (value: number) => String(value).padStart(2, '0')

const timeStringFromDate = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

// Combine the stored date + time strings into a single Date the native picker
// can seed from. Falls back to "now" / midnight when a part is missing or junk.
const dateFromParts = (dateStr: string, timeStr: string): Date => {
    const parsed = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date()
    const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed
    if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number)
        if (!Number.isNaN(hours) && !Number.isNaN(minutes)) base.setHours(hours, minutes, 0, 0)
    }
    return base
}

export const EditTimingModal = ({
    visible,
    language,
    date,
    startTime,
    endTime,
    onChangeDate,
    onChangeStartTime,
    onChangeEndTime,
    onSave,
    onClose,
    isSaving,
}: Props) => {
    const { t } = useTranslation()

    const dateValue = dateFromParts(date, '00:00')
    const startValue = dateFromParts(date, startTime || '00:00')
    const endValue = dateFromParts(date, endTime || startTime || '00:00')

    const dateDisplay = date
        ? formatLocalizedDate(`${date}T00:00:00`, language, { year: 'numeric', month: 'short', day: 'numeric' }, true)
        : t('notSpecified')
    const startDisplay = startTime ? formatHourMinute(startValue, language) : t('notSpecified')
    const endDisplay = endTime ? formatHourMinute(endValue, language) : t('notSpecified')

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={t('editTime')}
            footer={<Button label={t('saveChanges')} onPress={onSave} isLoading={isSaving} />}
        >
            <View style={styles.fields}>
                <DateTimeField
                    label={t('workoutDate')}
                    mode={'date'}
                    value={dateValue}
                    displayValue={dateDisplay}
                    onChange={(picked) => onChangeDate(formatLocalDateYYYYMMDD(picked))}
                />
                <DateTimeField
                    label={t('startTime')}
                    mode={'time'}
                    value={startValue}
                    displayValue={startDisplay}
                    onChange={(picked) => onChangeStartTime(timeStringFromDate(picked))}
                />
                <DateTimeField
                    label={t('endTime')}
                    mode={'time'}
                    value={endValue}
                    displayValue={endDisplay}
                    onChange={(picked) => onChangeEndTime(timeStringFromDate(picked))}
                />
            </View>
        </Sheet>
    )
}

const styles = StyleSheet.create({
    fields: {
        gap: Spacing.md,
        paddingBottom: Spacing.sm,
    },
})

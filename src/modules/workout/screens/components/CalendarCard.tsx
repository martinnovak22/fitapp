import { StyleSheet } from 'react-native'
import { Calendar } from 'react-native-calendars'
import Animated from 'react-native-reanimated'
import { Motion } from '@/src/constants/Motion'
import { Spacing } from '@/src/constants/Spacing'
import { Card } from '@/src/modules/core/components/Card'
import { useTheme } from '@/src/modules/core/hooks/useTheme'

// Hoisted builder (don't allocate in render).
const CALENDAR_CARD_ENTER = Motion.screenEnter().delay(70)

export interface MarkedDates {
    [date: string]: {
        marked?: boolean
        selected?: boolean
        selectedColor?: string
        dotColor?: string
    }
}

interface CalendarCardProps {
    markedDates: MarkedDates
    selectedDate: string | null
    onDayPress: (day: { dateString: string }) => void
}

export function CalendarCard({ markedDates, selectedDate, onDayPress }: CalendarCardProps) {
    const { theme } = useTheme()

    return (
        <Animated.View entering={CALENDAR_CARD_ENTER}>
            <Card style={styles.calendarCard}>
                <Calendar
                    theme={{
                        backgroundColor: 'transparent',
                        calendarBackground: 'transparent',
                        textSectionTitleColor: theme.textSecondary,
                        selectedDayBackgroundColor: theme.primary,
                        selectedDayTextColor: theme.onPrimary,
                        todayTextColor: theme.primary,
                        dayTextColor: theme.text,
                        textDisabledColor: theme.inputBackgroundActive,
                        dotColor: theme.primary,
                        selectedDotColor: theme.onPrimary,
                        arrowColor: theme.primary,
                        disabledArrowColor: theme.border,
                        monthTextColor: theme.text,
                        indicatorColor: theme.primary,
                        textDayFontFamily: 'System',
                        textMonthFontFamily: 'System',
                        textDayHeaderFontFamily: 'System',
                        textDayFontWeight: '300',
                        textMonthFontWeight: 'bold',
                        textDayHeaderFontWeight: '300',
                        textDayFontSize: 16,
                        textMonthFontSize: 18,
                        textDayHeaderFontSize: 14,
                    }}
                    markedDates={{
                        ...markedDates,
                        ...(selectedDate
                            ? {
                                  [selectedDate]: {
                                      ...markedDates[selectedDate],
                                      selected: true,
                                      selectedColor: `${theme.primary}40`,
                                  },
                              }
                            : {}),
                    }}
                    onDayPress={onDayPress}
                    hideExtraDays={false}
                    showSixWeeks={true}
                />
            </Card>
        </Animated.View>
    )
}

const styles = StyleSheet.create({
    calendarCard: {
        padding: Spacing.sm,
        marginBottom: Spacing.lg,
        height: 380,
    },
})

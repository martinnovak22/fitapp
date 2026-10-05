import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Spacing } from '@/src/constants/Spacing'
import { Button } from './Button'
import { ListRow } from './ListRow'
import { SearchField } from './SearchField'
import { Sheet } from './Sheet'
import { filterOptions, groupOptions, type SelectOption, shouldShowSearch, toggleValue } from './selectOptions'
import { Typography } from './Typography'

export type { SelectOption }

type BaseProps<V extends string> = {
    visible: boolean
    onClose: () => void
    title: string
    options: readonly SelectOption<V>[]
    // Defaults to showing search only for lists longer than SEARCH_THRESHOLD.
    searchable?: boolean
}

type SingleProps<V extends string> = BaseProps<V> & {
    mode: 'single'
    value: V | null
    // Called with the tapped option; the sheet then closes.
    onSelect: (value: V) => void
}

type MultiProps<V extends string> = BaseProps<V> & {
    mode: 'multi'
    values: readonly V[]
    // Applied on every toggle; Done only closes the sheet.
    onChange: (values: V[]) => void
}

type SelectSheetProps<V extends string> = SingleProps<V> | MultiProps<V>

// Picks one or several options from a list that is too long for a segmented
// control: search (for longer lists), section headers, checkmarks. Single
// select closes on tap; multi select applies each toggle and closes on Done.
export function SelectSheet<V extends string>(props: SelectSheetProps<V>) {
    const { visible, onClose, title, options } = props
    const { t } = useTranslation()
    const [query, setQuery] = useState('')

    // A fresh search every time the sheet opens.
    useEffect(() => {
        if (visible) setQuery('')
    }, [visible])

    const searchable = props.searchable ?? shouldShowSearch(options.length)
    const sections = useMemo(() => groupOptions(filterOptions(options, query)), [options, query])
    const selected: readonly V[] = props.mode === 'single' ? (props.value === null ? [] : [props.value]) : props.values

    const handlePress = (value: V) => {
        if (props.mode === 'single') {
            props.onSelect(value)
            onClose()
            return
        }
        props.onChange(toggleValue(props.values, value))
    }

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={title}
            tall={searchable}
            headerAction={
                props.mode === 'multi' ? <Button label={t('done')} variant={'text'} onPress={onClose} /> : undefined
            }
        >
            {searchable && <SearchField value={query} onChangeText={setQuery} />}
            <ScrollView
                keyboardShouldPersistTaps={'handled'}
                style={styles.listScroll}
                contentContainerStyle={styles.list}
            >
                {sections.length === 0 && (
                    <Typography.Body color={'textSecondary'} style={styles.empty}>
                        {t('noResults')}
                    </Typography.Body>
                )}
                {sections.map((section) => (
                    <View key={section.title ?? '__none'}>
                        {section.title && (
                            <Typography.Label style={styles.sectionTitle} accessibilityRole={'header'}>
                                {section.title}
                            </Typography.Label>
                        )}
                        {section.options.map((option) => {
                            const isSelected = selected.includes(option.value)
                            return (
                                <ListRow
                                    key={option.value}
                                    label={option.label}
                                    subtitle={option.description}
                                    accessory={isSelected ? 'check' : 'none'}
                                    onPress={() => handlePress(option.value)}
                                    accessibilityRole={props.mode === 'single' ? 'radio' : 'checkbox'}
                                    accessibilityState={{ checked: isSelected, selected: isSelected }}
                                />
                            )
                        })}
                    </View>
                ))}
            </ScrollView>
        </Sheet>
    )
}

const styles = StyleSheet.create({
    // Rows run edge to edge of the sheet, like the rest of its list.
    listScroll: {
        marginHorizontal: -Spacing.md,
    },
    list: {
        paddingBottom: Spacing.sm,
    },
    sectionTitle: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.xs,
    },
    empty: {
        textAlign: 'center',
        paddingVertical: Spacing.lg,
    },
})

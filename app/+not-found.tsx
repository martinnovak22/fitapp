import { Spacing } from '@/src/constants/Spacing'
import { GlobalStyles } from '@/src/constants/Styles'
import { Typography } from '@/src/modules/core/components/Typography'
import { Link, Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'

export default function NotFoundScreen() {
    const { t } = useTranslation()
    return (
        <>
            <Stack.Screen options={{ title: t('oops') }} />
            <View style={[GlobalStyles.container, styles.content]}>
                <Typography.Title>{t('screenNotFound')}</Typography.Title>

                <Link href="/" style={styles.link}>
                    <Typography.Body size="sm" color="primary">
                        {t('goHome')}
                    </Typography.Body>
                </Link>
            </View>
        </>
    )
}

const styles = StyleSheet.create({
    content: {
        gap: Spacing.md,
    },
    link: {
        marginTop: 15,
        paddingVertical: 15,
    },
})

import { GlobalStyles } from '@/src/constants/Styles';
import { useTheme } from '@/src/modules/core/hooks/useTheme';
import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: t('oops') }} />
      <View style={GlobalStyles.container}>
        <Text style={GlobalStyles.title}>{t('screenNotFound')}</Text>

        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: theme.primary }]}>{t('goHome')}</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
  },
});

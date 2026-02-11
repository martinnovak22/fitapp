import { GlobalStyles } from '@/src/constants/Styles';
import { useTheme } from '@/src/modules/core/hooks/useTheme';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  const { theme } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={GlobalStyles.container}>
        <Text style={GlobalStyles.title}>This screen doesn't exist.</Text>

        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: theme.primary }]}>Go to home screen!</Text>
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

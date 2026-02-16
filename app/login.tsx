import { Spacing } from '@/src/constants/Spacing';
import {
  EMAIL_CONFIRMATION_REQUIRED_CODE,
  SupabaseAuthError,
} from '@/src/data/remote/supabase/auth';
import { Button } from '@/src/modules/core/components/Button';
import { Card } from '@/src/modules/core/components/Card';
import { ScreenLayout } from '@/src/modules/core/components/ScreenLayout';
import { Typography } from '@/src/modules/core/components/Typography';
import { useTheme } from '@/src/modules/core/hooks/useTheme';
import { useAuth } from '@/src/modules/auth/useAuth';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

type AuthMode = 'signin' | 'signup';

const MIN_PASSWORD_LENGTH = 6;
const formLayoutTransition = LinearTransition.duration(220);

const isValidEmail = (value: string): boolean => {
  const normalized = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
};

const mapAuthErrorToMessage = (message: string, t: (key: string) => string): string => {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return t('authInvalidCredentials');
  if (normalized.includes('email not confirmed')) return t('authEmailNotConfirmed');
  return t('authUnknownError');
};

export default function LoginScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { isAuthenticated, signIn, signUp } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const emailInputRef = useRef<TextInput>(null);

  const isSignUp = mode === 'signup';

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/landing');
    }
  }, [isAuthenticated]);

  const canSubmit = useMemo(() => {
    if (!isValidEmail(email) || password.length < MIN_PASSWORD_LENGTH) return false;
    if (isSignUp && password !== confirmPassword) return false;
    return true;
  }, [confirmPassword, email, isSignUp, password]);

  const submit = async () => {
    if (isSubmitting) return;

    if (!isValidEmail(email)) {
      setErrorMessage(t('validationEmailInvalid'));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(t('validationPasswordMin'));
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setErrorMessage(t('validationPasswordMismatch'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      router.replace('/landing');
    } catch (error) {
      if (error instanceof SupabaseAuthError && error.code === EMAIL_CONFIRMATION_REQUIRED_CODE) {
        setPendingConfirmationEmail(email.trim());
        setMode('signin');
        setPassword('');
        setConfirmPassword('');
        return;
      }
      const message = error instanceof Error ? mapAuthErrorToMessage(error.message, t) : t('authUnknownError');
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmedEmail = () => {
    setMode('signin');
    setPendingConfirmationEmail(null);
    setErrorMessage(null);
    emailInputRef.current?.focus();
  };

  return (
    <ScreenLayout style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <Animated.View
          layout={formLayoutTransition}
        >
          <Card>
            <View style={{ marginBottom: Spacing.sm }}>

              <Animated.View entering={FadeInDown.duration(180)}>
                <Typography.Title style={styles.title}>{t(isSignUp ? 'createAccount' : 'welcomeBack')}</Typography.Title>
              </Animated.View>
              <Animated.View entering={FadeInDown.delay(40).duration(180)}>
                <Typography.Body style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {t(isSignUp ? 'authSignUpSubtitle' : 'authSignInSubtitle')}
                </Typography.Body>
              </Animated.View>
            </View>

            <Animated.View entering={FadeInDown.delay(80).duration(180)}>
              <Typography.Label>{t('email')}</Typography.Label>
              <TextInput
                ref={emailInputRef}
                value={email}
                onChangeText={setEmail}
                autoCapitalize={'none'}
                autoCorrect={false}
                keyboardType={'email-address'}
                textContentType={'emailAddress'}
                autoComplete={'email'}
                returnKeyType={'next'}
                placeholder={t('emailPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBackground },
                ]}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(120).duration(180)}>
              <Typography.Label>{t('password')}</Typography.Label>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!isPasswordVisible}
                  autoCorrect={false}
                  textContentType={isSignUp ? 'newPassword' : 'password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  returnKeyType={isSignUp ? 'next' : 'done'}
                  onSubmitEditing={() => {
                    if (!isSignUp) {
                      submit();
                    }
                  }}
                  placeholder={t('passwordPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBackground },
                  ]}
                />
                {password.length > 0 ? (
                  <Pressable
                    style={styles.visibilityButton}
                    onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                    hitSlop={8}
                    accessibilityRole={"button"}
                    accessibilityLabel={isPasswordVisible ? t('hidePassword') : t('showPassword')}
                  >
                    <FontAwesome
                      name={isPasswordVisible ? 'eye-slash' : 'eye'}
                      size={18}
                      color={theme.textSecondary}
                    />
                  </Pressable>
                ) : null}
              </View>
            </Animated.View>

            {isSignUp && (
              <Animated.View layout={formLayoutTransition} entering={FadeInDown.duration(160)}>
                <Typography.Label>{t('confirmPassword')}</Typography.Label>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!isConfirmPasswordVisible}
                    autoCorrect={false}
                    textContentType={'newPassword'}
                    autoComplete={'new-password'}
                    returnKeyType={'done'}
                    onSubmitEditing={submit}
                    placeholder={t('confirmPasswordPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.input,
                      styles.passwordInput,
                      { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBackground },
                    ]}
                  />
                  {confirmPassword.length > 0 ? (
                    <Pressable
                      style={styles.visibilityButton}
                      onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}
                      hitSlop={8}
                      accessibilityRole={"button"}
                      accessibilityLabel={isConfirmPasswordVisible ? t('hidePassword') : t('showPassword')}
                    >
                      <FontAwesome
                        name={isConfirmPasswordVisible ? 'eye-slash' : 'eye'}
                        size={18}
                        color={theme.textSecondary}
                      />
                    </Pressable>
                  ) : null}
                </View>
              </Animated.View>
            )}

            {pendingConfirmationEmail ? (
              <Animated.View
                layout={formLayoutTransition}
                entering={FadeInDown.duration(180)}
                style={[styles.feedbackArea, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
              >
                <View>
                  <Typography.Body style={{ fontWeight: '700' }}>{t('checkYourEmail')}</Typography.Body>
                  <Typography.Meta style={{ color: theme.textSecondary }}>
                    {t('checkYourEmailDescription', { email: pendingConfirmationEmail })}
                  </Typography.Meta>
                  <Button
                    label={t('iConfirmedEmail')}
                    variant={'secondary'}
                    onPress={handleConfirmedEmail}
                    style={styles.confirmedButton}
                  />
                </View>
              </Animated.View>
            ) : null}

            {errorMessage ? (
              <Animated.View
                layout={formLayoutTransition}
                entering={FadeInDown.duration(140)}
                style={styles.errorArea}
              >
                <Typography.Body style={{ color: theme.error }}>{errorMessage}</Typography.Body>
              </Animated.View>
            ) : isSignUp && !pendingConfirmationEmail ? (
              <Animated.View
                layout={formLayoutTransition}
                entering={FadeInDown.duration(140)}
                style={styles.hintArea}
              >
                <Typography.Meta style={{ color: theme.textSecondary }}>
                  {t('passwordMinHint')}
                </Typography.Meta>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(160).duration(180)}>
              <Button
                label={t(isSignUp ? 'createAccount' : 'signIn')}
                onPress={submit}
                disabled={!canSubmit}
                isLoading={isSubmitting}
                style={styles.submitButton}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(180)}>
              <View style={styles.switchRow}>
                <Typography.Body style={{ color: theme.textSecondary }}>
                  {t(isSignUp ? 'alreadyHaveAccount' : 'noAccountYet')}
                </Typography.Body>
                <Pressable
                  onPress={() => {
                    setMode(isSignUp ? 'signin' : 'signup');
                    setErrorMessage(null);
                    setPendingConfirmationEmail(null);
                  }}
                  hitSlop={8}
                >
                  <Typography.Body style={{ color: theme.primary, fontWeight: '700' }}>
                    {t(isSignUp ? 'signIn' : 'signUp')}
                  </Typography.Body>
                </Pressable>
              </View>
            </Animated.View>
          </Card>
        </Animated.View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  passwordInputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: Spacing.xl2 + Spacing.sm,
  },
  visibilityButton: {
    position: 'absolute',
    right: Spacing.md,
    top: 0,
    bottom: Spacing.sm,
    justifyContent: 'center',
  },
  feedbackArea: {
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  confirmedButton: {
    marginTop: Spacing.sm,
  },
  errorArea: {
    marginBottom: Spacing.sm,
  },
  hintArea: {
    marginBottom: Spacing.sm,
  },
  submitButton: {
    marginTop: Spacing.sm,
  },
  switchRow: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

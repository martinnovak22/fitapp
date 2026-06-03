// Pure login-form rules: validation, submit gating, and auth-error mapping.
// Deliberately framework-free so it can be unit-tested without rendering.

export const MIN_PASSWORD_LENGTH = 6

export type LoginFormFields = {
    email: string
    password: string
    confirmPassword: string
    isSignUp: boolean
}

export type LoginFormValidation =
    | { ok: true; normalizedEmail: string }
    | { ok: false; errorKey: 'validationEmailInvalid' | 'validationPasswordMin' | 'validationPasswordMismatch' }

export const isValidEmail = (value: string): boolean => {
    const normalized = value.trim()
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
}

// Gates the submit button: cheap, derived-state check over the current fields.
export const canSubmitLoginForm = ({ email, password, confirmPassword, isSignUp }: LoginFormFields): boolean => {
    if (!isValidEmail(email) || password.length < MIN_PASSWORD_LENGTH) return false
    if (isSignUp && password !== confirmPassword) return false
    return true
}

// Pre-flight validation run on submit. Returns the trimmed email on success or
// the first failing rule's translation key, preserving the original ordering.
export const validateLoginForm = ({
    email,
    password,
    confirmPassword,
    isSignUp,
}: LoginFormFields): LoginFormValidation => {
    const normalizedEmail = email.trim()
    if (!isValidEmail(normalizedEmail)) return { ok: false, errorKey: 'validationEmailInvalid' }
    if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, errorKey: 'validationPasswordMin' }
    if (isSignUp && password !== confirmPassword) return { ok: false, errorKey: 'validationPasswordMismatch' }
    return { ok: true, normalizedEmail }
}

// Translates a raw auth error message into a user-facing string.
export const mapAuthErrorToMessage = (message: string, t: (key: string) => string): string => {
    const normalized = message.toLowerCase()
    if (normalized.includes('invalid login credentials')) return t('authInvalidCredentials')
    if (normalized.includes('email not confirmed')) return t('authEmailNotConfirmed')
    if (normalized.includes('redirect_to') || (normalized.includes('redirect') && normalized.includes('not allowed'))) {
        return 'Auth redirect URL is not allowed. Check Supabase Redirect URLs.'
    }
    return message.trim() || t('authUnknownError')
}

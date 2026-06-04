import { describe, expect, it } from 'vitest'
import {
    MIN_PASSWORD_LENGTH,
    canSubmitLoginForm,
    isValidEmail,
    mapAuthErrorToMessage,
    validateLoginForm,
} from '../loginFormLogic'

// Stub translator: returns the key so assertions stay readable and stable.
const t = (key: string) => key

describe('isValidEmail', () => {
    it('accepts a well-formed address', () => {
        expect(isValidEmail('user@example.com')).toBe(true)
    })

    it('trims surrounding whitespace before validating', () => {
        expect(isValidEmail('  user@example.com  ')).toBe(true)
    })

    it.each([['missing-at.com'], ['user@nodot'], ['user @example.com'], ['']])('rejects %s', (value) => {
        expect(isValidEmail(value)).toBe(false)
    })
})

describe('canSubmitLoginForm', () => {
    it('allows submit for a valid sign-in form', () => {
        expect(
            canSubmitLoginForm({
                email: 'user@example.com',
                password: 'secret123',
                confirmPassword: '',
                isSignUp: false,
            })
        ).toBe(true)
    })

    it('blocks submit when the email is invalid', () => {
        expect(
            canSubmitLoginForm({
                email: 'nope',
                password: 'secret123',
                confirmPassword: '',
                isSignUp: false,
            })
        ).toBe(false)
    })

    it('blocks submit when the password is shorter than the minimum', () => {
        expect(
            canSubmitLoginForm({
                email: 'user@example.com',
                password: 'x'.repeat(MIN_PASSWORD_LENGTH - 1),
                confirmPassword: '',
                isSignUp: false,
            })
        ).toBe(false)
    })

    it('allows submit at exactly the minimum password length', () => {
        expect(
            canSubmitLoginForm({
                email: 'user@example.com',
                password: 'x'.repeat(MIN_PASSWORD_LENGTH),
                confirmPassword: '',
                isSignUp: false,
            })
        ).toBe(true)
    })

    it('requires matching passwords when signing up', () => {
        expect(
            canSubmitLoginForm({
                email: 'user@example.com',
                password: 'secret123',
                confirmPassword: 'different',
                isSignUp: true,
            })
        ).toBe(false)
    })

    it('allows sign-up submit when passwords match', () => {
        expect(
            canSubmitLoginForm({
                email: 'user@example.com',
                password: 'secret123',
                confirmPassword: 'secret123',
                isSignUp: true,
            })
        ).toBe(true)
    })
})

describe('validateLoginForm', () => {
    it('returns ok with a trimmed email for a valid sign-in form', () => {
        const result = validateLoginForm({
            email: '  user@example.com  ',
            password: 'secret123',
            confirmPassword: '',
            isSignUp: false,
        })
        expect(result).toEqual({ ok: true, normalizedEmail: 'user@example.com' })
    })

    it('flags an invalid email first', () => {
        const result = validateLoginForm({
            email: 'nope',
            password: 'secret123',
            confirmPassword: '',
            isSignUp: false,
        })
        expect(result).toEqual({ ok: false, errorKey: 'validationEmailInvalid' })
    })

    it('flags a too-short password', () => {
        const result = validateLoginForm({
            email: 'user@example.com',
            password: 'short',
            confirmPassword: '',
            isSignUp: false,
        })
        expect(result).toEqual({ ok: false, errorKey: 'validationPasswordMin' })
    })

    it('flags mismatched passwords only on sign-up', () => {
        const result = validateLoginForm({
            email: 'user@example.com',
            password: 'secret123',
            confirmPassword: 'different',
            isSignUp: true,
        })
        expect(result).toEqual({ ok: false, errorKey: 'validationPasswordMismatch' })
    })

    it('ignores confirmPassword on sign-in', () => {
        const result = validateLoginForm({
            email: 'user@example.com',
            password: 'secret123',
            confirmPassword: 'whatever',
            isSignUp: false,
        })
        expect(result).toEqual({ ok: true, normalizedEmail: 'user@example.com' })
    })
})

describe('mapAuthErrorToMessage', () => {
    it('maps invalid login credentials', () => {
        expect(mapAuthErrorToMessage('Invalid login credentials', t)).toBe('authInvalidCredentials')
    })

    it('maps email not confirmed', () => {
        expect(mapAuthErrorToMessage('Email not confirmed', t)).toBe('authEmailNotConfirmed')
    })

    it('maps a redirect_to error to a fixed advisory string', () => {
        expect(mapAuthErrorToMessage('redirect_to is invalid', t)).toBe(
            'Auth redirect URL is not allowed. Check Supabase Redirect URLs.'
        )
    })

    it('maps a "redirect ... not allowed" error to the advisory string', () => {
        expect(mapAuthErrorToMessage('This redirect is not allowed', t)).toBe(
            'Auth redirect URL is not allowed. Check Supabase Redirect URLs.'
        )
    })

    it('passes through an unknown trimmed message', () => {
        expect(mapAuthErrorToMessage('  Something odd  ', t)).toBe('Something odd')
    })

    it('falls back to the unknown-error key for a blank message', () => {
        expect(mapAuthErrorToMessage('   ', t)).toBe('authUnknownError')
    })
})

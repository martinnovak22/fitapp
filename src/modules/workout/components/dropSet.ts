// Reconcile the identity-based key list against an externally-owned sub-set
// array whose length changed from outside (modal opened for edit, reset on
// save). Existing keys stay in place so a TextInput keeps focus; only the tail
// is topped up or truncated. Pure given a key generator.
export const reconcileSubSetKeys = (prev: string[], length: number, nextKey: () => string): string[] => {
    if (prev.length === length) return prev
    if (prev.length < length) {
        const next = prev.slice()
        while (next.length < length) next.push(nextKey())
        return next
    }
    return prev.slice(0, length)
}

// Parse a user-entered numeric field, tolerating a comma decimal separator and
// falling back to 0 for empty or non-numeric input.
export const parseSetInputNumber = (value: string): number => parseFloat(value.replace(',', '.')) || 0

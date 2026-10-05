// Up to two initials for an avatar: "Push A" → "PA", "monday" → "M".
export const initialsOf = (name: string): string =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0).toLocaleUpperCase())
        .join('')

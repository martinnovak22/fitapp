// The fixed vocabulary that describes an Exercise beyond its name and
// ExerciseType: which Muscles it trains and which Equipment it uses (ADR-0007).
// Pure and dependency-free so the db, sync, and UI layers all share one source.

// --- Muscles ---------------------------------------------------------------

// Two levels: a Muscle Group and the specific Muscles inside it. A group with
// no specific muscles (chest, full body, cardio) is selectable on its own; a
// group with muscles is *also* selectable as "the group in general", which is
// how coarse legacy values like "legs" map without guessing.
export const MUSCLE_TAXONOMY = [
    { group: 'chest', muscles: [] },
    { group: 'back', muscles: ['lats', 'upper_back', 'lower_back'] },
    { group: 'shoulders', muscles: ['front_delts', 'side_delts', 'rear_delts'] },
    { group: 'arms', muscles: ['biceps', 'triceps', 'forearms'] },
    { group: 'legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
    { group: 'core', muscles: ['abs', 'obliques'] },
    { group: 'full_body', muscles: [] },
    { group: 'cardio', muscles: [] },
] as const

export type MuscleGroup = (typeof MUSCLE_TAXONOMY)[number]['group']
type SpecificMuscle = (typeof MUSCLE_TAXONOMY)[number]['muscles'][number]
// What an Exercise stores: a specific Muscle or a whole Muscle Group.
export type MuscleKey = MuscleGroup | SpecificMuscle

export const MUSCLE_GROUPS: readonly MuscleGroup[] = MUSCLE_TAXONOMY.map((entry) => entry.group)

const GROUP_OF = new Map<string, MuscleGroup>(
    MUSCLE_TAXONOMY.flatMap((entry) => [
        [entry.group, entry.group] as const,
        ...entry.muscles.map((muscle) => [muscle, entry.group] as const),
    ])
)

export const isMuscleKey = (value: unknown): value is MuscleKey => typeof value === 'string' && GROUP_OF.has(value)

// Narrows a stored value (which may come from a newer client with keys this
// one doesn't know) to a usable key, or null.
export const asMuscleKey = (value: unknown): MuscleKey | null => (isMuscleKey(value) ? value : null)

export const muscleGroupOf = (key: MuscleKey): MuscleGroup => GROUP_OF.get(key) as MuscleGroup

// Taxonomy order (chest, back, … cardio) with unclassified last: the one sort
// every per-group list uses.
export const compareMuscleGroups = (a: MuscleGroup | null, b: MuscleGroup | null): number => {
    const rank = (group: MuscleGroup | null) => (group === null ? MUSCLE_GROUPS.length : MUSCLE_GROUPS.indexOf(group))
    return rank(a) - rank(b)
}

// How a picker lays the taxonomy out: one titled section per group that has
// specific Muscles (its first option is the group itself, "Overall"), while
// consecutive groups with nothing finer (chest, full body, cardio) share an
// untitled row so they don't repeat their own name as a heading.
export type MuscleSection = {
    title: MuscleGroup | null
    options: { key: MuscleKey; isWholeGroup: boolean }[]
}

export const buildMuscleSections = (): MuscleSection[] => {
    const sections: MuscleSection[] = []
    for (const entry of MUSCLE_TAXONOMY) {
        if (entry.muscles.length === 0) {
            const last = sections.at(-1)
            const option = { key: entry.group, isWholeGroup: false }
            if (last && last.title === null) last.options.push(option)
            else sections.push({ title: null, options: [option] })
            continue
        }
        sections.push({
            title: entry.group,
            options: [
                { key: entry.group, isWholeGroup: true },
                ...entry.muscles.map((muscle) => ({ key: muscle, isWholeGroup: false })),
            ],
        })
    }
    return sections
}

// --- Equipment ---------------------------------------------------------------

export const EQUIPMENT = [
    'barbell',
    'dumbbell',
    'kettlebell',
    'machine',
    'cable',
    'band',
    'bodyweight',
    'cardio_machine',
    // Not 'other': an i18n key ending in _other reads as a plural form.
    'misc',
] as const

export type Equipment = (typeof EQUIPMENT)[number]

const EQUIPMENT_SET = new Set<string>(EQUIPMENT)

export const isEquipment = (value: unknown): value is Equipment => typeof value === 'string' && EQUIPMENT_SET.has(value)

export const asEquipment = (value: unknown): Equipment | null => (isEquipment(value) ? value : null)

// --- Legacy free-text muscle_group ------------------------------------------

// Before the taxonomy, muscle_group was free text typed in Czech or English.
// These are the spellings seen in real data plus their obvious siblings, keyed
// by the folded form (lowercase, no diacritics, single spaces).
const LEGACY_ALIASES: Record<string, MuscleKey> = {
    chest: 'chest',
    hrudnik: 'chest',
    prsa: 'chest',
    pecs: 'chest',
    back: 'back',
    zada: 'back',
    lats: 'lats',
    'siroky sval': 'lats',
    'siroke svaly': 'lats',
    'siroky sval zadovy': 'lats',
    traps: 'upper_back',
    trapez: 'upper_back',
    'upper back': 'upper_back',
    'horni zada': 'upper_back',
    'lower back': 'lower_back',
    'spodni zada': 'lower_back',
    'dolni zada': 'lower_back',
    shoulder: 'shoulders',
    shoulders: 'shoulders',
    ramena: 'shoulders',
    rameno: 'shoulders',
    delts: 'shoulders',
    deltoid: 'shoulders',
    delty: 'shoulders',
    'front delts': 'front_delts',
    'predni delty': 'front_delts',
    'predni delt': 'front_delts',
    'side delts': 'side_delts',
    'bocni delty': 'side_delts',
    'bocni delt': 'side_delts',
    'rear delts': 'rear_delts',
    'zadni delty': 'rear_delts',
    'zadni delt': 'rear_delts',
    arm: 'arms',
    arms: 'arms',
    ruce: 'arms',
    ruka: 'arms',
    paze: 'arms',
    biceps: 'biceps',
    bicepsy: 'biceps',
    triceps: 'triceps',
    tricepsy: 'triceps',
    forearm: 'forearms',
    forearms: 'forearms',
    predlokti: 'forearms',
    leg: 'legs',
    legs: 'legs',
    nohy: 'legs',
    noha: 'legs',
    quads: 'quads',
    stehna: 'quads',
    'predni stehna': 'quads',
    kvadriceps: 'quads',
    kvadricepsy: 'quads',
    'ctyrhlavy sval': 'quads',
    'zadni stehna': 'hamstrings',
    hamstrings: 'hamstrings',
    hamstringy: 'hamstrings',
    glutes: 'glutes',
    hyzde: 'glutes',
    zadek: 'glutes',
    calves: 'calves',
    lytka: 'calves',
    core: 'core',
    'stred tela': 'core',
    stred: 'core',
    abs: 'abs',
    bricho: 'abs',
    brisaky: 'abs',
    obliques: 'obliques',
    'sikme svaly': 'obliques',
    'full body': 'full_body',
    fullbody: 'full_body',
    'full-body': 'full_body',
    'cele telo': 'full_body',
    cardio: 'cardio',
    kardio: 'cardio',
}

const foldText = (value: string): string =>
    value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()

// "prsa, triceps, rameno" and friends: a list typed into the one free-text
// field. A hyphen ("Ramena-Triceps") only splits a token that isn't itself an
// alias, so "full-body, cardio" keeps full body.
const LEGACY_SEPARATORS = /\s*(?:,|;|\/|\+|&|\ba\b|\band\b)\s*/
const HYPHEN = /\s*-\s*/

// An alias, or a canonical key written out (CSV export uses keys, and a user
// may type "front delts" for front_delts).
const keyForToken = (token: string): MuscleKey | undefined => {
    const alias = LEGACY_ALIASES[token]
    if (alias) return alias
    const asKey = token.replace(/ /g, '_')
    return isMuscleKey(asKey) ? asKey : undefined
}

export type ExerciseMuscles = {
    primary: MuscleKey | null
    secondary: MuscleKey[]
}

// Maps a legacy free-text value onto the taxonomy: the first recognized entry
// is the primary Muscle, the rest are secondary. Unrecognized text yields no
// primary — the raw value is kept in muscle_group, never discarded.
export const mapLegacyMuscleGroup = (raw: string | null | undefined): ExerciseMuscles => {
    if (!raw) return { primary: null, secondary: [] }
    const folded = foldText(raw)
    const whole = keyForToken(folded)
    const keys = whole
        ? [whole]
        : folded.split(LEGACY_SEPARATORS).flatMap((token) => {
              const key = keyForToken(token)
              if (key) return [key]
              return token.split(HYPHEN).flatMap((part) => {
                  const partKey = keyForToken(part)
                  return partKey ? [partKey] : []
              })
          })
    const [primary = null, ...rest] = [...new Set(keys)]
    return { primary, secondary: rest }
}

// --- Reading an Exercise -----------------------------------------------------

export type ExerciseTaxonomyFields = {
    primary_muscle?: string | null
    secondary_muscles?: unknown
    muscle_group?: string | null
}

// Stored secondary Muscles as raw strings: the local TEXT column holds a JSON
// string, the remote jsonb column an array. Unknown keys are *kept* here so a
// key written by a newer client survives this device's next push; readers
// filter through parseSecondaryMuscles.
export const parseStoredMuscleList = (raw: unknown): string[] => {
    let values: unknown = raw
    if (typeof raw === 'string') {
        try {
            values = JSON.parse(raw)
        } catch {
            return []
        }
    }
    if (!Array.isArray(values)) return []
    return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))]
}

// Unique known keys, in order, without the primary.
const normalizeMuscleKeys = (values: readonly unknown[], primary: MuscleKey | null): MuscleKey[] =>
    [...new Set(values.filter(isMuscleKey))].filter((key) => key !== primary)

// The usable secondary Muscles of a stored value: known keys only, no primary.
export const parseSecondaryMuscles = (raw: unknown, primary: MuscleKey | null = null): MuscleKey[] =>
    normalizeMuscleKeys(parseStoredMuscleList(raw), primary)

export const serializeSecondaryMuscles = (keys: readonly MuscleKey[], primary: MuscleKey | null): string =>
    JSON.stringify(normalizeMuscleKeys(keys, primary))

// Whether an Exercise's explicit keys are current. A taxonomy-aware client
// always writes muscle_group as the primary Muscle's group key; any other
// non-empty value there was written later by an older app version that only
// knows the free-text field, and that newer edit wins.
const explicitKeysAreCurrent = (primary: MuscleKey, muscleGroup: string | null | undefined): boolean =>
    !muscleGroup || muscleGroup === muscleGroupOf(primary)

// Whether the Exercise carries explicit, current taxonomy keys (as opposed to
// Muscles derived from legacy text).
export const hasExplicitMuscles = (exercise: ExerciseTaxonomyFields): boolean => {
    const primary = asMuscleKey(exercise.primary_muscle)
    return !!primary && explicitKeysAreCurrent(primary, exercise.muscle_group)
}

// The one way to read an Exercise's Muscles. An Exercise saved since the
// taxonomy carries explicit keys; an older one — or one an older app version
// edited since — is derived from its legacy muscle_group text at read time, so
// no data migration is needed (ADR-0007).
export const resolveExerciseMuscles = (exercise: ExerciseTaxonomyFields): ExerciseMuscles => {
    const primary = asMuscleKey(exercise.primary_muscle)
    if (primary && explicitKeysAreCurrent(primary, exercise.muscle_group)) {
        return { primary, secondary: parseSecondaryMuscles(exercise.secondary_muscles, primary) }
    }
    return mapLegacyMuscleGroup(exercise.muscle_group)
}

// The Muscle Group an Exercise counts towards (dashboards, sections, filters).
export const resolveExerciseMuscleGroup = (exercise: ExerciseTaxonomyFields): MuscleGroup | null => {
    const { primary } = resolveExerciseMuscles(exercise)
    return primary ? muscleGroupOf(primary) : null
}

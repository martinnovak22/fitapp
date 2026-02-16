import { RemoteDataProvider } from '@/src/data/remote/provider';
import { Exercise, ExerciseType } from '@/src/db/exercises';
import { ExerciseHistory, SetData, SetWithExerciseName, Workout } from '@/src/db/workouts';
import { createEntityUuid, nowIso } from '@/src/db/sync';
import { getSupabaseSession } from '@/src/data/remote/supabase/session';
import { SupabaseConfig, getSupabaseConfig } from '@/src/data/remote/supabase/config';

type SupabaseSetRow = {
  id: number;
  workout_id: number;
  exercise_id: number;
  weight?: number | null;
  reps?: number | null;
  distance?: number | null;
  duration?: number | null;
  rpe?: number | null;
  position: number;
  sub_sets?: string | null;
  exercises?: { name: string } | { name: string }[] | null;
};

const buildQuery = (params: Record<string, string | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, value);
  });
  return query.toString();
};

const request = async <T>(
  config: SupabaseConfig,
  table: string,
  options?: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    query?: Record<string, string | undefined>;
    body?: unknown;
    prefer?: string;
    accessToken?: string;
  },
): Promise<T> => {
  const query = options?.query ? buildQuery(options.query) : '';
  const url = `${config.url}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const response = await fetch(url, {
    method: options?.method ?? 'GET',
    headers: {
      apikey: config.publicKey,
      Authorization: `Bearer ${options?.accessToken ?? config.publicKey}`,
      'Content-Type': 'application/json',
      ...(options?.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : (null as T);
  if (!response.ok) {
    throw new Error(`[supabase-provider] ${response.status} ${response.statusText}: ${text}`);
  }
  return payload;
};

const parseFirst = <T>(rows: T[]): T | null => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
};

const getRequiredSession = () => {
  const session = getSupabaseSession();
  if (!session?.accessToken || !session.userId) {
    throw new Error('[supabase-provider] Missing authenticated session. Set session after sign-in.');
  }
  return session;
};

const createExerciseRepository = (config: SupabaseConfig) => ({
  getAll: async (): Promise<Exercise[]> => {
    const session = getRequiredSession();
    return request<Exercise[]>(config, 'exercises', {
      query: {
        select: '*',
        user_id: `eq.${session.userId}`,
        deleted_at: 'is.null',
        order: 'position.asc,name.asc',
      },
      accessToken: session.accessToken,
    });
  },
  getById: async (id: number): Promise<Exercise | null> => {
    const session = getRequiredSession();
    const rows = await request<Exercise[]>(config, 'exercises', {
      query: { select: '*', id: `eq.${id}`, user_id: `eq.${session.userId}`, deleted_at: 'is.null', limit: '1' },
      accessToken: session.accessToken,
    });
    return parseFirst(rows);
  },
  create: async (
    name: string,
    type: ExerciseType,
    muscle_group?: string,
    photo_uri?: string,
  ): Promise<number> => {
    const session = getRequiredSession();
    const existing = await request<{ position: number }[]>(config, 'exercises', {
      query: { select: 'position', user_id: `eq.${session.userId}`, order: 'position.desc', limit: '1', deleted_at: 'is.null' },
      accessToken: session.accessToken,
    });
    const nextPosition = existing.length > 0 ? existing[0].position + 1 : 0;
    const now = nowIso();
    const rows = await request<{ id: number }[]>(config, 'exercises', {
      method: 'POST',
      query: { select: 'id' },
      prefer: 'return=representation',
      body: {
        uuid: createEntityUuid(),
        user_id: session.userId,
        name,
        type,
        muscle_group: muscle_group ?? null,
        photo_uri: photo_uri ?? null,
        position: nextPosition,
        created_at: now,
        updated_at: now,
        sync_status: 'dirty',
      },
      accessToken: session.accessToken,
    });
    const inserted = parseFirst(rows);
    if (!inserted) throw new Error('[supabase-provider] exercises.create returned no row.');
    return inserted.id;
  },
  update: async (id: number, data: Partial<Exercise>): Promise<void> => {
    const session = getRequiredSession();
    const payload: Record<string, unknown> = {
      updated_at: nowIso(),
      sync_status: 'dirty',
    };
    if (data.name !== undefined) payload.name = data.name;
    if (data.type !== undefined) payload.type = data.type;
    if (data.muscle_group !== undefined) payload.muscle_group = data.muscle_group ?? null;
    if (data.photo_uri !== undefined) payload.photo_uri = data.photo_uri ?? null;
    if (data.position !== undefined) payload.position = data.position;
    await request<unknown>(config, 'exercises', {
      method: 'PATCH',
      query: { id: `eq.${id}`, user_id: `eq.${session.userId}` },
      body: payload,
      accessToken: session.accessToken,
    });
  },
  updatePositions: async (updates: { id: number; position: number }[]): Promise<void> => {
    const session = getRequiredSession();
    for (const update of updates) {
      await request<unknown>(config, 'exercises', {
        method: 'PATCH',
        query: { id: `eq.${update.id}`, user_id: `eq.${session.userId}` },
        body: {
          position: update.position,
          updated_at: nowIso(),
          sync_status: 'dirty',
        },
        accessToken: session.accessToken,
      });
    }
  },
  delete: async (id: number): Promise<void> => {
    const session = getRequiredSession();
    await request<unknown>(config, 'exercises', {
      method: 'PATCH',
      query: { id: `eq.${id}`, user_id: `eq.${session.userId}` },
      body: {
        deleted_at: nowIso(),
        updated_at: nowIso(),
        sync_status: 'dirty',
      },
      accessToken: session.accessToken,
    });
  },
});

const createWorkoutRepository = (config: SupabaseConfig) => ({
  create: async (date: string): Promise<number> => {
    const session = getRequiredSession();
    const now = nowIso();
    const rows = await request<{ id: number }[]>(config, 'workouts', {
      method: 'POST',
      query: { select: 'id' },
      prefer: 'return=representation',
      body: {
        uuid: createEntityUuid(),
        user_id: session.userId,
        date,
        start_time: now,
        status: 'in_progress',
        created_at: now,
        updated_at: now,
        sync_status: 'dirty',
      },
      accessToken: session.accessToken,
    });
    const inserted = parseFirst(rows);
    if (!inserted) throw new Error('[supabase-provider] workouts.create returned no row.');
    return inserted.id;
  },
  finish: async (id: number): Promise<void> => {
    const session = getRequiredSession();
    await request<unknown>(config, 'workouts', {
      method: 'PATCH',
      query: { id: `eq.${id}`, user_id: `eq.${session.userId}` },
      body: {
        end_time: nowIso(),
        status: 'finished',
        updated_at: nowIso(),
        sync_status: 'dirty',
      },
      accessToken: session.accessToken,
    });
  },
  delete: async (id: number): Promise<void> => {
    const session = getRequiredSession();
    await request<unknown>(config, 'workouts', {
      method: 'PATCH',
      query: { id: `eq.${id}`, user_id: `eq.${session.userId}` },
      body: {
        deleted_at: nowIso(),
        updated_at: nowIso(),
        sync_status: 'dirty',
      },
      accessToken: session.accessToken,
    });
  },
  getById: async (id: number): Promise<Workout | null> => {
    const session = getRequiredSession();
    const rows = await request<Workout[]>(config, 'workouts', {
      query: { select: '*', id: `eq.${id}`, user_id: `eq.${session.userId}`, deleted_at: 'is.null', limit: '1' },
      accessToken: session.accessToken,
    });
    return parseFirst(rows);
  },
  getActiveWorkout: async (): Promise<Workout | null> => {
    const session = getRequiredSession();
    const rows = await request<Workout[]>(config, 'workouts', {
      query: {
        select: '*',
        user_id: `eq.${session.userId}`,
        status: 'eq.in_progress',
        deleted_at: 'is.null',
        order: 'start_time.desc',
        limit: '1',
      },
      accessToken: session.accessToken,
    });
    return parseFirst(rows);
  },
  getAllWorkouts: async (): Promise<Workout[]> => {
    const session = getRequiredSession();
    return request<Workout[]>(config, 'workouts', {
      query: {
        select: '*',
        user_id: `eq.${session.userId}`,
        deleted_at: 'is.null',
        order: 'date.desc,start_time.desc',
      },
      accessToken: session.accessToken,
    });
  },
  getWorkoutsForDate: async (date: string): Promise<Workout[]> => {
    const session = getRequiredSession();
    return request<Workout[]>(config, 'workouts', {
      query: { select: '*', date: `eq.${date}`, user_id: `eq.${session.userId}`, deleted_at: 'is.null' },
      accessToken: session.accessToken,
    });
  },
  getWorkoutsForPeriod: async (startDate: string, endDate: string): Promise<Workout[]> => {
    const session = getRequiredSession();
    return request<Workout[]>(config, 'workouts', {
      query: {
        select: '*',
        user_id: `eq.${session.userId}`,
        and: `(date.gte.${startDate},date.lte.${endDate})`,
        deleted_at: 'is.null',
        order: 'date.asc',
      },
      accessToken: session.accessToken,
    });
  },
  getRecentWorkouts: async (limit: number = 3): Promise<Workout[]> => {
    const session = getRequiredSession();
    return request<Workout[]>(config, 'workouts', {
      query: {
        select: '*',
        user_id: `eq.${session.userId}`,
        status: 'eq.finished',
        deleted_at: 'is.null',
        order: 'date.desc,start_time.desc',
        limit: String(limit),
      },
      accessToken: session.accessToken,
    });
  },
  addSet: async (workoutId: number, exerciseId: number, data: SetData): Promise<void> => {
    const session = getRequiredSession();
    const existing = await request<{ position: number }[]>(config, 'sets', {
      query: {
        select: 'position',
        workout_id: `eq.${workoutId}`,
        user_id: `eq.${session.userId}`,
        deleted_at: 'is.null',
        order: 'position.desc',
        limit: '1',
      },
      accessToken: session.accessToken,
    });
    const nextPosition = existing.length > 0 ? existing[0].position + 1 : 0;
    await request<unknown>(config, 'sets', {
      method: 'POST',
      body: {
        uuid: createEntityUuid(),
        user_id: session.userId,
        workout_id: workoutId,
        exercise_id: exerciseId,
        weight: data.weight ?? null,
        reps: data.reps ?? null,
        distance: data.distance ?? null,
        duration: data.duration ?? null,
        position: nextPosition,
        sub_sets: data.sub_sets ?? null,
        created_at: nowIso(),
        updated_at: nowIso(),
        sync_status: 'dirty',
      },
      accessToken: session.accessToken,
    });
  },
  updateSet: async (setId: number, data: SetData): Promise<void> => {
    const session = getRequiredSession();
    await request<unknown>(config, 'sets', {
      method: 'PATCH',
      query: { id: `eq.${setId}`, user_id: `eq.${session.userId}` },
      body: {
        weight: data.weight ?? null,
        reps: data.reps ?? null,
        distance: data.distance ?? null,
        duration: data.duration ?? null,
        sub_sets: data.sub_sets ?? null,
        updated_at: nowIso(),
        sync_status: 'dirty',
      },
      accessToken: session.accessToken,
    });
  },
  deleteSet: async (setId: number): Promise<void> => {
    const session = getRequiredSession();
    await request<unknown>(config, 'sets', {
      method: 'PATCH',
      query: { id: `eq.${setId}`, user_id: `eq.${session.userId}` },
      body: {
        deleted_at: nowIso(),
        updated_at: nowIso(),
        sync_status: 'dirty',
      },
      accessToken: session.accessToken,
    });
  },
  updateSetPosition: async (setId: number, position: number): Promise<void> => {
    const session = getRequiredSession();
    await request<unknown>(config, 'sets', {
      method: 'PATCH',
      query: { id: `eq.${setId}`, user_id: `eq.${session.userId}` },
      body: {
        position,
        updated_at: nowIso(),
        sync_status: 'dirty',
      },
      accessToken: session.accessToken,
    });
  },
  getSets: async (workoutId: number): Promise<SetWithExerciseName[]> => {
    const session = getRequiredSession();
    const rows = await request<SupabaseSetRow[]>(config, 'sets', {
      query: {
        select: '*,exercises(name)',
        workout_id: `eq.${workoutId}`,
        user_id: `eq.${session.userId}`,
        deleted_at: 'is.null',
        order: 'position.asc,id.asc',
      },
      accessToken: session.accessToken,
    });
    return rows.map((row) => {
      const exerciseValue = row.exercises;
      const exerciseObj = Array.isArray(exerciseValue) ? exerciseValue[0] : exerciseValue;
      return {
        ...row,
        exercise_name: exerciseObj?.name ?? '',
      } as SetWithExerciseName;
    });
  },
  getExerciseHistory: async (exerciseId: number): Promise<ExerciseHistory[]> => {
    const session = getRequiredSession();
    const sets = await request<{ workout_id: number; weight?: number | null; reps?: number | null; distance?: number | null; duration?: number | null }[]>(
      config,
      'sets',
      {
        query: {
          select: 'workout_id,weight,reps,distance,duration',
          exercise_id: `eq.${exerciseId}`,
          user_id: `eq.${session.userId}`,
          deleted_at: 'is.null',
        },
        accessToken: session.accessToken,
      },
    );
    if (sets.length === 0) return [];

    const workoutIds = [...new Set(sets.map((item) => item.workout_id))];
    const workouts = await request<{ id: number; date: string; status: string }[]>(config, 'workouts', {
      query: {
        select: 'id,date,status',
        id: `in.(${workoutIds.join(',')})`,
        user_id: `eq.${session.userId}`,
        status: 'eq.finished',
        deleted_at: 'is.null',
      },
      accessToken: session.accessToken,
    });
    const workoutDateById = new Map(workouts.map((workout) => [workout.id, workout.date]));
    const grouped = new Map<string, ExerciseHistory>();

    sets.forEach((set) => {
      const workoutDate = workoutDateById.get(set.workout_id);
      if (!workoutDate) return;
      const current = grouped.get(workoutDate) ?? {
        date: workoutDate,
        max_weight: 0,
        max_reps: 0,
        max_distance: 0,
        max_duration: 0,
      };
      current.max_weight = Math.max(current.max_weight, set.weight ?? 0);
      current.max_reps = Math.max(current.max_reps, set.reps ?? 0);
      current.max_distance = Math.max(current.max_distance, set.distance ?? 0);
      current.max_duration = Math.max(current.max_duration, set.duration ?? 0);
      grouped.set(workoutDate, current);
    });

    return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date));
  },
  getWorkoutCountForMonth: async (month: string): Promise<number> => {
    const session = getRequiredSession();
    const workouts = await request<{ id: number }[]>(config, 'workouts', {
      query: {
        select: 'id',
        user_id: `eq.${session.userId}`,
        status: 'eq.finished',
        date: `like.${month}*`,
        deleted_at: 'is.null',
      },
      accessToken: session.accessToken,
    });
    return workouts.length;
  },
  getAvgWorkoutDuration: async (month: string): Promise<number> => {
    const session = getRequiredSession();
    const workouts = await request<{ start_time?: string | null; end_time?: string | null }[]>(config, 'workouts', {
      query: {
        select: 'start_time,end_time',
        user_id: `eq.${session.userId}`,
        status: 'eq.finished',
        date: `like.${month}*`,
        deleted_at: 'is.null',
      },
      accessToken: session.accessToken,
    });
    const durations = workouts
      .filter((workout) => !!workout.start_time && !!workout.end_time)
      .map((workout) => {
        const start = new Date(workout.start_time as string).getTime();
        const end = new Date(workout.end_time as string).getTime();
        return (end - start) / 60000;
      })
      .filter((duration) => Number.isFinite(duration) && duration >= 0);
    if (durations.length === 0) return 0;
    const total = durations.reduce((sum, current) => sum + current, 0);
    return total / durations.length;
  },
});

export const createSupabaseProvider = (): RemoteDataProvider | null => {
  const config = getSupabaseConfig();
  if (!config) return null;

  return {
    name: 'supabase',
    exercises: createExerciseRepository(config),
    workouts: createWorkoutRepository(config),
    healthcheck: async () => {
      const response = await fetch(`${config.url}/rest/v1/`, {
        method: 'GET',
        headers: {
          apikey: config.publicKey,
          Authorization: `Bearer ${config.publicKey}`,
        },
      });
      if (!response.ok) {
        throw new Error(`[supabase-provider] healthcheck failed with status ${response.status}`);
      }
    },
  };
};

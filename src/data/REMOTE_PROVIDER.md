# Remote Data Provider Hookup

This project now supports runtime repository mode switching:

- `local` (default): uses SQLite repositories.
- `remote`: requires a registered remote provider that implements repository ports.

## Env switch

Set:

`EXPO_PUBLIC_DATA_MODE=remote`

For Supabase auto-registration, also set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (preferred)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (legacy fallback)

If no provider is registered, the app logs a warning and falls back to local mode.

## Provider contract

Implement `RemoteDataProvider` from:

`/Users/martinnovak/Documents/GitHub/fitapp/src/data/remote/provider.ts`

It must provide:

- `exercises` repository (same methods as local port)
- `workouts` repository (same methods as local port)
- `name`

Optional:

- `healthcheck()`

## Bootstrapping provider

At app startup (before first data calls), register provider:

```ts
import { registerRemoteProvider } from '@/src/data/bootstrap';
import { createYourProvider } from '@/src/data/remote/your-provider';

registerRemoteProvider(createYourProvider());
```

`initializeDataLayer()` is already called in `/Users/martinnovak/Documents/GitHub/fitapp/app/_layout.tsx`.

You can also rely on the built-in Supabase scaffold:

- `/Users/martinnovak/Documents/GitHub/fitapp/src/data/remote/supabase/provider.ts`
- `/Users/martinnovak/Documents/GitHub/fitapp/src/data/remote/supabase/session.ts`

When Supabase env vars are present, bootstrap auto-registers this provider.

## Auth/session bridge (required for remote mode)

Remote data calls require authenticated user context.
After successful sign-in, set session:

```ts
import { setSupabaseSession } from '@/src/data/remote/supabase/session';

setSupabaseSession({
  accessToken: session.access_token,
  userId: session.user.id,
});
```

On logout:

```ts
import { clearSupabaseSession } from '@/src/data/remote/supabase/session';
clearSupabaseSession();
```

## When to create cloud DB

Create your cloud DB **before** setting `EXPO_PUBLIC_DATA_MODE=remote` in any environment where users run the app.

Minimum go-live checklist:

1. Tables mirror repository fields (`exercises`, `workouts`, `sets`, plus sync metadata fields).
2. Auth/user model is decided (`user_id` population strategy).
3. Remote provider is registered and passing `healthcheck`.
4. Smoke test CRUD on exercise/workout/set from device.

Use this SQL as baseline for account-based RLS:

- `/Users/martinnovak/Documents/GitHub/fitapp/supabase/schema_account_rls.sql`

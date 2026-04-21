# Remote production setup

For remote updates, the Android TV box must talk to a public backend URL. The flow is:

```txt
Admin browser -> https://dial-indooh.vercel.app -> Next.js API -> Supabase PostgreSQL
Android TV APK -> https://dial-indooh.vercel.app/api -> Supabase PostgreSQL
```

The TV box only needs internet access. It does not need to be on the same Wi-Fi as your computer.

## 1. Deploy the web/admin app

Deploy `apps/web` as a public Next.js app. Vercel is the easiest option for this stack.

Required production environment variables:

```env
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@[POOLER-HOST]:5432/postgres"
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@[POOLER-HOST]:5432/postgres"
AUTH_SECRET="replace-with-a-long-random-secret"
NEXT_PUBLIC_APP_URL="https://dial-indooh.vercel.app"
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="YOUR_SUPABASE_PUBLISHABLE_KEY"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVER_ONLY_SERVICE_ROLE_KEY"
NEXT_PUBLIC_DEMO_MODE="false"
MEDIA_STORAGE_BUCKET="dial-indooh-media"
MEDIA_STORAGE_PUBLIC_URL="https://YOUR_PROJECT.supabase.co/storage/v1/object/public/dial-indooh-media"
```

For this Supabase project, the working IPv4 Session Pooler host found locally was:

```txt
aws-1-us-east-2.pooler.supabase.com
```

The `SUPABASE_SERVICE_ROLE_KEY` is available in Supabase under Project Settings -> API. It is required only for the Next.js server route that creates signed upload URLs.

## 2. Sync database

The Supabase database has already been synced locally with:

```bash
npx prisma db push --schema prisma/schema.prisma
npm run db:seed
```

For future schema changes, run the same commands against the Supabase database.

## 3. Configure TV APK

Before building the APK, set `apps/tv/.env`:

```env
EXPO_PUBLIC_API_BASE_URL="https://dial-indooh.vercel.app/api"
EXPO_PUBLIC_DEVICE_CHANNEL="stable"
EXPO_PUBLIC_PLAYLIST_REFRESH_MINUTES="5"
EXPO_PUBLIC_HEARTBEAT_MINUTES="2"
```

The API URL is compiled into the APK, so rebuild the APK whenever this URL changes.

## 4. Build APK

```bash
cd apps/tv
npm run eas:login
npm run build:apk
```

Install the generated APK on the Android TV box.

## 5. Remote operation

After activation, the TV app stores its `deviceKey` locally. From then on:

- playlist changes made in the admin panel are fetched by the TV app during refresh
- media URLs are downloaded and cached by the TV app
- heartbeats update screen status remotely
- if the internet drops, the TV app continues using the last cached playlist

## Important

Media uploads use Supabase Storage. Keep `SUPABASE_SERVICE_ROLE_KEY` only on the server or Vercel environment; never expose it in the Expo app or browser code. The upload API creates a signed upload URL, the admin browser uploads the file directly to Supabase, and the TV app downloads the final public media URL.

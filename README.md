# Dial indoor Platform

sistema integrado com tv para indoor

Foundation for a full-stack indoor digital signage platform where admins upload media, build playlists, assign playlists to screens, and Android TV boxes fetch and play content remotely.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS with shadcn/ui-style primitives
- Prisma with PostgreSQL
- Expo React Native app for Android TV boxes
- npm workspaces monorepo

## Structure

```txt
apps/
  web/              Next.js admin dashboard
  tv/               Expo Android TV player app
packages/
  shared/           Shared TypeScript DTOs and API response types
prisma/
  schema.prisma     Database schema
docs/
  next-steps.md     Suggested implementation roadmap
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment files:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/tv/.env.example apps/tv/.env
```

3. Start PostgreSQL and update `DATABASE_URL`.

For Supabase on an IPv4-only network, use the Session Pooler string from the Supabase Connect panel. For this project, the working pooler host is `aws-1-us-east-2.pooler.supabase.com` and the user is `postgres.hqclhdruysrerqeoomrr`:

```env
DATABASE_URL="postgresql://postgres.hqclhdruysrerqeoomrr:[YOUR-PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
DIRECT_URL="postgresql://postgres.hqclhdruysrerqeoomrr:[YOUR-PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://hqclhdruysrerqeoomrr.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
SUPABASE_SERVICE_ROLE_KEY="your-server-only-service-role-key"
NEXT_PUBLIC_DEMO_MODE="false"
MEDIA_STORAGE_BUCKET="dial-indooh-media"
MEDIA_STORAGE_PUBLIC_URL="https://hqclhdruysrerqeoomrr.supabase.co/storage/v1/object/public/dial-indooh-media"
```

4. Generate Prisma client and sync the database:

```bash
npm run prisma:generate
npx prisma db push --schema prisma/schema.prisma
```

5. Seed demo data:

```bash
npm run db:seed
```

The seed creates `admin@dialindooh.local` with password `Admin123!`, a demo screen with activation code `DEMO01`, demo media, and a demo playlist.

6. Run the admin web app:

```bash
npm run dev:web
```

7. Run the Expo TV app:

```bash
npm run dev:tv
```

For Android TV boxes, set `apps/tv/.env` from `apps/tv/.env.example`, then run:

```bash
npm run android -w @dialindooh/tv
```

The TV app stores activation locally, fetches `/api/screens/:id/playlist` with the `deviceKey`, caches media in the device filesystem, loops playlist items, falls back to the last cached playlist when offline, posts heartbeats periodically, records playback events, and polls remote commands.

The Expo TV app is also prepared for EAS Updates with the configured project URL. Use APK builds for native/runtime changes and EAS updates for compatible JavaScript fixes.

## Backend API

Admin routes require either the `dial_indooh_admin` cookie created by login or an `Authorization: Bearer <token>` header.

- `POST /api/auth/login`
- `GET /api/media`
- `POST /api/media/upload-url`
- `POST /api/media`
- `DELETE /api/media/:id`
- `GET /api/playlists`
- `POST /api/playlists`
- `GET /api/playlists/:id`
- `PATCH /api/playlists/:id`
- `POST /api/playlists/:id/items`
- `PATCH /api/playlists/:id/items/reorder`
- `DELETE /api/playlists/:id/items/:itemId`
- `GET /api/screens`
- `POST /api/screens`
- `PATCH /api/screens/:id`
- `GET /api/screens/:id`
- `GET /api/screens/:id/events`
- `POST /api/screens/:id/commands`

Device routes use `x-device-key: <deviceKey>` or `Authorization: Bearer <deviceKey>` after activation.

- `POST /api/screens/activate`
- `GET /api/screens/:id/playlist`
- `POST /api/screens/:id/heartbeat`
- `POST /api/screens/:id/events`
- `GET /api/screens/:id/commands`
- `POST /api/screens/:id/commands/ack`

## Admin UI Notes

- The admin UI uses the secure `dial_indooh_admin` HTTP-only cookie created by `/api/auth/login`.
- Media upload uses Supabase Storage signed upload URLs. The browser uploads files directly to the public media bucket, then the API stores the resulting public URL in PostgreSQL.
- Video duration is detected in the browser before saving media, so playlist video timing is automatic.
- Playlist windows can be scheduled with start/end times. The TV only receives assigned playlists whose schedule is currently active.
- The screen detail drawer shows recent TV events and recent commands. Commands available now: refresh playlist, clear cache, restart player, and reload app.
- Screen status is derived from recent heartbeat activity, so a box becomes offline automatically if it stops reporting.
- The UI adds practical backend operations beyond the initial API list: `GET /api/screens/:id`, screen event/command APIs, and `PATCH /api/playlists/:id/items/:itemId` for image display duration edits.

## Current Foundation

- Prisma models for users, media, playlists, playlist items, screens, assignments, heartbeats, TV events, and remote commands.
- Prisma-backed service layer with validation and business rules.
- Route handlers for admin, media, playlist, screen, activation, playlist sync, heartbeat, event, and command APIs.
- Shared DTOs for media, playlists, screens, activation, heartbeat, events, commands, and API responses.
- Admin dashboard UI for login, dashboard analytics, media, playlists, screens, and settings.
- Expo Android TV app with loading, activation, cache-first playlist sync, fullscreen looping playback, offline mode, heartbeats, event reporting, remote command polling, and EAS Update preparation.

## Production Notes

- For the most reliable playback on low-cost TV boxes, upload H.264 MP4 videos with AAC audio and landscape 16:9 framing when possible.
- Heavy video transcoding should run in a worker service or media pipeline outside Vercel. The database already has media status fields (`pending`, `processing`, `ready`, `failed`) so that pipeline can be added without changing the player contract.
- Use the screen detail drawer to inspect the current playlist, heartbeat, app version, IP address, current media, playback errors, and remote command history.

## Next Steps

See [docs/next-steps.md](docs/next-steps.md).

# Dial Indooh Platform

sistema integrado com tv para indooh

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
NEXT_PUBLIC_DEMO_MODE="false"
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

The TV app stores activation locally, fetches `/api/screens/:id/playlist` with the `deviceKey`, caches media in the device filesystem, loops playlist items, falls back to the last cached playlist when offline, and posts heartbeats periodically.

## Backend API

Admin routes require either the `dial_indooh_admin` cookie created by login or an `Authorization: Bearer <token>` header.

- `POST /api/auth/login`
- `GET /api/media`
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

Device routes use `x-device-key: <deviceKey>` or `Authorization: Bearer <deviceKey>` after activation.

- `POST /api/screens/activate`
- `GET /api/screens/:id/playlist`
- `POST /api/screens/:id/heartbeat`

## Admin UI Notes

- The admin UI uses the secure `dial_indooh_admin` HTTP-only cookie created by `/api/auth/login`.
- Media upload is currently an integration-ready placeholder: the UI simulates progress and records media metadata with a generated CDN URL. Replace `uploadMediaPlaceholder` with real object storage upload when storage is configured.
- The UI adds two practical backend operations beyond the initial API list: `GET /api/screens/:id` for screen detail metadata and `PATCH /api/playlists/:id/items/:itemId` for image display duration edits.

## Current Foundation

- Prisma models for users, media, playlists, playlist items, screens, assignments, and heartbeats.
- Prisma-backed service layer with validation and business rules.
- Route handlers for admin, media, playlist, screen, activation, playlist sync, and heartbeat APIs.
- Shared DTOs for media, playlists, screens, activation, heartbeat, and API responses.
- Admin dashboard UI for login, dashboard analytics, media, playlists, screens, and settings.
- Expo app shell with loading, activation, and player placeholder screens.

## Next Steps

See [docs/next-steps.md](docs/next-steps.md).

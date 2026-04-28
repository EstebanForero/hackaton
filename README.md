# Atelier AI Store

Modern light-mode clothing storefront built with TanStack Start, TanStack Query,
TypeScript, Drizzle, and PostgreSQL 18.3.

## Run locally

1. Start infrastructure:

   ```sh
   docker compose -f dockercompose-infra.yml up -d
   ```

2. Configure environment:

   ```sh
   cp .env.example .env
   ```

3. Install and run:

   ```sh
   bun install
   bun run dev
   ```

`bun run dev` waits for Postgres, applies Drizzle migrations, seeds the clothing
catalog, and starts TanStack Start on port 3000.

PostgreSQL 18 Docker images expect the database volume to be mounted at
`/var/lib/postgresql`, not `/var/lib/postgresql/data`. This compose file uses a
Postgres-18-specific named volume to avoid incompatible data left by older
mount layouts.

## Key Paths

- `src/routes/index.tsx`: public storefront.
- `src/routes/studio.tsx`: physical-store camera and voice assistant tab.
- `src/components/VoiceTryOnStudio.tsx`: Web Speech, camera capture, local
  recommendation logic, and virtual try-on trigger.
- `src/server/products.ts`: TanStack server functions for catalog search and
  try-on handoff.
- `src/db/products-seed.ts`: seeded clothing products with descriptions, image
  URLs, alt text, and image descriptions.
- `drizzle/0000_initial_catalog.sql`: initial migration.

## AI Models

The app separates model responsibilities:

- `GEMINI_CHAT_MODEL=gemini-3-flash-preview` for stylist reasoning, search planning,
  outfit grouping, and tool decisions.
- `GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview` for real-time Live API voice
  sessions. This model uses synchronous Live function calling.
- `GEMINI_IMAGE_MODEL=gemini-3.1-flash-image-preview` for camera-photo virtual try-on.
- `GEMINI_TTS_MODEL=gemini-3.1-flash-tts-preview` for optional model-spoken
  replies. Gemini TTS is currently Preview, so browser speech synthesis remains
  the fallback.

Run `npm run check:gemini-models` to verify the configured Gemini model IDs and
basic chat, Live token, image, and TTS calls against the API.

Without `GEMINI_API_KEY`, the try-on endpoint returns the captured photo and the
exact generation prompt instead of calling an external model.

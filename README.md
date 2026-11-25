# Elsewhere

Elsewhere is a full-stack archive for fictional worlds. It includes user authentication and world management with private and public visibility.

## Tech Stack

- **Web:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **API:** Hono, Bun
- **Database:** SQLite with Prisma
- **Validation:** Zod
- **Authentication:** Argon2 passwords and JWT cookie sessions

## Project Structure

```text
apps/
  api/      Standalone Hono API and Prisma database
  web/      Next.js web application and API route proxy
packages/
  shared/   Shared Zod schemas and TypeScript types
```

## Prerequisites

- [Bun](https://bun.sh/) 1.4 or newer

## Setup

Install dependencies:

```bash
bun install
```

Create the API environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

Generate a JWT secret:

```bash
bun -e "console.log(crypto.randomUUID() + crypto.randomUUID())"
```

Set `JWT_SECRET` to the generated value in `apps/api/.env`. The default `DATABASE_URL` uses `apps/api/dev.db`.

Create the web environment file:

```bash
cp apps/web/.env.example apps/web/.env
```

Use the same `JWT_SECRET` value in `apps/web/.env`.

Create the database:

```bash
bun run db:migrate
```

## Running Locally

Start the web application:

```bash
bun run dev:web
```

Open `http://localhost:3000`.

To run the standalone API server instead:

```bash
bun run dev:api
```

The standalone API listens on `http://localhost:3000`. When the Next.js server is running, API routes are available under `/api`.

## API Endpoints

### Health

- `GET /health` - API health check

### Authentication

- `POST /auth/register` - Create a user
- `POST /auth/login` - Log in
- `POST /auth/logout` - Log out
- `GET /auth/me` - Get the current user

### Worlds

- `POST /worlds` - Create a world
- `GET /worlds/mine` - List the current user's worlds
- `GET /worlds/:id` - Get a world
- `PATCH /worlds/:id` - Update a world
- `DELETE /worlds/:id` - Delete a world

## Development Commands

```bash
bun run dev:web       # Start the Next.js application
bun run dev:api       # Start the standalone Hono API
bun run build:web     # Build the web application
bun run test          # Run API tests
bun run typecheck     # Type-check all workspaces
bun run db:migrate    # Apply Prisma migrations
bun --filter @elsewhere/api db:generate
                       # Generate the Prisma client
```

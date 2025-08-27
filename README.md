# Sagarmatha AI

A modern Next.js 15 application that lets you create AI-powered coding projects. When you submit a prompt, an Inngest-powered agent spins up an E2B sandbox, generates code, writes files, and saves a runnable fragment link alongside the result in a Postgres database via Prisma. The UI is built with React 19, Shadcn UI, Tailwind CSS v4, and TanStack Query. APIs use tRPC v11 with superjson.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript, React 19
- **UI**: Shadcn UI (Radix primitives), Tailwind CSS v4, Lucide Icons
- **Data**: PostgreSQL, Prisma ORM (@prisma/client 6)
- **API**: tRPC v11 (server + client), superjson
- **Background/Agents**: Inngest 3, @inngest/agent-kit
- **Sandbox**: @e2b/code-interpreter
- **State/Fetching**: TanStack Query v5

## Features

- Create projects and send prompts to generate code fragments
- Inngest function `sagarmathaAI` orchestrates an AI agent that:
  - Creates an E2B sandbox
  - Runs terminal commands inside the sandbox
  - Creates/updates files in the sandbox
  - Persists a task summary and file map
  - Exposes a sandbox URL
- Messages and fragments persisted via Prisma models `Project`, `Message`, and `Fragment`
- tRPC endpoints for projects and messages

## Getting Started

### Prerequisites

- Node.js 18+ (recommended) and npm/yarn/pnpm
- PostgreSQL database URL
- Inngest account/keys (if running Inngest in cloud or dev server)
- E2B API key for sandboxing

### Environment Variables

Create a `.env` file in the project root with at least:

```bash
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DBNAME?schema=public"

# App base URL (for server-side tRPC client)
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Inngest
INNGEST_EVENT_KEY="<optional if using cloud/dev server>"
INNGEST_SIGNING_KEY="<optional>"

# E2B
E2B_API_KEY="<your_e2b_api_key>"
```

Note: Depending on your Inngest/E2B setup, additional env vars may be required. See their docs.

### Install Dependencies

```bash
npm install
# or
yarn install
```

### Database Setup

```bash
npx prisma migrate dev
npm run prisma:generate # optional if you want to force generation
```

The Prisma client is generated to `src/generated/prisma` (see `prisma/schema.prisma`). Seed if you add seeds:

```bash
npm run prisma:seed
```

### Development

```bash
npm run dev
```

Open `http://localhost:3000`.

### Production

```bash
npm run build
npm start
```

## App Flow

- Home page (`/`): create a project by entering initial prompt text. This calls `projects.create` via tRPC. On success, you are redirected to `/projects/[projectId]`.
- In `projects.create`, a `Project` is created with the first user `Message`, then an Inngest event `api/sagarmatha.ai` is sent.
- The Inngest function (`src/inngest/functions.ts`) runs an AI agent (Gemini model configured) that connects to an E2B sandbox, executes tools, and writes generated files. The final agent output is saved as an assistant `Message` with a related `Fragment` containing the sandbox URL, title, and files.
- Messages can be fetched via `messages.getMany` (includes fragments), and projects via `projects.getMany`.

## Key Endpoints and Files

- `src/app/api/trpc/[trpc]/route.ts`: tRPC HTTP handler
- `src/trpc/routers/_app.ts`: tRPC router combining `messages` and `projects`
- `src/modules/projects/server/procedures.ts`: create/get projects
- `src/modules/messages/server/procedures.ts`: create/get messages
- `src/inngest/functions.ts`: Inngest function and agent setup
- `src/inngest/prompt.ts`: system prompt and agent operating constraints
- `src/inngest/client.ts`: Inngest client
- `src/lib/dbConnection.ts`: Prisma client
- `prisma/schema.prisma`: data models

## Data Models (Prisma)

- `Project` (id, name, timestamps, messages)
- `Message` (id, content, role: USER/ASSISTANT, type: RESULT/ERROR, projectId, timestamps, optional `fragment`)
- `Fragment` (id, messageId unique, sandboxUrl, title, files JSON, timestamps)

## Running Inngest

This repo exposes an Inngest Next.js route at `src/app/api/inngest/route.ts`:

- Serves the `sagarmathaAI` function
- In dev, you can use the Inngest Dev Server (`npx inngest-cli@latest dev`) pointed at your app, or run in cloud. Configure credentials via env vars as needed.

## E2B Sandbox

The agent uses E2B to create a sandbox named `sagarmatha-nextjs-test`. Ensure your E2B account and API key are configured. The agent then runs commands and writes files via the E2B SDK.

## TRPC Client Usage

- On the client, `useTRPC()` and `TRPCReactProvider` from `src/trpc/client.tsx` are used, with `NEXT_PUBLIC_APP_URL` for SSR URL resolution.
- On the server, `src/trpc/server.tsx` exposes `trpc` options and a `caller` if needed.

## Development Notes

- Shadcn components live in `src/components/ui/*` and Tailwind CSS v4 is preconfigured in `globals.css`.
- Do not import `cn` from UI utilities; use `src/lib/utils.ts`.
- The agent prompt contains strict guidelines (e.g., use Tailwind classes only) that apply to code generated inside the sandbox, not necessarily to this app.

## Project Structure

- `src/app/*`: Next.js App Router pages, layouts, and API routes
- `src/modules/*`: Feature modules (server procedures)
- `src/trpc/*`: tRPC server and client setup
- `src/inngest/*`: Inngest client, function, and agent prompt
- `src/lib/*`: Shared utilities (Prisma, helpers)
- `prisma/*`: Prisma schema, migrations, seeds

## Troubleshooting

- Prisma client generation path mismatches: ensure `generator client.output` in `prisma/schema.prisma` points to `../src/generated/prisma` and imports use `@/generated/prisma`.
- tRPC base URL in SSR: ensure `NEXT_PUBLIC_APP_URL` is defined in `.env`.
- Inngest dev server connection: verify proper signing/event keys and that the Next.js API route is reachable.
- E2B authentication: set `E2B_API_KEY` in `.env`.

## License

MIT (or your preferred license).

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Start dev server (Next.js)
npm run build        # Production build
npm run start        # Run production build
npm run lint         # ESLint

npx prisma migrate dev    # Apply migrations & regenerate client
npx prisma generate       # Regenerate Prisma client only
npx prisma studio         # Open Prisma Studio GUI
npx prisma db push        # Push schema changes without migration history
```

## Architecture

**Flexora** is a no-code work management and CRM platform (Airtable/Monday.com style). Built with Next.js 16 App Router, React 19, TypeScript, Prisma v7, and PostgreSQL.

### Route tree

```
src/app/
├── page.tsx                                # Redirects: logged-in → /dashboard, else → /login
├── login/page.tsx
├── register/page.tsx
└── dashboard/
    ├── layout.tsx                          # Sidebar + Topbar shell
    ├── page.tsx                            # Workspace list
    └── [workspaceId]/
        ├── page.tsx                        # Apps list + activity feed
        └── [appId]/
            ├── page.tsx                    # Table view of Items
            └── [itemId]/page.tsx           # Item detail
```

Pages are **React Server Components** that fetch data directly. Mutations go through **Server Actions** in `src/lib/actions/`.

### Auth

Custom session-based auth — **no next-auth**. Sessions are stored in the `Session` table and sent as an HTTP-only cookie named `flexora_session` (30-day expiry).

Key helpers in `src/lib/auth.ts`:
- `getSession()` — reads cookie, looks up session in DB
- `getCurrentUser()` — returns user or null
- `requireUser()` — throws redirect if unauthenticated

Server actions in `src/lib/actions/auth.ts`: `login()`, `register()`, `logout()`.

Password hashing: bcryptjs, 12 rounds.

### Database

- **ORM:** Prisma v7 with `prisma.config.ts` (schema at `prisma/schema.prisma`)
- **Client output:** `src/generated/prisma` (non-default path — import from there, not `@prisma/client`)
- **Singleton:** `src/lib/db.ts` exports a single `db` instance

Key models: `User`, `Session`, `Workspace`, `WorkspaceMember`, `App`, `Item`, `Comment`, `Task`, `Automation`, `Notification`.

Several models store structured data as JSON strings in the DB:
- `App.fieldsJson` — array of `AppField` objects (field schema)
- `Item.dataJson` — custom field values keyed by field id
- `Automation.triggerJson` / `actionsJson` — trigger and action configs

Types for these are defined in `src/lib/types.ts` (`FieldType`, `AppField`, `AutomationTrigger`, `AutomationAction`).

### Workspace actions

All workspace/app/item CRUD is in `src/lib/actions/workspace.ts` as server actions. They verify workspace membership before making DB changes and call `revalidatePath` after mutations.

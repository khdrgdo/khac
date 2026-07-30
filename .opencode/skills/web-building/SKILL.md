---
name: web-building
description: Use when building new pages, features, or modifying existing site structure. Covers TanStack Router, Vite, Supabase, and project conventions.
---

# Web Building

## Stack
- **Framework**: Vite + React 19 + TypeScript
- **Router**: TanStack Router (file-based routing in `src/routes/`)
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Auth**: Supabase Auth (email + magic link)

## Project Structure
```
src/
  routes/           # File-based routes (TanStack Router)
  components/       # Shared UI components
  components/ui/    # shadcn/ui components
  components/admin/ # Admin-specific components
  hooks/            # Custom React hooks
  lib/              # Utilities, API functions
  integrations/     # Supabase client
  types/            # TypeScript types
supabase/
  migrations/       # Database migrations
```

## Routing Conventions
- Routes use TanStack Router file-based routing in `_authenticated/` directory
- Dynamic params: `$id` in filename → `{params.id}` in code
- Use `useNavigate` for programmatic navigation
- Use `Link` from `@tanstack/react-router` for links

## Database Access
- All DB queries through Supabase client (`@/integrations/supabase/client`)
- Mutations use `@tanstack/react-query` `useMutation` with `queryClient.invalidateQueries`
- Queries use `useQuery` with proper `queryKey` arrays
- RLS policies enforced server-side

## Component Patterns
- Use shadcn/ui primitives (Card, Button, Dialog, etc.)
- Use `lucide-react` for icons
- Use `sonner` toast (import { toast } from "sonner")
- Use `motion/react` (framer-motion wrapper) for animations
- RTL support: `dir-rtl` class, Arabic text

## Admin Panel
- Located at `/admin` route
- Has tabs: users, reports, messages, courses, settings
- Sub-admin permissions via `getSubAdminPermissions(profile)`
- Restricted actions via `useSubAdminRestrictions()`

## Notifications System
- Notifications in `notifications` table (Supabase)
- User display: `NotificationsPopover` component
- Admin sending: `BroadcastNotificationTab`
- Core logic: `notificationsStore.ts`
- Push notifications: `pushNotifications.ts`

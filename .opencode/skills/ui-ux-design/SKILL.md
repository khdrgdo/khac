---
name: ui-ux-design
description: Use when designing new UI components, modifying layouts, choosing color schemes, or improving user experience. Covers Tailwind CSS, RTL, responsive design, and animations.
---

# UI/UX Design

## Design System
- **Theme**: Dark mode default (`bg-background`, `text-foreground`)
- **Base color**: zinc slate palette (Tailwind neutral/zinc)
- **Primary**: indigo-600 (`#4f46e5`) for main actions
- **Accent**: amber/gold tones for highlights
- **UI Library**: shadcn/ui (Radix primitives + Tailwind)
- **Icons**: lucide-react (`import { Icon } from "lucide-react"`)

## RTL Arabic Design
- All text is Arabic (right-to-left)
- Use `dir="rtl"` on root, `text-right` for text alignment
- For margins/padding use logical properties:
  - `ml-` → `mr-` (margin left → right)
  - `pl-` → `pr-` (padding left → right)
  - Or better: `me-` (margin-inline-end), `ms-` (margin-inline-start)
- Use `start`/`end` utilities: `text-start`, `text-end`, `border-s`, `border-e`

## Responsive Design
- Mobile-first with Tailwind breakpoints: `sm:`, `md:`, `lg:`
- Cards grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Avoid fixed widths; use `max-w-*` with `w-full`
- Sidebar on desktop, bottom navigation on mobile

## Animations
- Use `motion` from `motion/react` for animations
- `AnimatePresence` for enter/exit animations
- Subtle micro-interactions: hover scale, fade in
- Loading states: `motion.div` with skeleton or spinner
- Badge pulse animation for notifications (see NotificationsPopover)

## Colors
- Background: `bg-background` (dark: zinc-950, light: white)
- Cards: `bg-card` (`bg-zinc-900/50` dark)
- Borders: `border-border` (`border-zinc-800`)
- Muted text: `text-muted-foreground` (`text-zinc-400`)
- Danger: `text-destructive` / `bg-destructive` (red)
- Success: emerald-500, Warning: amber-500

## Glassmorphism
- For overlays/popovers: `bg-background/80 backdrop-blur-xl`
- Cards on dark: `bg-card/50 border-border/50`
- Subtle dividers: `border-border/40` or `/60`

## Typography
- Font sizes: `text-xs` (11-12px), `text-sm` (13-14px), `text-base` (15-16px), `text-lg` (18px)
- Weights: `font-medium` (500), `font-semibold` (600), `font-bold` (700), `font-extrabold` (800)
- Line heights: `leading-relaxed` for body text, `leading-snug` for dense text

## Form Design
- Inputs: rounded-lg or rounded-xl, bg-muted/30, border-border
- Labels: text-sm font-medium, text-foreground
- Error states: border-destructive, text-destructive text-xs
- Buttons: rounded-xl, px-4 py-2, font-bold text-sm
- Dialog: rounded-2xl, backdrop-blur

## Mobile UX
- Touch targets at least 44px (use p-3 minimum for buttons)
- Smooth transitions on interactive elements (`transition duration-200`)
- Bottom sheets for actions on mobile
- ScrollView for long content, not fixed height

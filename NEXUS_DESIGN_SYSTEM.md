# NEXUS — Native Android Design System 1.0

## Product direction
NEXUS is an academic platform. The Android app is a native student client for the existing web product, not a WebView wrapper and not a second backend.

The visual identity is inherited from the current website:
- Geometric N lettermark and exact NEXUS wordmark.
- Deep ink/navy as the structural color.
- Warm ivory as the light canvas.
- Muted green as a secondary functional color.
- Restrained brass/gold for emphasis.
- Android system sans family for robust Arabic shaping.

## Design principles
1. Content first: course names, resources and announcements dominate decorative chrome.
2. Editorial hierarchy: one clear page title, concise supporting metadata, then content.
3. Cards are semantic containers, not a universal wrapper. Use compact rows for files, larger cards for courses and a distinct announcement treatment.
4. No decorative gradients, glassmorphism, glowing shadows, random blobs, emoji icons or repetitive statistic grids.
5. Use one icon family with restrained 18–24dp sizes.
6. Preserve natural Arabic RTL. Keep URLs and the NEXUS wordmark LTR where appropriate.
7. Respect system appearance by default; expose explicit light and dark overrides.
8. Animation must explain a state change or preserve spatial continuity.

## Light color tokens
- Ink: #24354B
- Deep ink: #182638
- Canvas: #F6F4EF
- Surface: #FFFEFB
- Gold: #C49A58
- Muted green: #66847F
- Muted text: #6C7480
- Border: #E4E0D8
- Danger: #B64242

## Dark color tokens
- Canvas: #151F2D
- Surface: #202D3E
- Primary: #D6B878
- Secondary: #9AB8B0
- Border: #354354

Gold is an accent, not a background for large text areas. Color never carries status alone.

## Typography
- Android Arabic-capable system sans family.
- Page title: 24–28sp, bold.
- Section title: 18sp, semibold.
- Body: 13–15sp with comfortable line height.
- Metadata: 11–12sp; never use low-contrast tiny text for important information.
- Keep English course names readable inside RTL layouts.

## Shape and spacing
- 4dp base spacing scale; common increments 8, 12, 16, 20, 24.
- Course cards: 16dp corners, 1dp outline, no heavy elevation.
- Resource rows: 13–14dp corners.
- Inputs and primary buttons: 12–14dp corners.
- Minimum touch target: 48dp.
- Do not apply the same radius and padding to every component.

## Component rules
- Course card: course identity, year/semester, teacher and resource counts.
- Resource row: file-type icon, title, optional instructor note, timestamp and open/download affordance.
- Announcement: author/time hierarchy with readable body copy.
- Discussion: author identity, question content, reply count and a focused reply composer.
- Empty state: explain what belongs here and why it may be empty.
- Error state: explain the failure and provide a retry path.

## Interaction and motion
- Use ripple and subtle haptic feedback for primary touch interactions.
- Use animateContentSize for expanding content and AnimatedContent for course-tab changes.
- Loading states preserve layout; no blank screens.
- Private course files open through short-lived signed URLs.
- Do not show success before the server confirms an operation.

## Accessibility
- 48dp minimum interactive target.
- Content descriptions for icon-only controls.
- Support Android font scaling and system light/dark preference.
- Maintain readable contrast; do not rely on color alone for pinned or error states.
- Keep long Arabic and English titles from clipping.

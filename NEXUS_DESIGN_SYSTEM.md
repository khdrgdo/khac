# NEXUS Design System — 1.3

## Product character
NEXUS is an Arabic-first academic social product. Its visual language should feel editorial, confident, human, and built by a mature product team—not like a generic AI dashboard or a collection of template cards.

## Brand mark
- The legacy emerald geometric K mark extracted from the user-provided Kryptonite APK is the inherited brand mark for the animated launch sequence.
- The splash uses a solid deep-ink background, the authentic mark, and one restrained orbit/reveal motion. No generic spinner as the brand moment and no artificial minimum display delay.
- In-product wordmark is NEXUS. Do not reintroduce the old Kryptonite text label unless the product owner explicitly requests it.

## Core color tokens
| Token | Light | Dark | Use |
|---|---|---|---|
| Ink | #172635 | #101820 | Primary text, navigation, structure |
| Paper | #F5F2EC | #101820 | App canvas |
| Surface | #FFFEFB | #1B2935 | Cards and sheets |
| Terracotta | #B85E42 | #F0A080 | Human accent, actions |
| Teal | #39736E | #9CC2B9 | Supporting accent, success |
| Cobalt | #365DD8 | #91A8FF | Focus and selected states |
| Muted | #66717B | #B8C0C7 | Secondary text |
| Border | #E1DDD4 | #35434F | Dividers and outlines |

Use semantic tokens in components. Do not scatter raw hex values across screens. Color is not a substitute for hierarchy.

## Typography
- Arabic-first layout and typography; preserve correct shaping, diacritics, line-height, and mixed Arabic/Latin direction.
- Use the platform sans family until a properly licensed Arabic font is packaged and verified across supported Android versions.
- Establish a compact type scale: display, page title, section title, body, metadata, and numeric emphasis.
- Points, dates, counts, and university identifiers must remain legible and consistently formatted.

## Layout and shape
- Use a 4dp spacing base and a small, deliberate spacing scale.
- Standard cards: 12–16dp radius. Large profile/rank hero cards may use 20–22dp when their content warrants it.
- Use elevation sparingly. Avoid glowing shadows, glassmorphism, decorative blobs, and excessive rounded capsules.
- Prefer structured lists, editorial grouping, and clear alignment over repeated identical card grids.

## Profile and rank themes
- Keep the five shared theme IDs and point thresholds consistent on web and Android: stars 0, clouds 100, moon 300, sun 700, galaxy 1500.
- A rank theme must change its art direction and content treatment, not only its accent color.
- Use real licensed photography as the background layer, with a restrained overlay only where required for text contrast. Add rank label, points, progress, avatar treatment, and clear unlock state.
- Do not use emoji as the primary badge, rank mark, or theme artwork.
- Persist the selected theme in the shared `profiles.card_theme_id` field. Do not silently fall back to localStorage as the source of truth.
- Cosmetic unlock rules are currently checked client-side; server-side enforcement must be separately reviewed before claiming tamper-proof unlocks.

## Motion
- Motion must communicate hierarchy, reveal, or state. Use short, restrained transitions and respect reduced-motion preferences.
- Do not animate large surfaces continuously without a product reason.
- No artificial splash delay; restore the session in parallel and leave the splash as soon as the app is ready.

## Accessibility and performance
- WCAG 2.2 AA contrast as the target for web text and controls.
- Android touch targets at least 48dp; meaningful semantics for icons and images.
- Every image needs an appropriate loading placeholder and error fallback. Bundle optimized assets where practical; remote photos must not block the rest of the profile screen.
- Use pagination, bounded queries, caching where safe, and per-screen loading states.
- Verify both light and dark modes and Arabic RTL on real device sizes.

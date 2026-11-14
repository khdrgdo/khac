<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# NEXUS engineering rules

## Product identity
- NEXUS is an Arabic-first academic social platform. Arabic RTL is the default; English strings must not break layout direction.
- The web app and Android app are one product. Keep their permissions, account identity, profile data, points, ranks, and feature behavior consistent.
- The uploaded legacy APK is a reference for existing product ideas and interaction patterns, not a source of truth for current backend behavior.
- Do not replace real product features with decorative placeholders, fake buttons, hard-coded counts, or local-only simulations.

## Design quality
- Do not produce generic AI-looking UI, template dashboards, purple-gradient hero panels, emoji decoration, or interchangeable card grids.
- Build a coherent design system: primitive and semantic tokens, typography, spacing, elevation, shape, iconography, motion, and reusable components with explicit states.
- Use meaningful visual hierarchy, editorial typography, restrained color, deliberate composition, and real licensed photography where photography is appropriate.
- Rank/profile themes must be genuinely distinct, reflect the user's earned level, and have a clear visual and functional reason to exist. A color swap alone is not a new theme.
- Motion must explain state or reinforce brand identity. Never animate just to make a screen look busy.
- Follow accessibility basics: readable contrast, scalable text, semantic labels, keyboard/focus support on web, and touch targets of at least 48dp on Android.

## Engineering workflow for AI agents
1. Explore the repository, related web implementation, data model, and tests before editing.
2. Write a short implementation plan for changes spanning multiple files.
3. Work in small, reviewable slices. Do not rewrite a large screen or repository without preserving its behavior and tests.
4. Implement the smallest coherent slice, then run the relevant tests and build.
5. Inspect the diff for invented behavior, security regressions, broken RTL, missing states, and dead controls.
6. Verify the actual UI on an Android emulator and in the web app. A successful compile is not proof of a successful feature.
7. Record evidence: commands, test results, build artifact, and emulator checks.

## Android architecture and performance
- Keep composables focused. Move reusable UI out of the monolithic NexusApp.kt as it is refactored.
- Keep network and business logic out of composables; expose observable UI state from ViewModels and repositories.
- Model loading, refreshing, empty, error, and success states per feature instead of relying on one global spinner.
- Avoid serial network waterfalls when requests are independent. Add pagination for growing feeds, bounded queries, caching where safe, and cancellation of stale requests.
- Measure before optimizing. Use Compose tracing/benchmarks, Macrobenchmark, Baseline Profiles, and release builds with R8 where configured.
- Use stable keys and content types for lazy lists; avoid unnecessary recomposition and expensive work during composition.

## Data, security, and permissions
- Server-side authorization is authoritative. Never rely on client-side role checks to protect admin, moderator, or private user data.
- Never expose secrets, service-role keys, or privileged credentials in client code.
- Do not change Supabase schema, migrations, RLS policies, production data, or roles without the user's explicit approval.
- Request Android runtime permissions only when the user invokes the feature that needs them, with a clear explanation.

## Definition of done
- The feature works against the real backend and respects the existing data contract.
- Loading, empty, error, success, offline/retry, and permission-denied states are handled where relevant.
- Unit tests cover business rules; UI/navigation tests cover critical journeys; web checks and Android build pass.
- The changed screens are visually reviewed at phone dimensions and RTL.
- The APK is installed and exercised on an emulator. Report whether it is debug or release, and never call a debug artifact a store-ready release.

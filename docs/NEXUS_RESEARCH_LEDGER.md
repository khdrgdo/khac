# NEXUS research ledger — initial verified references

This is an initial curated source set, not a claim that 1,000 independent sources have already been read. Inflating a source count would be misleading. A major NN/g mobile-usability report alone contains 374 research-backed guidelines and more than 1,000 screenshot examples; those are examples, not 1,000 separate sources.

## Design systems and interface craft
1. Figma — Components, styles, and shared library best practices: https://www.figma.com/best-practices/components-styles-and-shared-libraries/
2. Figma Learn — Components collection overview: https://help.figma.com/hc/en-us/articles/39719619313047-Components-collection-Overview
3. Figma — Creating and organizing variants: https://www.figma.com/best-practices/creating-and-organizing-variants/
4. Figma Learn — Introduction to design systems: https://help.figma.com/hc/en-us/articles/14552901442839-Overview-Introduction-to-design-systems
5. Figma video — Build your design system (styles, components, libraries, spacing, typography, elevation, navigation): https://www.youtube.com/watch?v=0XSLMGh8yhM
6. Adobe Spectrum — Design tokens and semantic token tiers: https://spectrum.adobe.com/page/design-tokens/
7. W3C — WCAG 2.2: https://www.w3.org/TR/WCAG22/

## Mobile UX research
8. Nielsen Norman Group — User Experience for Mobile Applications and Websites, 5th edition: https://www.nngroup.com/reports/mobile-website-and-application-usability/
   - 713-page research report; 374 design guidelines; more than 1,000 screenshot examples.
   - Relevant topics: navigation, forms, login/registration, progress indicators, permissions, skeleton screens, long content, search/filter, lists, onboarding, infinite lists.
9. Nielsen Norman Group — Mobile UX study guide: https://www.nngroup.com/articles/mobile-ux-study-guide/

## Android architecture and performance
10. Android Developers — Jetpack Compose performance: https://developer.android.com/develop/ui/compose/performance
11. Android Developers — Compose performance codelab: https://developer.android.com/codelabs/jetpack-compose-performance
12. Android Developers — Baseline Profiles: https://developer.android.com/develop/ui/compose/performance/baseline-profiles
13. Android Developers — App optimization best practices: https://developer.android.com/topic/performance/appstartup/best-practices
14. Android Developers — Architecture recommendations: https://developer.android.com/topic/architecture/recommendations
15. Android Developers — Compose best practices: https://developer.android.com/develop/ui/compose/performance/bestpractices

## Professional AI-assisted engineering
16. OpenAI — Codex best practices: https://learn.chatgpt.com/guides/best-practices
17. OpenAI — Iterating development workflows with Codex: https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex
18. Anthropic — Claude Code best practices for agentic coding: https://www.anthropic.com/engineering/claude-code-best-practices
19. VS Code — Best practices for using AI agents: https://code.visualstudio.com/docs/agents/best-practices

## Rules derived from the sources
- Reuse semantic tokens and shared components; do not duplicate styling decisions across screens.
- Build components with explicit variants and states; preserve content and accessibility when variants change.
- Design navigation, loading, forms, permissions, and long content from mobile research rather than intuition.
- Measure Compose performance before optimizing. Use Baseline Profiles, stable lazy-list keys, and Macrobenchmark where appropriate.
- Give coding agents repository context, durable instructions, bounded tasks, acceptance criteria, and tests.
- Require diff review and real-device/emulator verification. A green compile alone is not completion.

## Research expansion policy
For every feature being changed, add feature-specific primary documentation, research, implementation examples, and a testable acceptance checklist. Prefer official documentation, peer-reviewed or established UX research, and maintainers' implementation guides. Do not count duplicate search results, copied articles, screenshots, or AI-generated summaries as independent sources.


## Profile-theme photographic assets
- Night mountain: https://unsplash.com/photos/le-ciel-nocturne-avec-des-etoiles-et-une-montagne-au-premier-plan-kSsBfk3O3Fo
- Clouded sunset: https://unsplash.com/photos/dramatic-clouds-fill-the-sky-at-dusk-ANWy03Jt02Q
- Full moon over ridge: https://unsplash.com/photos/full-moon-over-the-silhouette-of-mountain-Kg0M8jdqIyQ
- Golden desert dunes: https://unsplash.com/photos/golden-sunlight-bathes-the-vast-desert-sand-dunes-BhtjXDK_4V8
- Milky Way mountain: https://unsplash.com/photos/a-mountain-with-a-starry-sky-above-it-Oztfs3ky4Xk

These photographs load asynchronously and are layered with rank-specific overlays, typography, points/progress, and restrained motion. Before release, bundle optimized local WebP/AVIF variants or verify cache behavior so photo loading does not regress perceived performance.


## Gamification, points, ranks, and leaderboards
20. Li, Liang, Fryer & Shum (2024) — The use of leaderboards in education: a systematic review of empirical evidence in higher education. Journal of Computer Assisted Learning. https://doi.org/10.1111/jcal.13077
   - Synthesises 20 articles, 22 studies, and 29 interventions.
   - Effectiveness depends on leaderboard design; transparent rules and goal-related feedback matter. Lower-ranked learners may benefit from anonymity in absolute leaderboards.
21. Lee et al. (2021) — Leaderboard Design Principles to Enhance Learning and Motivation in a Gamified Educational Environment. JMIR Serious Games. https://doi.org/10.2196/14746
   - Recommends using macro and micro leaderboards together and including meaningful learning achievements in micro leaderboards.
22. Systematic review and meta-analysis (2025) — Gamification on Mathematics Engagement and Motivation in Secondary School and Higher Education. https://doi.org/10.1007/s10648-025-10108-1
   - Points, badges, and leaderboards are not effective when added superficially; align them with mastery, competence, and students' psychological needs.
23. Negative effects of gamification in education software (2022) — Systematic mapping and practitioner perceptions. https://doi.org/10.1016/j.infsof.2022.107066
   - Maps 87 papers reporting undesirable effects; points, badges, competition, and leaderboards can cause motivational, performance, relevance, and fairness problems when poorly designed.
24. Reward strategies in gamified learning (2026) — Effects of reward strategies in gamified learning on academic performance: a systematic review. https://doi.org/10.1016/j.edurev.2026.100766
   - Synthesises 16 studies and 18 interventions; low-stakes rewards and learner autonomy in reward choice are promising.
25. Triantafyllou, Sapounidis & Georgiadis (2025) — Gamification in education and training: A literature review. https://doi.org/10.1007/s11159-024-10111-8
   - Emphasises meaningful instructional alignment, feedback, collaboration, and matching gamification to learner needs.

## NEXUS gamification rules derived from the evidence
- Keep the chosen hybrid model: macro ranking (institution/global) plus micro ranking (major, cohort, course, section, and time period).
- Pair competitive rankings with personal progress, next-rank feedback, and attainable local comparisons. Do not make the global top-N list the only success signal.
- Publish the points rules. Award points for meaningful learning and contribution, not raw posting volume or spam.
- Use server-authoritative, idempotent award logic with anti-abuse limits. A client must never mint points.
- Provide privacy options and consider anonymising low-ranked positions in public absolute leaderboards.
- Keep rewards low-stakes and allow choice among unlocked profile themes; a student may keep a preferred earlier theme while their earned rank continues to reflect actual points.
- Measure participation, retention, and learning-related outcomes; do not assume a larger point total means better learning.


## Practitioner video references reviewed
26. UI Collective (2026-09-09) — Learn Design Systems: Figma Variables, Components, AI, and More: https://www.youtube.com/watch?v=lsgVRCJ4fko
   - Relevant chapters: design tokens (1:00), variables vs tokens (2:41), semantic roles (25:58–40:11), text and icon tokens (46:54–51:25), dark mode (50:15), type scale (59:39), AI support (1:02:27), mobile design systems (3:26:00), component boundaries (3:36:15), developer handoff (3:50:26).
27. Android Developers (Google I/O 2022) — Performance best practices for Jetpack Compose: https://www.youtube.com/watch?v=EOQB8PTLkpY
   - Covers common Compose performance mistakes, profiling, phases, and Baseline Profiles; paired with the current Android performance documentation and codelab.
28. Claude (2026-05-17) — The Explore → Plan → Code → Commit workflow in Claude Code: https://www.youtube.com/watch?v=xJQuF02NAK8
   - Emphasises researching the codebase before editing, defining success criteria, and using independent reviewers before pushing.
29. freeCodeCamp (2026-03-23) — Claude Code Essentials: https://www.youtube.com/watch?v=brLhhkUqcn4
   - Useful chapters: permission rules (3:23:14), GitHub Actions and remote control (7:59:11), security review (8:42:36), code review (9:07:42), persistent context and rules (9:15:12), agent skills (9:56:27), MCP and sub-agents (10:27:06–11:32:50).

These are practitioner demonstrations, not substitutes for primary technical documentation or controlled testing. The NEXUS implementation will use the applicable practices and verify them in CI and on an emulator.


30. Almeida, Kalinowski, Uchôa & Feijó (2025 conference proceedings / 2026 publication record) — Exploring the Negative Effects of Gamification on Students: A PRISMA-Based Systematic Literature Review. https://doi.org/10.1109/ICCA66035.2025.11431021
   - Identified 206 studies and selected 20; reports performance pressure, superficial learning, motivational decline, and emotional strain as risks when gamification weakens autonomy, competence, or relatedness.
31. Dichev & Dicheva (2017) — Gamifying education: what is known, what is believed and what remains uncertain: a critical review. https://doi.org/10.1186/s41239-017-0042-5
   - Critical review that cautions against treating gamification as universally effective and stresses the need for evidence-based instructional design.

## Important qualification for NEXUS rankings
- The leaderboard systematic review's evidence base consisted entirely of higher-education studies, with many short interventions. Its recommendations are useful but not proof of long-term effects in NEXUS; measure outcomes after launch.
- Keep academic performance rankings distinct from community-engagement rankings. Do not blend grades, post volume, comments, and peer-help into one opaque score.
- If NEXUS uses a combined score, publish the formula, show its components, and validate that it rewards useful learning behavior rather than popularity or spam.


## Authentication and mobile deep-link references
32. Supabase — Native Mobile Deep Linking: https://supabase.com/docs/guides/auth/native-mobile-deep-linking
33. Supabase — Password-based Auth: https://supabase.com/docs/guides/auth/passwords
34. Supabase — Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
35. Supabase — Email Templates: https://supabase.com/docs/guides/auth/auth-email-templates
36. Supabase JavaScript reference — auth.signUp: https://supabase.com/docs/reference/javascript/auth-signup

## NEXUS authentication acceptance checks
- The same user identity must work on web and Android.
- Android password login accepts the supported university-number/email identifier mapping.
- Google OAuth and manual login/signup must both preserve the mobile redirect when launched from Android.
- Email confirmation and password-reset links must return to the web callback page and then open the Android app when a mobile redirect was requested.
- Verify the Android custom scheme `com.nexus.app://login-callback` is present in the Supabase Auth redirect allowlist.
- Verify hosted Supabase email templates use the supplied `RedirectTo` value; code-level redirect parameters alone do not prove the dashboard configuration is correct.
- Do not call Google OAuth or email-confirmation flows fully verified until an actual end-to-end round trip is tested with the provider and SMTP configuration.

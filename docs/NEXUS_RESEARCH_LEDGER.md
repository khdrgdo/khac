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
25. Gamification in education and training (2024) — Literature review. https://doi.org/10.1007/s11159-024-10111-8
   - Emphasises meaningful instructional alignment, feedback, collaboration, and matching gamification to learner needs.

## NEXUS gamification rules derived from the evidence
- Keep the chosen hybrid model: macro ranking (institution/global) plus micro ranking (major, cohort, course, section, and time period).
- Pair competitive rankings with personal progress, next-rank feedback, and attainable local comparisons. Do not make the global top-N list the only success signal.
- Publish the points rules. Award points for meaningful learning and contribution, not raw posting volume or spam.
- Use server-authoritative, idempotent award logic with anti-abuse limits. A client must never mint points.
- Provide privacy options and consider anonymising low-ranked positions in public absolute leaderboards.
- Keep rewards low-stakes and allow choice among unlocked profile themes; a student may keep a preferred earlier theme while their earned rank continues to reflect actual points.
- Measure participation, retention, and learning-related outcomes; do not assume a larger point total means better learning.

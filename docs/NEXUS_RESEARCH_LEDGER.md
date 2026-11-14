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

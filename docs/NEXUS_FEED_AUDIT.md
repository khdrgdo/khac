# NEXUS Feed Audit — 14 Nov 2026

## Current web implementation
- `PostCard` already supports author identity, anonymous author state, timestamps, post type, accepted-answer status, media, expandable content, reaction summaries, comments navigation, share, save, report, and delete where permitted.
- `PostList` loads up to 50 posts and hydrates public profiles, post reactions, comment counts, and saved-post state.
- `CreatePost` supports general posts/questions, anonymous publishing, media upload, and the TipTap editor.
- `RichTextEditor` uses the `search_public_profiles` RPC for `@mentions`.
- The feed previously had no first-class hashtag filter.

## Changes now made in this redesign branch
- `#hashtags` are extracted from post text and rendered as clickable chips.
- Clicking a hashtag opens the feed filtered by that tag; the query is sanitized before applying `ilike`.
- The composer explains the difference between `#hashtags` and `@mentions`.
- Mention suggestions now show a real avatar and masked university number, have a selected-row state, and support keyboard selection with Enter/Tab.
- Long-post collapse uses a shorter, card-surface-matched fade.
- Comment threads no longer render every comment as a separate floating card. They now use a continuous list with separators, message surfaces, and a right-side reply connector for nested replies.
- The previous comment-reaction strip was backed only by localStorage. It was removed rather than presenting device-local reactions as durable shared interactions. A real database-backed comment-reaction feature still requires a migration and policy review.

## Android parity gap
The current Android `SocialScreens.kt` is materially behind the web implementation:
- It loads only basic post text, author name/avatar, anonymous state, time, and comment count.
- It has no image display/upload, reactions, saved posts, report/delete menu, question/accepted-answer state, tag filtering, or mention suggestions.
- It offers a basic composer and inline comment input, not the full web post lifecycle.
- The current feed loader makes sequential requests and has no pagination.

## Required Android feed work
1. Extend `FeedPost` with images, post type, accepted answer, author major/points/verification, reaction counts, current-user reaction, and saved state.
2. Hydrate profiles, reactions, comment counts, and saved posts with bounded queries; parallelize independent requests.
3. Add per-post optimistic reaction/save state with rollback on failure.
4. Add question/general post type and anonymous toggle to the composer.
5. Add multi-image selection, upload to the existing post-images storage bucket, and lazy signed-URL resolution.
6. Add collapsed/expanded content, hashtag chips, report/delete actions, and share links.
7. Add a dedicated post detail route with nested comments and clear separators.
8. Add pagination and per-screen loading/skeleton states; preserve cached feed content during refresh.
9. Add end-to-end tests for reaction, save, report, delete, comment, question acceptance, and image upload.

## Acceptance criteria
- No control is decorative: each visible action must perform a real operation or be hidden.
- The same post, reaction, saved state, and comment count must agree between web and Android.
- No client-only reaction or points state may be represented as shared server state.
- Arabic text, mixed Arabic/Latin text, hashtags, and mentions must render correctly in RTL.
- Long posts must expand without navigating away from the feed.
- Feed refresh must not blank the entire screen when cached posts are available.

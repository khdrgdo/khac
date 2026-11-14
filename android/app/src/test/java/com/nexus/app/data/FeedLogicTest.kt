package com.nexus.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FeedLogicTest {
    private fun post(reactions: List<FeedReaction> = emptyList(), mine: String? = null) = FeedPost(
        id = "p1", authorId = "a", authorName = "A", avatarUrl = null, anonymous = false, content = "x",
        postType = "general", createdAt = "2026-01-01T00:00:00Z", commentsCount = 0, images = emptyList(),
        acceptedAnswerId = null, authorMajor = null, authorPoints = 0, authorVerified = false,
        reactions = reactions, myReaction = mine, saved = false
    )

    private fun comment(id: String, parent: String?, at: String) = NxComment(
        id, "p1", parent, "u$id", "U$id", null, false, false, "c$id", at
    )

    @Test fun applyReactionReplacesMineAndClears() {
        val start = post(listOf(FeedReaction("me", "like"), FeedReaction("x", "love")), "like")
        val changed = FeedLogic.applyReaction(start, "me", "haha")
        assertEquals(2, changed.reactions.size)
        assertEquals("haha", changed.myReaction)
        val cleared = FeedLogic.applyReaction(changed, "me", null)
        assertEquals(1, cleared.reactions.size)
        assertNull(cleared.myReaction)
    }

    @Test fun topReactionsOrderedByCount() {
        val p = post(listOf(FeedReaction("1", "love"), FeedReaction("2", "love"), FeedReaction("3", "like")))
        assertEquals(listOf("love", "like"), FeedLogic.topReactions(p).map { it.key })
    }

    @Test fun commentTreeFlattensDeepReplies() {
        val tree = FeedLogic.buildCommentTree(listOf(
            comment("1", null, "2026-01-01T00:00:01Z"),
            comment("2", "1", "2026-01-01T00:00:02Z"),
            comment("3", "2", "2026-01-01T00:00:03Z"),
            comment("4", null, "2026-01-01T00:00:04Z"),
            comment("5", "missing", "2026-01-01T00:00:05Z")
        ))
        assertEquals(listOf("1", "4", "5"), tree.map { it.comment.id })
        assertEquals(listOf("2", "3"), tree.first().replies.map { it.id })
    }

    @Test fun encodeMentionsIsSinglePassAndPrefersLongestLabel() {
        val out = FeedLogic.encodeMentions("hi @Ali Hassan and @Ali", mapOf("Ali Hassan" to "1", "Ali" to "2"))
        assertTrue(out.contains("data-id=\"1\""))
        assertTrue(out.contains("data-id=\"2\""))
        assertEquals(2, Regex("data-type=\"mention\"").findAll(out).count())
    }

    @Test fun richTextParsesMentionTagBoldAndLink() {
        val spans = FeedLogic.parseRichText(
            "**مهم** مرحبا <span data-type=\"mention\" data-id=\"u9\" class=\"mention\">@سارة</span> #رياضيات https://a.io/x"
        )
        assertTrue(spans.any { it is RichSpan.Plain && it.bold && it.text == "مهم" })
        assertTrue(spans.any { it is RichSpan.Mention && it.userId == "u9" })
        assertTrue(spans.any { it is RichSpan.Hashtag && it.tag == "رياضيات" })
        assertTrue(spans.any { it is RichSpan.Link && it.url == "https://a.io/x" })
    }

    @Test fun headingBecomesBoldAndPlainTextStripsMarkup() {
        val plain = FeedLogic.plainText("# عنوان\n- نقطة\nنص **غامق**")
        assertEquals("عنوان\n\u2022 نقطة\nنص غامق", plain)
    }

    @Test fun extractTagsDeduplicates() {
        assertEquals(listOf("a1", "b2"), FeedLogic.extractTags("#a1 text #b2 #a1"))
    }
}

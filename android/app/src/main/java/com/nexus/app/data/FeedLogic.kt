package com.nexus.app.data

data class ReactionDef(val key: String, val emoji: String, val label: String)

data class NxComment(
    val id: String,
    val postId: String,
    val parentId: String?,
    val authorId: String?,
    val authorName: String,
    val avatarUrl: String?,
    val verified: Boolean,
    val anonymous: Boolean,
    val content: String,
    val createdAt: String
)

data class NxCommentNode(val comment: NxComment, val replies: List<NxComment>)

sealed interface RichSpan {
    data class Plain(val text: String, val bold: Boolean = false, val italic: Boolean = false) : RichSpan
    data class Code(val text: String) : RichSpan
    data class Mention(val userId: String?, val label: String) : RichSpan
    data class Hashtag(val tag: String) : RichSpan
    data class Link(val label: String, val url: String) : RichSpan
}

object FeedLogic {
    val reactions = listOf(
        ReactionDef("like", "\uD83D\uDC4D", "إعجاب"),
        ReactionDef("love", "\u2764\uFE0F", "أحببته"),
        ReactionDef("haha", "\uD83D\uDE02", "مضحك"),
        ReactionDef("wow", "\uD83D\uDE2E", "مذهل"),
        ReactionDef("sad", "\uD83D\uDE22", "حزين")
    )

    fun reactionOf(key: String?): ReactionDef? = reactions.firstOrNull { it.key == key }

    fun applyReaction(post: FeedPost, userId: String, reaction: String?): FeedPost {
        val others = post.reactions.filterNot { it.userId == userId }
        val updated = if (reaction == null) others else others + FeedReaction(userId, reaction)
        return post.copy(reactions = updated, myReaction = reaction)
    }

    fun topReactions(post: FeedPost, limit: Int = 3): List<ReactionDef> {
        val counts = post.reactions.groupingBy { it.reaction }.eachCount()
        return reactions.filter { counts.containsKey(it.key) }
            .sortedByDescending { counts[it.key] ?: 0 }
            .take(limit)
    }

    private fun isReply(comment: NxComment, byId: Map<String, NxComment>): Boolean {
        val parent = comment.parentId ?: return false
        return byId.containsKey(parent)
    }

    private fun rootId(comment: NxComment, byId: Map<String, NxComment>): String {
        var current = comment
        var guard = 0
        while (guard < 32) {
            val parent = current.parentId?.let { byId[it] } ?: break
            current = parent
            guard++
        }
        return current.id
    }

    /** Two levels, like most social apps: deeper replies are flattened under their root comment. */
    fun buildCommentTree(comments: List<NxComment>): List<NxCommentNode> {
        if (comments.isEmpty()) return emptyList()
        val byId = comments.associateBy { it.id }
        val sorted = comments.sortedBy { it.createdAt }
        val roots = sorted.filterNot { isReply(it, byId) }
        val replies = sorted.filter { isReply(it, byId) }.groupBy { rootId(it, byId) }
        return roots.map { NxCommentNode(it, replies[it.id].orEmpty()) }
    }

    fun mentionHtml(userId: String, name: String): String =
        "<span data-type=\"mention\" data-id=\"$userId\" data-label=\"$name\" class=\"mention\">@$name</span>"

    /** Turns "@Name" typed in a plain text field into the span markup the web editor understands. */
    fun encodeMentions(text: String, mentions: Map<String, String>): String {
        val labels = mentions.keys.filter { it.isNotBlank() }.sortedByDescending { it.length }
        if (labels.isEmpty()) return text
        val regex = Regex(labels.joinToString("|") { "@" + Regex.escape(it) })
        return regex.replace(text) { match ->
            val label = match.value.removePrefix("@")
            val id = mentions[label]
            if (id == null) match.value else mentionHtml(id, label)
        }
    }

    private val tagRegex = Regex("""(?:^|\s)#([\p{L}\p{N}_-]{2,40})""")

    fun extractTags(content: String): List<String> =
        tagRegex.findAll(content).map { it.groupValues[1] }.distinct().take(8).toList()

    private val richRegex = Regex(
        """<span\b[^>]*data-type="mention"[^>]*>([^<]*)</span>|\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)]\((https?://[^)\s]+)\)|(https?://[^\s<]+)|(?<![\p{L}\p{N}_])#([\p{L}\p{N}_-]{2,40})|(?<![*\w])\*([^*\n]+)\*"""
    )
    private val idRegex = Regex("""data-id="([^"]*)"""")
    private val headingRegex = Regex("""^\s{0,3}#{1,6}\s+(.*)$""")
    private val bulletRegex = Regex("""^\s*[-*+]\s+(.*)$""")

    private fun normalizeLine(line: String): String {
        val heading = headingRegex.find(line)
        if (heading != null) return "**" + heading.groupValues[1].trim() + "**"
        val bullet = bulletRegex.find(line)
        if (bullet != null) return "\u2022 " + bullet.groupValues[1]
        return line
    }

    fun parseRichText(content: String): List<RichSpan> {
        val text = content.lines().joinToString("\n") { normalizeLine(it) }
        val out = mutableListOf<RichSpan>()
        var cursor = 0
        for (match in richRegex.findAll(text)) {
            if (match.range.first > cursor) out += RichSpan.Plain(text.substring(cursor, match.range.first))
            val g = match.groupValues
            when {
                match.value.startsWith("<span") -> {
                    val id = idRegex.find(match.value)?.groupValues?.get(1)?.takeIf { it.isNotBlank() }
                    out += RichSpan.Mention(id, g[1].ifBlank { "@" })
                }
                g[2].isNotEmpty() -> out += RichSpan.Plain(g[2], bold = true)
                g[3].isNotEmpty() -> out += RichSpan.Code(g[3])
                g[4].isNotEmpty() -> out += RichSpan.Link(g[4], g[5])
                g[6].isNotEmpty() -> out += RichSpan.Link(g[6], g[6])
                g[7].isNotEmpty() -> out += RichSpan.Hashtag(g[7])
                g[8].isNotEmpty() -> out += RichSpan.Plain(g[8], italic = true)
            }
            cursor = match.range.last + 1
        }
        if (cursor < text.length) out += RichSpan.Plain(text.substring(cursor))
        return out
    }

    /** Plain text for notifications, search snippets and previews. */
    fun plainText(content: String): String = parseRichText(content).joinToString("") {
        when (it) {
            is RichSpan.Plain -> it.text
            is RichSpan.Code -> it.text
            is RichSpan.Mention -> it.label
            is RichSpan.Hashtag -> "#" + it.tag
            is RichSpan.Link -> it.label
        }
    }
}

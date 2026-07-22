import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RankBadge } from "@/components/RankBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { majorLabel } from "@/lib/college";
import { formatUnivNumber } from "@/lib/privacy";
import {
  Search,
  X,
  FileText,
  MessageSquare,
  User as UserIcon,
  MessageCircle,
  ExternalLink,
  Loader2,
  Sparkles,
  HelpCircle,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

type SearchTab = "all" | "posts" | "comments" | "people";

interface PostResult {
  id: string;
  content: string;
  created_at: string;
  post_type: string;
  author_id: string;
  images?: string[] | null;
  author?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    verified?: boolean;
    university_number?: string;
  };
  reactionCount: number;
  commentCount: number;
}

interface CommentResult {
  id: string;
  content: string;
  created_at: string;
  post_id: string;
  author_id: string;
  author?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    verified?: boolean;
    university_number?: string;
  };
  postSnippet?: string;
}

interface PersonResult {
  id: string;
  full_name: string;
  university_number: string;
  avatar_url: string | null;
  major?: "it" | "is" | "se" | null;
  year?: number | null;
  points?: number | null;
  verified?: boolean;
}

export function GlobalSearchDialog() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("all");

  const cleanQuery = query.trim();
  const hasQuery = cleanQuery.length >= 1;

  // Keyboard shortcut (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 1. Query for matching Posts
  const { data: matchedPosts = [], isLoading: loadingPosts } = useQuery({
    queryKey: ["search-posts", cleanQuery],
    enabled: hasQuery && open,
    queryFn: async (): Promise<PostResult[]> => {
      const { data: rows, error } = await supabase
        .from("posts")
        .select("id, content, images, author_id, created_at, post_type")
        .ilike("content", `%${cleanQuery}%`)
        .order("created_at", { ascending: false })
        .limit(15);

      if (error) throw error;
      const list = rows ?? [];
      if (list.length === 0) return [];

      const ids = list.map((r) => r.id);
      const authorIds = Array.from(new Set(list.map((r) => r.author_id)));

      const [{ data: authors }, { data: reactions }, { data: comments }] = await Promise.all([
        supabase.rpc("get_public_profiles", { _ids: authorIds }),
        supabase.from("post_reactions").select("post_id").in("post_id", ids),
        supabase.from("comments").select("post_id").in("post_id", ids),
      ]);

      const authorMap = new Map(
        (authors ?? []).map((a: { id: string } & Record<string, unknown>) => [a.id, a]),
      );

      return list.map((r) => {
        const reactionCount = (reactions ?? []).filter(
          (x: { post_id: string }) => x.post_id === r.id,
        ).length;
        const commentCount = (comments ?? []).filter(
          (x: { post_id: string }) => x.post_id === r.id,
        ).length;

        const author = authorMap.get(r.author_id);

        return {
          ...r,
          author: author
            ? {
                id: author.id as string,
                full_name: author.full_name as string,
                avatar_url: (author.avatar_url as string) || null,
                verified: (author.verified as boolean) || false,
                university_number: (author.university_number as string) || "",
              }
            : undefined,
          reactionCount,
          commentCount,
        };
      });
    },
  });

  // 2. Query for matching Comments
  const { data: matchedComments = [], isLoading: loadingComments } = useQuery({
    queryKey: ["search-comments", cleanQuery],
    enabled: hasQuery && open,
    queryFn: async (): Promise<CommentResult[]> => {
      const { data: rows, error } = await supabase
        .from("comments")
        .select("id, content, created_at, post_id, author_id")
        .ilike("content", `%${cleanQuery}%`)
        .order("created_at", { ascending: false })
        .limit(15);

      if (error) throw error;
      const list = rows ?? [];
      if (list.length === 0) return [];

      const authorIds = Array.from(new Set(list.map((c) => c.author_id)));
      const postIds = Array.from(new Set(list.map((c) => c.post_id)));

      const [{ data: authors }, { data: posts }] = await Promise.all([
        supabase.rpc("get_public_profiles", { _ids: authorIds }),
        supabase.from("posts").select("id, content").in("id", postIds),
      ]);

      const authorMap = new Map(
        (authors ?? []).map((a: { id: string } & Record<string, unknown>) => [a.id, a]),
      );
      const postMap = new Map((posts ?? []).map((p: { id: string; content: string }) => [p.id, p]));

      return list.map((c) => {
        const author = authorMap.get(c.author_id);
        const parentPost = postMap.get(c.post_id);
        return {
          ...c,
          author: author
            ? {
                id: author.id as string,
                full_name: author.full_name as string,
                avatar_url: (author.avatar_url as string) || null,
                verified: (author.verified as boolean) || false,
                university_number: (author.university_number as string) || "",
              }
            : undefined,
          postSnippet: parentPost ? parentPost.content.slice(0, 80) : undefined,
        };
      });
    },
  });

  // 3. Query for matching People
  const { data: matchedPeople = [], isLoading: loadingPeople } = useQuery({
    queryKey: ["search-people", cleanQuery],
    enabled: hasQuery && open,
    queryFn: async (): Promise<PersonResult[]> => {
      const { data: rpcProfiles, error } = await supabase.rpc("search_public_profiles", {
        _q: cleanQuery,
      });
      if (error) throw error;
      const list = rpcProfiles ?? [];
      if (list.length === 0) return [];

      const ids = list.map((p: { id: string }) => p.id);
      const { data: fullProfiles } = await supabase.rpc("get_public_profiles", { _ids: ids });

      const fullMap = new Map(
        (fullProfiles ?? []).map((fp: { id: string } & Record<string, unknown>) => [fp.id, fp]),
      );

      return list.map((p: PersonResult) => {
        const full = fullMap.get(p.id);
        return {
          id: p.id,
          full_name: p.full_name,
          university_number: p.university_number,
          avatar_url: p.avatar_url,
          major: (full?.major as PersonResult["major"]) ?? null,
          year: (full?.year as number) ?? null,
          points: (full?.points as number) ?? 0,
          verified: (full?.verified as boolean) ?? false,
        };
      });
    },
  });

  // Start DM mutation
  const startDmMut = useMutation({
    mutationFn: async (otherId: string) => {
      if (!user) throw new Error("يرجى تسجيل الدخول أولاً");
      const { data, error } = await supabase.rpc("create_dm", { _other: otherId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (convId) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setOpen(false);
      if (convId) navigate({ to: "/messages/$id", params: { id: convId } });
    },
    onError: (err: Error) => toast.error(err.message || "تعذر بدء المحادثة"),
  });

  const isLoading = loadingPosts || loadingComments || loadingPeople;
  const totalResults = matchedPosts.length + matchedComments.length + matchedPeople.length;

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-xs px-3 py-1.5 rounded-xl border border-border/60 transition focus:outline-none focus:ring-2 focus:ring-primary/30"
          title="البحث الشامل (Ctrl+K)"
        >
          <Search className="w-4 h-4 text-primary shrink-0" />
          <span className="hidden sm:inline text-start truncate w-24 md:w-36 lg:w-48">
            بحث عن منشور، شخص...
          </span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] bg-background text-muted-foreground border px-1.5 py-0.5 rounded font-mono shadow-xs">
            Ctrl+K
          </kbd>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Search className="w-5 h-5 text-primary" /> البحث الشامل
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-3 flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Search Input */}
          <div className="relative shrink-0">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="اكتب اسم شخص، كلمة في منشور، أو تعليق..."
              className="ps-9 pe-9 h-11 text-sm rounded-xl border-primary/30 focus-visible:ring-primary/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition"
                title="مسح"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Tabs / Quick Suggestions */}
          {hasQuery ? (
            <div className="flex items-center justify-between gap-2 border-b pb-2 shrink-0 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant={activeTab === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab("all")}
                  className="h-7 text-xs rounded-lg px-2.5 gap-1"
                >
                  الكل
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                    {totalResults}
                  </Badge>
                </Button>

                <Button
                  variant={activeTab === "posts" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab("posts")}
                  className="h-7 text-xs rounded-lg px-2.5 gap-1"
                >
                  <FileText className="w-3 h-3" />
                  المنشورات
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                    {matchedPosts.length}
                  </Badge>
                </Button>

                <Button
                  variant={activeTab === "comments" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab("comments")}
                  className="h-7 text-xs rounded-lg px-2.5 gap-1"
                >
                  <MessageSquare className="w-3 h-3" />
                  التعليقات
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                    {matchedComments.length}
                  </Badge>
                </Button>

                <Button
                  variant={activeTab === "people" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab("people")}
                  className="h-7 text-xs rounded-lg px-2.5 gap-1"
                >
                  <UserIcon className="w-3 h-3" />
                  الأشخاص
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                    {matchedPeople.length}
                  </Badge>
                </Button>
              </div>

              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1 flex-wrap shrink-0">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                <Sparkles className="w-3.5 h-3.5" /> عمليات بحث سريعة:
              </span>
              {["امتحانات", "برمجة", "هندسة", "مشروع"].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setQuery(tag)}
                  className="px-2.5 py-1 rounded-full bg-muted/80 hover:bg-primary/10 hover:text-primary transition text-[11px]"
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {/* Results List */}
          <div className="flex-1 overflow-y-auto space-y-4 pe-1">
            {!hasQuery ? (
              <div className="text-center py-10 text-muted-foreground text-xs space-y-1">
                <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p>اكتب أي كلمة للبحث في المنشورات، التعليقات، أو أسماء الطلاب والأساتذة</p>
              </div>
            ) : isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : totalResults === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm space-y-1">
                <p>لم نجد أي نتائج تطابق "{cleanQuery}"</p>
                <p className="text-xs text-muted-foreground/80">جرب البحث بكلمات أخرى.</p>
              </div>
            ) : (
              <>
                {/* 1. PEOPLE */}
                {(activeTab === "all" || activeTab === "people") && matchedPeople.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-primary flex items-center gap-1.5 border-b pb-1">
                      <UserIcon className="w-3.5 h-3.5" /> الأشخاص ({matchedPeople.length})
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {matchedPeople.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2.5 rounded-xl border bg-card/60 hover:bg-accent/40 transition gap-2"
                        >
                          <Link
                            to="/profile/$id"
                            params={{ id: p.id }}
                            onClick={handleClose}
                            className="flex items-center gap-2.5 min-w-0 flex-1 group"
                          >
                            <Avatar className="w-10 h-10 shrink-0 border">
                              <AvatarImage src={p.avatar_url ?? undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                {p.full_name.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs text-foreground group-hover:text-primary transition truncate flex items-center gap-1">
                                {p.full_name}
                                {p.verified && <VerifiedBadge size="sm" />}
                              </div>

                              <div
                                className="text-[11px] font-mono text-muted-foreground"
                                dir="ltr"
                              >
                                {formatUnivNumber(p.university_number, p.id)}
                              </div>

                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                {p.major && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                                    {majorLabel(p.major)}
                                  </Badge>
                                )}
                                <RankBadge points={p.points ?? 0} />
                              </div>
                            </div>
                          </Link>

                          {user?.id !== p.id && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => startDmMut.mutate(p.id)}
                              disabled={startDmMut.isPending}
                              className="h-8 w-8 p-0 shrink-0 rounded-lg hover:bg-primary hover:text-primary-foreground transition"
                              title="مراسلة"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. POSTS */}
                {(activeTab === "all" || activeTab === "posts") && matchedPosts.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-primary flex items-center gap-1.5 border-b pb-1">
                      <FileText className="w-3.5 h-3.5" /> المنشورات ({matchedPosts.length})
                    </div>

                    <div className="space-y-2">
                      {matchedPosts.map((post) => (
                        <div
                          key={post.id}
                          className="p-3 rounded-xl border bg-card/60 hover:bg-card transition space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            {post.author ? (
                              <Link
                                to="/profile/$id"
                                params={{ id: post.author.id }}
                                onClick={handleClose}
                                className="flex items-center gap-2 group"
                              >
                                <Avatar className="w-7 h-7">
                                  <AvatarImage src={post.author.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[10px]">
                                    {post.author.full_name.slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <span className="text-xs font-semibold group-hover:text-primary transition flex items-center gap-1">
                                    {post.author.full_name}
                                    {post.author.verified && <VerifiedBadge size="sm" />}
                                  </span>
                                  <span
                                    className="text-[10px] text-muted-foreground block font-mono"
                                    dir="ltr"
                                  >
                                    {formatUnivNumber(
                                      post.author.university_number,
                                      post.author.id,
                                    )}
                                  </span>
                                </div>
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground">طالب</span>
                            )}

                            <div className="flex items-center gap-1.5">
                              {post.post_type === "question" && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] gap-1 px-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                >
                                  <HelpCircle className="w-3 h-3" /> سؤال
                                </Badge>
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(post.created_at), {
                                  addSuffix: true,
                                  locale: ar,
                                })}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-foreground line-clamp-3 whitespace-pre-line leading-relaxed">
                            {post.content}
                          </p>

                          <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground border-t border-border/40">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Heart className="w-3 h-3" /> {post.reactionCount}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> {post.commentCount}
                              </span>
                            </div>

                            <Link
                              to="/posts/$id"
                              params={{ id: post.id }}
                              onClick={handleClose}
                              className="text-primary hover:underline font-semibold flex items-center gap-1"
                            >
                              عرض المنشور كاملًا <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. COMMENTS */}
                {(activeTab === "all" || activeTab === "comments") &&
                  matchedComments.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-primary flex items-center gap-1.5 border-b pb-1">
                        <MessageSquare className="w-3.5 h-3.5" /> التعليقات (
                        {matchedComments.length})
                      </div>

                      <div className="space-y-2">
                        {matchedComments.map((c) => (
                          <div
                            key={c.id}
                            className="p-3 rounded-xl border bg-card/60 hover:bg-card transition space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              {c.author ? (
                                <Link
                                  to="/profile/$id"
                                  params={{ id: c.author.id }}
                                  onClick={handleClose}
                                  className="flex items-center gap-2 group"
                                >
                                  <Avatar className="w-7 h-7">
                                    <AvatarImage src={c.author.avatar_url ?? undefined} />
                                    <AvatarFallback className="text-[10px]">
                                      {c.author.full_name.slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <span className="text-xs font-semibold group-hover:text-primary transition flex items-center gap-1">
                                      {c.author.full_name}
                                      {c.author.verified && <VerifiedBadge size="sm" />}
                                    </span>
                                    <span
                                      className="text-[10px] text-muted-foreground block font-mono"
                                      dir="ltr"
                                    >
                                      {formatUnivNumber(c.author.university_number, c.author.id)}
                                    </span>
                                  </div>
                                </Link>
                              ) : (
                                <span className="text-xs text-muted-foreground">طالب</span>
                              )}

                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(c.created_at), {
                                  addSuffix: true,
                                  locale: ar,
                                })}
                              </span>
                            </div>

                            <p className="text-xs text-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40 whitespace-pre-line leading-relaxed">
                              {c.content}
                            </p>

                            {c.postSnippet && (
                              <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                                <span className="truncate max-w-[70%] italic">
                                  تعليق على: "{c.postSnippet}..."
                                </span>

                                <Link
                                  to="/posts/$id"
                                  params={{ id: c.post_id }}
                                  onClick={handleClose}
                                  className="text-primary hover:underline font-semibold flex items-center gap-1 shrink-0"
                                >
                                  عرض المنشور <ExternalLink className="w-3 h-3" />
                                </Link>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

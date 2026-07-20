import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { CreatePost } from "@/components/CreatePost";
import { PostList } from "@/components/PostList";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { majorLabel } from "@/lib/college";
import { RankBadge } from "@/components/RankBadge";
import { RANKS, nextRankProgress } from "@/lib/ranks";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

function FeedPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "open_questions" | "solved_questions">("all");

  useEffect(() => {
    if (profile?.must_change_password) {
      navigate({ to: "/change-password", replace: true });
    }
  }, [profile, navigate]);

  const points = profile?.points ?? 0;
  const progress = nextRankProgress(points);

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="md:col-span-2 space-y-4">
        <CreatePost />
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">الكل</TabsTrigger>
            <TabsTrigger value="open_questions">أسئلة مفتوحة</TabsTrigger>
            <TabsTrigger value="solved_questions">أسئلة محلولة</TabsTrigger>
          </TabsList>
        </Tabs>
        <PostList filter={filter} />
      </div>
      <aside className="hidden md:block space-y-4">
        {profile && (
          <Card className="overflow-hidden">
            <div className="h-16 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent" />
            <CardContent className="p-4 -mt-8">
              <Link to="/profile/$id" params={{ id: profile.id }} className="block">
                <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground border-4 border-card flex items-center justify-center font-bold text-lg">
                  {profile.full_name?.slice(0, 2)}
                </div>
              </Link>
              <div className="mt-2 font-bold text-base leading-tight">{profile.full_name}</div>
              <div className="text-xs text-muted-foreground" dir="ltr">
                {profile.university_number}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-muted">
                  {majorLabel(profile.major)}
                </span>
                {profile.year && (
                  <span className="px-2 py-0.5 rounded-full bg-muted">السنة {profile.year}</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rank progress */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              <div className="font-semibold text-sm">مستواك</div>
            </div>
            <div className="flex items-center justify-between">
              <RankBadge points={points} />
              <div className="text-xs font-bold">{points} نقطة</div>
            </div>
            {progress.next ? (
              <>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 start-0 bg-gradient-to-r from-primary/70 to-primary transition-all"
                    style={{ width: `${Math.max(2, Math.min(100, progress.pct))}%` }}
                  />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  متبقٍ <b className="text-foreground">{progress.remaining}</b> نقطة للترقية إلى{" "}
                  <span className="font-semibold">
                    {RANKS[progress.next].emoji} {RANKS[progress.next].label}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-[11px] text-muted-foreground">وصلت أعلى مرتبة! 🏆</div>
            )}
            <div className="pt-2 border-t text-[11px] text-muted-foreground space-y-0.5">
              <div>منشور +5 · تعليق +2 · تفاعل على منشورك +1</div>
              <div className="text-destructive/80">بلاغ مؤكد -20</div>
            </div>
          </CardContent>
        </Card>

        {/* Ranks legend */}
        <Card>
          <CardContent className="p-4">
            <div className="font-semibold text-sm mb-2">المراتب</div>
            <div className="space-y-1.5 text-xs">
              {(
                Object.entries(RANKS) as [keyof typeof RANKS, (typeof RANKS)[keyof typeof RANKS]][]
              ).map(([k, r]) => (
                <div key={k} className="flex items-center justify-between">
                  <span>
                    {r.emoji} {r.label}
                  </span>
                  <span className="text-muted-foreground">{r.min}+</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

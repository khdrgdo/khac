import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Trophy,
  Search,
  Medal,
  BookOpen,
  Flame,
  Loader2,
  Crown,
  Sparkles,
} from "lucide-react";
import { RankBadge } from "@/components/RankBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { majorLabel } from "@/lib/college";
import { MAJORS, YEARS } from "@/lib/college";
import { motion } from "motion/react";
import { Link } from "@tanstack/react-router";


export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
});

type LeaderboardUser = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  points: number;
  major: string | null;
  year: number | null;
  university_number: string;
  verified: boolean;
  score: number; // dynamically computed score based on filters
  contributions: number;
};

function LeaderboardPage() {
  const { profile } = useAuth();
  const [timeframe, setTimeframe] = useState<"all" | "month" | "week">("all");
  const [majorFilter, setMajorFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all courses for filtering
  const { data: courses } = useQuery({
    queryKey: ["leaderboard-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, name, major, year");
      return data ?? [];
    },
  });

  // Fetch leaderboard data
  const { data: leaderboard, isLoading } = useQuery<LeaderboardUser[]>({
    queryKey: ["leaderboard", timeframe, majorFilter, yearFilter, courseFilter],
    queryFn: async () => {
      // 1. Fetch profiles based on basic filters
      let q = supabase.from("profiles").select("*").eq("banned", false);

      // If filtering by a specific course, we restrict to the course's major and year
      if (courseFilter !== "all" && courses) {
        const selectedCourse = courses.find((c) => c.id === courseFilter);
        if (selectedCourse) {
          q = q.eq("major", selectedCourse.major as "is" | "it" | "se").eq("year", selectedCourse.year);
        }
      } else {
        if (majorFilter !== "all") q = q.eq("major", majorFilter as "is" | "it" | "se");
        if (yearFilter !== "all") q = q.eq("year", Number(yearFilter));
      }

      const { data: profiles, error } = await q;
      if (error) throw error;

      const profileList = profiles ?? [];

      // 2. Adjust scores for dynamic timeframes
      if (timeframe === "all") {
        return profileList
          .map((p) => ({
            id: p.id,
            full_name: p.full_name,
            avatar_url: p.avatar_url,
            points: p.points,
            major: p.major,
            year: p.year,
            university_number: p.university_number,
            verified: p.verified,
            score: p.points,
            contributions: 0,
          }))
          .sort((a, b) => b.score - a.score);
      }

      // If timeframe is "week" or "month", compute active score from recent contributions
      const days = timeframe === "week" ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const isoStart = startDate.toISOString();

      // Fetch posts and comments in that range
      const [{ data: posts }, { data: comments }] = await Promise.all([
        supabase.from("posts").select("author_id").gte("created_at", isoStart),
        supabase.from("comments").select("author_id").gte("created_at", isoStart),
      ]);

      const contributionMap = new Map<string, number>();

      // Count posts (worth 10 points on leaderboard)
      (posts ?? []).forEach((p) => {
        contributionMap.set(p.author_id, (contributionMap.get(p.author_id) ?? 0) + 10);
      });

      // Count comments (worth 5 points on leaderboard)
      (comments ?? []).forEach((c) => {
        contributionMap.set(c.author_id, (contributionMap.get(c.author_id) ?? 0) + 5);
      });

      return profileList
        .map((p) => {
          const contribScore = contributionMap.get(p.id) ?? 0;
          return {
            id: p.id,
            full_name: p.full_name,
            avatar_url: p.avatar_url,
            points: p.points,
            major: p.major,
            year: p.year,
            university_number: p.university_number,
            verified: p.verified,
            score: contribScore, // Score in this timeframe
            contributions: Math.round(contribScore / 5), // approximate number of actions
          };
        })
        .sort((a, b) => b.score - a.score);
    },
  });

  const filteredLeaderboard = (leaderboard ?? []).filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.university_number.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Top 3 positions
  const podium = filteredLeaderboard.slice(0, 3);
  const remainder = filteredLeaderboard.slice(3);

  // Find current user rank
  const currentUserRank = filteredLeaderboard.findIndex((u) => u.id === profile?.id) + 1;
  const currentUserData = filteredLeaderboard.find((u) => u.id === profile?.id);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-sm">
          <Trophy className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">لوحة الصدارة</h1>
          <p className="text-sm text-muted-foreground">
            تحدّ زملائك، احصل على نقاط علمية، وتصدّر قائمة الكلية والمساقات
          </p>
        </div>
      </div>

      {/* Main Grid Filters */}
      <Card className="border-muted/60 shadow-sm">
        <CardContent className="p-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث بالاسم أو الرقم الجامعي..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9"
              />
            </div>

            {/* Major Select */}
            <Select
              value={majorFilter}
              onValueChange={(val) => {
                setMajorFilter(val);
                setCourseFilter("all"); // reset course on major change
              }}
              disabled={courseFilter !== "all"}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="التخصص" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التخصصات</SelectItem>
                {MAJORS.map((m) => (
                  <SelectItem key={m.code} value={m.code}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Year Select */}
            <Select
              value={yearFilter}
              onValueChange={(val) => {
                setYearFilter(val);
                setCourseFilter("all"); // reset course on year change
              }}
              disabled={courseFilter !== "all"}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="السنة الدراسية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل السنوات</SelectItem>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    السنة {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Course Tag Select */}
            <Select
              value={courseFilter}
              onValueChange={(val) => {
                setCourseFilter(val);
              }}
            >
              <SelectTrigger className="w-48">
                <BookOpen className="w-4 h-4 ml-1.5 text-muted-foreground" />
                <SelectValue placeholder="تصفية بحسب الكورس" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الكورسات</SelectItem>
                {(courses ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timeframe Select */}
          <div className="flex border rounded-lg p-0.5 bg-muted/40">
            <button
              onClick={() => setTimeframe("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                timeframe === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setTimeframe("month")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                timeframe === "month"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              هذا الشهر
            </button>
            <button
              onClick={() => setTimeframe("week")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                timeframe === "week"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              هذا الأسبوع
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Current User Quick Status */}
      {currentUserData && timeframe === "all" && (
        <Card className="border-primary/20 bg-primary/5 shadow-sm overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary text-lg">
                #{currentUserRank}
              </div>
              <div>
                <div className="font-bold text-foreground">مركزك الحالي في لوحة الصدارة</div>
                <div className="text-xs text-muted-foreground">
                  لديك {currentUserData.points} نقطة علمية وتستحق الرتبة المتميزة
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <RankBadge points={currentUserData.points} />
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredLeaderboard.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent className="space-y-2">
            <Search className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
            <p className="text-sm text-muted-foreground font-medium">
              لم يتم العثور على نتائج تطابق معايير التصفية
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Podium Top 3 — Premium */}
          {podium.length > 0 && (
            <div className="relative">
              {/* Ambient glow */}
              <div className="absolute inset-0 -z-10 blur-3xl opacity-40 pointer-events-none">
                <div className="absolute left-1/2 -translate-x-1/2 top-8 w-56 h-56 rounded-full bg-amber-400/40" />
                <div className="absolute left-8 top-16 w-32 h-32 rounded-full bg-slate-300/40" />
                <div className="absolute right-8 top-16 w-32 h-32 rounded-full bg-amber-700/30" />
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-16 items-end max-w-2xl mx-auto">
                {/* Second Place */}
                {podium[1] ? (
                  <PodiumSpot user={podium[1]} place={2} />
                ) : (
                  <div />
                )}

                {/* First Place — Champion */}
                {podium[0] ? (
                  <PodiumSpot user={podium[0]} place={1} />
                ) : (
                  <div />
                )}

                {/* Third Place */}
                {podium[2] ? (
                  <PodiumSpot user={podium[2]} place={3} />
                ) : (
                  <div />
                )}
              </div>
            </div>
          )}


          {/* List remainder of students */}
          <Card className="border-muted/60 shadow-sm overflow-hidden">
            <CardContent className="p-0 divide-y divide-muted/60">
              {remainder.map((user, idx) => {
                const rank = idx + 4;
                const isSelf = user.id === profile?.id;
                return (
                  <div
                    key={user.id}
                    className={`flex items-center justify-between p-3.5 transition hover:bg-muted/30 ${
                      isSelf ? "bg-primary/5 border-r-4 border-r-primary" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank number */}
                      <span className="w-8 text-center font-bold text-sm text-muted-foreground">
                        {rank}
                      </span>

                      {/* Avatar */}
                      <Avatar className="w-10 h-10 border">
                        <AvatarImage src={user.avatar_url ?? undefined} />
                        <AvatarFallback className="font-semibold">
                          {user.full_name.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>

                      {/* Full Name & Metadata */}
                      <div>
                        <div className="font-bold text-sm flex items-center gap-1.5">
                          {user.full_name}
                          {user.verified && (
                            <Badge
                              variant="secondary"
                              className="px-1 py-0 text-[9px] bg-sky-500/10 text-sky-600 border-none"
                            >
                              موثق
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex gap-1.5 mt-0.5">
                          <span>{majorLabel(user.major)}</span>
                          <span>•</span>
                          <span>السنة {user.year}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Sub-Metric details */}
                      {timeframe !== "all" && user.contributions > 0 && (
                        <span className="text-[11px] text-muted-foreground hidden sm:flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-orange-500" />
                          {user.contributions} نشاط
                        </span>
                      )}

                      {/* Points / Score badge */}
                      <div className="text-right">
                        <div className="font-black text-sm text-foreground">{user.score}</div>
                        <div className="text-[10px] text-muted-foreground">نقطة</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

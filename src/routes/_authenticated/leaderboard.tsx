import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import {
  Trophy,
  Search,
  Medal,
  Calendar,
  BookOpen,
  Flame,
  Star,
  Loader2,
  GraduationCap,
  MoreVertical,
  Filter,
  SlidersHorizontal,
} from "lucide-react";
import { RankBadge } from "@/components/RankBadge";
import { majorLabel } from "@/lib/college";
import { MAJORS, YEARS } from "@/lib/college";
import { motion, AnimatePresence } from "motion/react";

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
  const { profile, isAdmin } = useAuth();
  const [timeframe, setTimeframe] = useState<"all" | "month" | "week">("all");
  const [majorFilter, setMajorFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const activeFiltersCount =
    (searchQuery.trim() ? 1 : 0) +
    (majorFilter !== "all" ? 1 : 0) +
    (yearFilter !== "all" ? 1 : 0) +
    (courseFilter !== "all" ? 1 : 0) +
    (timeframe !== "all" ? 1 : 0);

  const handleResetFilters = () => {
    setSearchQuery("");
    setMajorFilter("all");
    setYearFilter("all");
    setCourseFilter("all");
    setTimeframe("all");
  };

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
    queryKey: [
      "leaderboard",
      timeframe,
      majorFilter,
      yearFilter,
      courseFilter,
      profile?.id,
      isAdmin,
    ],
    queryFn: async () => {
      let effectiveMajor: string | null = majorFilter !== "all" ? majorFilter : null;
      let effectiveYear: number | null = yearFilter !== "all" ? Number(yearFilter) : null;

      if (courseFilter !== "all" && courses) {
        const selectedCourse = courses.find((c) => c.id === courseFilter);
        if (selectedCourse) {
          effectiveMajor = selectedCourse.major;
          effectiveYear = selectedCourse.year;
        }
      }

      interface RawProfileRow {
        id: string;
        full_name: string;
        avatar_url?: string | null;
        points?: number | null;
        major?: string | null;
        year?: number | null;
        university_number?: string | null;
        verified?: boolean | null;
      }

      let profileList: Array<{
        id: string;
        full_name: string;
        avatar_url: string | null;
        points: number;
        major: string | null;
        year: number | null;
        university_number: string;
        verified: boolean;
      }> = [];

      // 1. Try get_leaderboard_profiles RPC (returns all non-banned public profiles securely)
      const { data: rpcProfiles, error: rpcError } = await supabase.rpc(
        "get_leaderboard_profiles",
        {
          _major: effectiveMajor,
          _year: effectiveYear,
        },
      );

      if (!rpcError && Array.isArray(rpcProfiles) && rpcProfiles.length > 0) {
        profileList = (rpcProfiles as unknown as RawProfileRow[]).map((p) => ({
          id: p.id,
          full_name: p.full_name || "مستخدم",
          avatar_url: p.avatar_url || null,
          points: p.points || 0,
          major: p.major || null,
          year: p.year || null,
          university_number: p.university_number || "",
          verified: !!p.verified,
        }));
      } else {
        // 2. Direct profiles query fallback (works for admins or if RLS policy grants view)
        let q = supabase
          .from("profiles")
          .select("id, full_name, avatar_url, points, major, year, university_number, verified")
          .eq("banned", false);

        if (effectiveMajor === "is" || effectiveMajor === "it" || effectiveMajor === "se") {
          q = q.eq("major", effectiveMajor);
        }
        if (effectiveYear) q = q.eq("year", effectiveYear);

        const { data: directProfiles } = await q;
        profileList = directProfiles ?? [];

        // 3. Fallback for non-admin users if direct query returned only current user (due to RLS restriction):
        // Collect author/user IDs from posts, comments, Q&A, courses, and search_public_profiles RPC
        if (profileList.length <= 1) {
          const [
            { data: postAuthors },
            { data: commentAuthors },
            { data: allCourses },
            { data: searchedProfiles },
          ] = await Promise.all([
            supabase.from("posts").select("author_id"),
            supabase.from("comments").select("author_id"),
            supabase.from("courses").select("teacher_id, created_by"),
            supabase.rpc("search_public_profiles", { _q: "" }),
          ]);

          const userIdsSet = new Set<string>();
          if (profile?.id) userIdsSet.add(profile.id);

          (postAuthors ?? []).forEach((row) => row.author_id && userIdsSet.add(row.author_id));
          (commentAuthors ?? []).forEach((row) => row.author_id && userIdsSet.add(row.author_id));
          (allCourses ?? []).forEach((row) => {
            if (row.teacher_id) userIdsSet.add(row.teacher_id);
            if (row.created_by) userIdsSet.add(row.created_by);
          });
          (searchedProfiles ?? []).forEach(
            (row: { id?: string }) => row.id && userIdsSet.add(row.id),
          );

          if (userIdsSet.size > 0) {
            const { data: publicProfs } = await supabase.rpc("get_public_profiles", {
              _ids: Array.from(userIdsSet),
            });

            if (publicProfs && publicProfs.length > 0) {
              const existingMap = new Map(profileList.map((p) => [p.id, p]));
              (publicProfs as unknown as RawProfileRow[]).forEach((p) => {
                if (!existingMap.has(p.id)) {
                  existingMap.set(p.id, {
                    id: p.id,
                    full_name: p.full_name || "مستخدم",
                    avatar_url: p.avatar_url || null,
                    points: p.points || 0,
                    major: p.major || null,
                    year: p.year || null,
                    university_number: p.university_number || "",
                    verified: !!p.verified,
                  });
                }
              });
              profileList = Array.from(existingMap.values());
            }
          }

          // Filter by major and year if effective filters are active
          if (effectiveMajor) {
            profileList = profileList.filter((p) => p.major === effectiveMajor);
          }
          if (effectiveYear) {
            profileList = profileList.filter((p) => p.year === effectiveYear);
          }
        }
      }

      // Always filter out all admin users unconditionally from profileList
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminUserIds = new Set((adminRoles ?? []).map((r) => r.user_id));

      if (profile?.id && isAdmin) {
        adminUserIds.add(profile.id);
      }

      profileList = profileList.filter((p) => {
        if (adminUserIds.has(p.id)) return false;
        if (profile?.id && p.id === profile.id && isAdmin) return false;

        const nameLower = (p.full_name || "").toLowerCase();
        const uniNum = p.university_number || "";

        if (
          uniNum === "2011099840" ||
          nameLower.includes("أدمن") ||
          nameLower.includes("ادمن") ||
          nameLower.includes("admin") ||
          nameLower.includes("مدير")
        ) {
          return false;
        }

        return true;
      });

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

  const filteredLeaderboard = (leaderboard ?? []).filter((user) => {
    // 1. Unconditionally exclude admin user or any account with admin attributes
    const isUserAdmin =
      (profile?.id && user.id === profile.id && isAdmin) ||
      user.university_number === "2011099840" ||
      user.full_name.toLowerCase().includes("ادمن") ||
      user.full_name.toLowerCase().includes("أدمن") ||
      user.full_name.toLowerCase().includes("admin") ||
      user.full_name.toLowerCase().includes("مدير");

    if (isUserAdmin) return false;

    // 2. Search query filter
    return (
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.university_number.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Top 3 positions
  const podium = filteredLeaderboard.slice(0, 3);
  const remainder = filteredLeaderboard.slice(3);

  // Find current user rank
  const currentUserRank = filteredLeaderboard.findIndex((u) => u.id === profile?.id) + 1;
  const currentUserData = filteredLeaderboard.find((u) => u.id === profile?.id);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top Header Bar with 3-Dots Action */}
      <div className="flex items-center justify-between gap-3 bg-card/60 border border-border/60 p-3 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">لوحة الصدارة</h1>
            {showFilters && (
              <p className="text-xs text-muted-foreground transition-all">
                تحدّ زملائك، احصل على نقاط علمية، وتصدّر قائمة الكلية والمساقات
              </p>
            )}
          </div>
        </div>

        {/* 3-Dots Filter Toggle Button */}
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && !showFilters && (
            <Badge
              variant="secondary"
              className="text-[10px] bg-primary/10 text-primary border-none"
            >
              {activeFiltersCount} تصفية نشطة
            </Badge>
          )}

          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters((prev) => !prev)}
            className="h-9 px-3 rounded-xl gap-1.5 text-xs font-semibold transition-all shadow-xs"
            title="خيارات البحث والتصفية"
          >
            <MoreVertical className="w-4 h-4" />
            <span className="hidden sm:inline">خيارات الفلترة</span>
          </Button>
        </div>
      </div>

      {/* Collapsible Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <Card className="border-primary/20 shadow-xs rounded-2xl">
              <CardContent className="p-3.5 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pb-1.5 border-b border-border/50">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Filter className="w-3.5 h-3.5 text-primary" /> البحث وتصفية النتائج
                  </span>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-primary hover:underline text-[11px]"
                    >
                      إعادة ضبط الفلاتر
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2.5 items-center justify-between">
                  <div className="flex flex-wrap gap-2 items-center flex-1 min-w-[260px]">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="ابحث بالاسم أو الرقم الجامعي..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pr-9 h-9 text-xs rounded-xl"
                      />
                    </div>

                    {/* Major Select */}
                    <Select
                      value={majorFilter}
                      onValueChange={(val) => {
                        setMajorFilter(val);
                        setCourseFilter("all");
                      }}
                      disabled={courseFilter !== "all"}
                    >
                      <SelectTrigger className="w-36 h-9 text-xs rounded-xl">
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
                        setCourseFilter("all");
                      }}
                      disabled={courseFilter !== "all"}
                    >
                      <SelectTrigger className="w-32 h-9 text-xs rounded-xl">
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
                      <SelectTrigger className="w-44 h-9 text-xs rounded-xl">
                        <BookOpen className="w-3.5 h-3.5 ml-1 text-muted-foreground" />
                        <SelectValue placeholder="تصفية بالكورس" />
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
                  <div className="flex border rounded-xl p-0.5 bg-muted/40 text-xs">
                    <button
                      onClick={() => setTimeframe("all")}
                      className={`px-3 py-1 rounded-lg font-medium transition ${
                        timeframe === "all"
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      الكل
                    </button>
                    <button
                      onClick={() => setTimeframe("month")}
                      className={`px-3 py-1 rounded-lg font-medium transition ${
                        timeframe === "month"
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      هذا الشهر
                    </button>
                    <button
                      onClick={() => setTimeframe("week")}
                      className={`px-3 py-1 rounded-lg font-medium transition ${
                        timeframe === "week"
                          ? "bg-background text-foreground shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      هذا الأسبوع
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current User Quick Status */}
      {currentUserData && !isAdmin && timeframe === "all" && (
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
          {/* Podium Top 3 */}
          {podium.length > 0 && (
            <div className="grid grid-cols-3 gap-3 pt-6 items-end max-w-xl mx-auto">
              {/* Second Place (Podium Left/Right) */}
              {podium[1] && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex flex-col items-center"
                >
                  <Link
                    to="/profile/$id"
                    params={{ id: podium[1].id }}
                    className="flex flex-col items-center group cursor-pointer"
                  >
                    <div className="relative mb-2">
                      <UserAvatar
                        avatarUrl={podium[1].avatar_url}
                        fullName={podium[1].full_name}
                        className="w-16 h-16 ring-4 ring-slate-300 dark:ring-slate-700 group-hover:ring-primary transition"
                      />
                      <div className="absolute -bottom-1 -right-1 bg-slate-400 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shadow">
                        ٢
                      </div>
                    </div>
                    <span className="font-semibold text-sm text-center line-clamp-1 max-w-[110px] group-hover:underline flex items-center gap-1">
                      {podium[1].full_name}
                      {podium[1].verified && (
                        <Badge
                          variant="secondary"
                          className="px-1 py-0 text-[9px] bg-sky-500/10 text-sky-600 border-none"
                        >
                          موثق
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground mb-3">
                      {majorLabel(podium[1].major)}
                    </span>
                  </Link>
                  <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-t-xl w-full h-24 flex flex-col justify-center items-center shadow-sm">
                    <Medal className="w-5 h-5 text-slate-400 mb-1" />
                    <span className="font-bold text-base text-slate-700 dark:text-slate-300">
                      {podium[1].score}
                    </span>
                    <span className="text-[10px] text-muted-foreground">نقطة</span>
                  </div>
                </motion.div>
              )}

              {/* First Place (Center Podium) */}
              {podium[0] && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center"
                >
                  <Link
                    to="/profile/$id"
                    params={{ id: podium[0].id }}
                    className="flex flex-col items-center group cursor-pointer"
                  >
                    <div className="relative mb-3">
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-amber-500 animate-bounce">
                        <Trophy className="w-6 h-6 fill-amber-500" />
                      </div>
                      <UserAvatar
                        avatarUrl={podium[0].avatar_url}
                        fullName={podium[0].full_name}
                        className="w-20 h-20 ring-4 ring-amber-400 group-hover:ring-amber-500 transition"
                      />
                      <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-sm shadow border border-white">
                        ١
                      </div>
                    </div>
                    <span className="font-bold text-base text-center line-clamp-1 max-w-[120px] group-hover:underline flex items-center gap-1">
                      {podium[0].full_name}
                      {podium[0].verified && (
                        <Badge
                          variant="secondary"
                          className="px-1 py-0 text-[9px] bg-sky-500/10 text-sky-600 border-none"
                        >
                          موثق
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-3">
                      {majorLabel(podium[0].major)}
                    </span>
                  </Link>
                  <div className="bg-amber-500/10 dark:bg-amber-500/5 border-2 border-amber-300 dark:border-amber-900/50 rounded-t-2xl w-full h-32 flex flex-col justify-center items-center shadow-md">
                    <Trophy className="w-6 h-6 text-amber-500 mb-1" />
                    <span className="font-black text-xl text-amber-600 dark:text-amber-400">
                      {podium[0].score}
                    </span>
                    <span className="text-xs font-semibold text-amber-700/80 dark:text-amber-500">
                      نقطة
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Third Place (Podium Left/Right) */}
              {podium[2] && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="flex flex-col items-center"
                >
                  <Link
                    to="/profile/$id"
                    params={{ id: podium[2].id }}
                    className="flex flex-col items-center group cursor-pointer"
                  >
                    <div className="relative mb-2">
                      <UserAvatar
                        avatarUrl={podium[2].avatar_url}
                        fullName={podium[2].full_name}
                        className="w-16 h-16 ring-4 ring-amber-700/30 group-hover:ring-amber-700 transition"
                      />
                      <div className="absolute -bottom-1 -right-1 bg-amber-700 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shadow">
                        ٣
                      </div>
                    </div>
                    <span className="font-semibold text-sm text-center line-clamp-1 max-w-[110px] group-hover:underline flex items-center gap-1">
                      {podium[2].full_name}
                      {podium[2].verified && (
                        <Badge
                          variant="secondary"
                          className="px-1 py-0 text-[9px] bg-sky-500/10 text-sky-600 border-none"
                        >
                          موثق
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground mb-3">
                      {majorLabel(podium[2].major)}
                    </span>
                  </Link>
                  <div className="bg-amber-900/5 dark:bg-amber-900/5 border border-amber-800/10 dark:border-amber-900/20 rounded-t-xl w-full h-20 flex flex-col justify-center items-center shadow-sm">
                    <Medal className="w-5 h-5 text-amber-600 mb-1" />
                    <span className="font-bold text-base text-amber-700 dark:text-amber-500">
                      {podium[2].score}
                    </span>
                    <span className="text-[10px] text-muted-foreground">نقطة</span>
                  </div>
                </motion.div>
              )}
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
                    <Link
                      to="/profile/$id"
                      params={{ id: user.id }}
                      className="flex items-center gap-3 group cursor-pointer flex-1 min-w-0"
                    >
                      {/* Rank number */}
                      <span className="w-8 text-center font-bold text-sm text-muted-foreground shrink-0">
                        {rank}
                      </span>

                      {/* Avatar */}
                      <UserAvatar
                        avatarUrl={user.avatar_url}
                        fullName={user.full_name}
                        className="w-10 h-10 border shrink-0"
                      />

                      {/* Full Name & Metadata */}
                      <div className="min-w-0">
                        <div className="font-bold text-sm flex items-center gap-1.5 group-hover:underline truncate">
                          <span className="truncate">{user.full_name}</span>
                          {user.verified && (
                            <Badge
                              variant="secondary"
                              className="px-1 py-0 text-[9px] bg-sky-500/10 text-sky-600 border-none shrink-0"
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
                    </Link>

                    <div className="flex items-center gap-4 shrink-0 ms-2">
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

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatUnivNumber } from "@/lib/privacy";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Users, Shield, Clock, Loader2, UserPlus, Search } from "lucide-react";
import { format } from "date-fns";
import { majorLabel } from "@/lib/college";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { formatArabicTimeAgo } from "@/lib/notificationsStore";
import { type AdminActionRow } from "@/components/admin/admin-shared";
import { Input } from "@/components/ui/input";

// ============ ACTIVITY LOG ============

export function ActivityLogTab() {
  const [subTab, setSubTab] = useState<"new_users" | "recent_activity" | "admin_actions">(
    "new_users",
  );
  const [search, setSearch] = useState("");

  // 1. Fetch New Registered Users (sorted by created_at desc)
  const { data: newUsers = [], isLoading: loadingNewUsers } = useQuery({
    queryKey: ["admin-activity-new-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, university_number, year, major, verified, created_at, avatar_url, points",
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
  });

  // 2. Fetch Recent System Activity & Interactions
  const { data: recentActivities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ["admin-activity-recent-timeline"],
    queryFn: async () => {
      const { data: posts } = await supabase
        .from("posts")
        .select("id, author_id, content, created_at")
        .order("created_at", { ascending: false })
        .limit(30);

      const { data: comments } = await supabase
        .from("comments")
        .select("id, post_id, author_id, content, created_at")
        .order("created_at", { ascending: false })
        .limit(30);

      const { data: reactions } = await supabase
        .from("post_reactions")
        .select("post_id, user_id, reaction, created_at")
        .order("created_at", { ascending: false })
        .limit(30);

      const profIds = new Set<string>();
      (posts || []).forEach((p) => profIds.add(p.author_id));
      (comments || []).forEach((c) => profIds.add(c.author_id));
      (reactions || []).forEach((r) => profIds.add(r.user_id));

      const { data: profs } = profIds.size
        ? await supabase
            .from("profiles")
            .select("id, full_name, avatar_url, year")
            .in("id", Array.from(profIds))
        : { data: [] };

      const nameMap = new Map((profs || []).map((p) => [p.id, p]));

      const timeline: Array<{
        id: string;
        userId: string;
        userName: string;
        userAvatar?: string | null;
        year?: number | null;
        type: "post" | "comment" | "reaction";
        title: string;
        details?: string;
        createdAt: string;
      }> = [];

      (posts || []).forEach((p) => {
        const u = nameMap.get(p.author_id);
        timeline.push({
          id: `post_${p.id}`,
          userId: p.author_id,
          userName: u?.full_name || "مستخدم",
          userAvatar: u?.avatar_url,
          year: u?.year,
          type: "post",
          title: "نشر منشوراً جديداً",
          details: p.content.slice(0, 60),
          createdAt: p.created_at,
        });
      });

      (comments || []).forEach((c) => {
        const u = nameMap.get(c.author_id);
        timeline.push({
          id: `comment_${c.id}`,
          userId: c.author_id,
          userName: u?.full_name || "مستخدم",
          userAvatar: u?.avatar_url,
          year: u?.year,
          type: "comment",
          title: "أضاف تعليقاً",
          details: c.content.slice(0, 60),
          createdAt: c.created_at,
        });
      });

      (reactions || []).forEach((r) => {
        const u = nameMap.get(r.user_id);
        timeline.push({
          id: `react_${r.post_id}_${r.user_id}_${r.reaction}`,
          userId: r.user_id,
          userName: u?.full_name || "مستخدم",
          userAvatar: u?.avatar_url,
          year: u?.year,
          type: "reaction",
          title: "تفاعل مع منشور",
          details: `نوع التفاعل: ${r.reaction}`,
          createdAt: r.created_at,
        });
      });

      return timeline.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
  });

  // 3. Admin Actions Log
  const { data: adminActions = [], isLoading: loadingAdminActions } = useQuery({
    queryKey: ["admin-log"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("admin_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      const actions = (rows ?? []) as AdminActionRow[];
      const ids = Array.from(
        new Set([
          ...actions.map((a) => a.admin_id),
          ...actions.map((a) => a.target_user_id).filter((x): x is string => !!x),
        ]),
      );
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ids)
        : { data: [] as { id: string; full_name: string }[] };
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return actions.map((a) => ({
        ...a,
        adminName: nameMap.get(a.admin_id) ?? "—",
        targetName: a.target_user_id ? (nameMap.get(a.target_user_id) ?? "مستخدم محذوف") : null,
      }));
    },
  });

  const filteredNewUsers = newUsers.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.university_number?.includes(search) ||
      u.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredTimeline = recentActivities.filter(
    (a) =>
      a.userName.toLowerCase().includes(search.toLowerCase()) ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.details && a.details.toLowerCase().includes(search.toLowerCase())),
  );

  const isNewUser = (createdAt: string) => {
    const diffHours = (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    return diffHours <= 168; // 7 days
  };

  const actionLabel: Record<string, string> = {
    warn: "إنذار",
    suspend: "إيقاف مؤقت",
    ban: "حظر",
    unban: "إلغاء حظر/إيقاف",
    delete_user: "حذف مستخدم",
    set_year: "تغيير السنة",
    verify: "توثيق الحساب",
    unverify: "إلغاء التوثيق",
  };

  return (
    <div className="space-y-4 dir-rtl">
      {/* Sub-navigation & Search Header */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border/50 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl flex-wrap">
          <button
            onClick={() => setSubTab("new_users")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              subTab === "new_users"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>أحدث المسجلين الجدد ({newUsers.length})</span>
          </button>
          <button
            onClick={() => setSubTab("recent_activity")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              subTab === "recent_activity"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>سجل النشاط والتواجد</span>
          </button>
          <button
            onClick={() => setSubTab("admin_actions")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              subTab === "admin_actions"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            <span>السجل الإداري</span>
          </button>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في السجل..."
            className="pr-9 h-9 text-xs rounded-xl"
          />
        </div>
      </div>

      {/* SUB-TAB 1: NEW REGISTERED USERS */}
      {subTab === "new_users" && (
        <Card className="border-border/40 shadow-xs bg-card overflow-hidden rounded-2xl">
          <div className="p-3.5 bg-muted/30 border-b border-border/40 flex items-center justify-between">
            <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-500" />
              <span>قائمة أحدث حسابات المستخدمين الجدد والتسجيلات</span>
            </h4>
            <Badge
              variant="outline"
              className="text-[11px] font-mono bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            >
              {filteredNewUsers.length} مستخدم
            </Badge>
          </div>

          {loadingNewUsers ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredNewUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              لا يوجد مستخدمون مطابقون للبحث
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredNewUsers.map((u) => {
                const fresh = isNewUser(u.created_at);
                return (
                  <div
                    key={u.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <UserAvatar
                          avatarUrl={u.avatar_url}
                          fullName={u.full_name || "مستخدم"}
                          className="w-10 h-10 border border-border/60"
                        />
                        {fresh && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-background rounded-full animate-pulse" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-foreground">
                            {u.full_name}
                          </span>
                          {u.verified && <VerifiedBadge />}
                          {fresh && (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-none text-[10px] px-2 py-0.5 rounded-full font-bold">
                              عضو جديد 🎉
                            </Badge>
                          )}
                          {u.year && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0">
                              السنة {u.year}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span>
                            الرقم الجامعي:{" "}
                            <strong className="font-mono text-foreground/90">
                              {formatUnivNumber(u.university_number, u.id, false, true) ||
                                "غير محدد"}
                            </strong>
                          </span>
                          {u.major && (
                            <span>
                              التخصص:{" "}
                              <strong className="text-foreground/90">
                                {majorLabel(u.major) || u.major}
                              </strong>
                            </span>
                          )}
                          {u.email && (
                            <span className="font-mono text-[11px] dir-ltr text-muted-foreground">
                              {u.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <span className="text-[11px] text-muted-foreground font-mono block">
                        انضم: {format(new Date(u.created_at), "yyyy/MM/dd HH:mm")}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 block">
                        {formatArabicTimeAgo(u.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* SUB-TAB 2: RECENT TIMELINE & LOGINS */}
      {subTab === "recent_activity" && (
        <Card className="border-border/40 shadow-xs bg-card overflow-hidden rounded-2xl">
          <div className="p-3.5 bg-muted/30 border-b border-border/40 flex items-center justify-between">
            <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>سجل التفاعل والتواجد الأخير بالمنصة</span>
            </h4>
            <Badge
              variant="outline"
              className="text-[11px] font-mono bg-primary/10 text-primary border-primary/20"
            >
              {filteredTimeline.length} نشاط
            </Badge>
          </div>

          {loadingActivities ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredTimeline.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              لا يوجد نشاط مسجل بعد
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredTimeline.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      avatarUrl={item.userAvatar}
                      fullName={item.userName}
                      className="w-9 h-9 border border-border/50"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{item.userName}</span>
                        {item.year && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            سنة {item.year}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0 border-none font-semibold ${
                            item.type === "post"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : item.type === "comment"
                                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {item.title}
                        </Badge>
                      </div>
                      {item.details && (
                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-md">
                          {item.details}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                    {formatArabicTimeAgo(item.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* SUB-TAB 3: ADMIN ACTIONS */}
      {subTab === "admin_actions" && (
        <Card className="border-border/40 shadow-xs bg-card overflow-hidden rounded-2xl">
          <div className="p-3.5 bg-muted/30 border-b border-border/40 flex items-center justify-between">
            <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-amber-500" />
              <span>سجل الإجراءات والتعديلات الإدارية</span>
            </h4>
            <Badge
              variant="outline"
              className="text-[11px] font-mono bg-amber-500/10 text-amber-600 border-amber-500/20"
            >
              {adminActions.length} إجراء
            </Badge>
          </div>

          {loadingAdminActions ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : adminActions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              لا يوجد نشاط إداري بعد
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {adminActions.map((a) => (
                <div
                  key={a.id}
                  className="p-3.5 flex flex-col gap-2 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center text-xs text-amber-600 font-bold shrink-0">
                        {a.adminName?.charAt(0) || "A"}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-foreground">{a.adminName}</span>
                        <span className="text-muted-foreground">أجرى</span>
                        <Badge
                          variant="secondary"
                          className="font-bold text-[10px] bg-muted text-foreground"
                        >
                          {actionLabel[a.action] ?? a.action}
                        </Badge>
                        {a.targetName && (
                          <>
                            <span className="text-muted-foreground">على</span>
                            <span className="font-bold text-foreground">{a.targetName}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {format(new Date(a.created_at), "yyyy/MM/dd HH:mm")}
                    </span>
                  </div>
                  {a.details &&
                    typeof a.details === "object" &&
                    "reason" in (a.details as Record<string, unknown>) && (
                      <div className="text-xs text-foreground/90 bg-muted/40 border border-border/40 rounded-xl p-2.5 mt-0.5 w-full md:w-3/4">
                        <span className="text-muted-foreground mr-1">السبب:</span>
                        {String((a.details as Record<string, unknown>).reason)}
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

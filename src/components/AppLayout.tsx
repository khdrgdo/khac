import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Home,
  BookOpen,
  MessageCircle,
  Bookmark,
  Shield,
  LogOut,
  User as UserIcon,
  KeyRound,
  Trophy,
  Sparkles,
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { NexusLogo } from "@/components/NexusLogo";
import { formatUnivNumber } from "@/lib/privacy";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { RankBadge } from "@/components/RankBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GlobalSearchDialog } from "@/components/GlobalSearchDialog";
import { NotificationsPopover } from "@/components/NotificationsPopover";
import { InstallPWAButton } from "@/components/InstallPWAButton";
import { motion } from "motion/react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin, isSubAdmin, isTeacher, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });

  // Redirect Google/incomplete users to complete-profile
  useEffect(() => {
    if (loading || !profile || isAdmin) return;
    if (path.startsWith("/complete-profile")) return;
    const needs =
      !profile.major || !profile.year || (profile.university_number?.startsWith("U") ?? false);
    if (needs) navigate({ to: "/complete-profile", replace: true });
  }, [loading, profile, isAdmin, path, navigate]);

  async function signOut() {
    try {
      localStorage.removeItem(`nexus_pwa_dismissed_${profile?.id || "anon"}`);
    } catch {
      /* ignore */
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["unread_messages", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return 0;
      const { data } = await supabase.rpc("get_unread_message_count", { _user_id: profile.id });
      return data || 0;
    },
    enabled: !!profile?.id,
    refetchInterval: 15000,
  });

  const navItems = [
    { to: "/feed", label: "الرئيسية", icon: Home },
    { to: "/courses", label: "الكورسات", icon: BookOpen },
    ...(isTeacher || isAdmin
      ? [{ to: "/courses/mine" as const, label: "مقرراتي", icon: BookOpen }]
      : []),
    { to: "/leaderboard", label: "لوحة الصدارة", icon: Trophy },
    { to: "/messages", label: "المراسلة", icon: MessageCircle },
    { to: "/saved", label: "المحفوظات", icon: Bookmark },
  ];

  return (
    <div className="min-h-screen bg-background selection:bg-accent/25">
      {/* Fixed editorial sidebar (desktop) */}
      <aside className="hidden md:flex fixed inset-y-0 end-0 w-64 flex-col bg-sidebar text-sidebar-foreground border-s border-sidebar-border">
        <div className="px-5 py-6 border-b border-sidebar-border">
          <Link to="/feed" className="block">
            <NexusLogo size="md" showTagline taglineText="المنصة الأكاديمية" />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-0.5">
          {navItems.map((it) => {
            const active = path.startsWith(it.to);
            const isMessages = it.to === "/messages";
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebarActive"
                    className="absolute inset-0 -z-10 rounded-md bg-sidebar-primary"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <it.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{it.label}</span>
                {isMessages && unreadMessages > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                )}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors mt-2 border-t border-sidebar-border pt-4",
                path.startsWith("/admin")
                  ? "text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-primary",
              )}
            >
              <Shield className="w-4 h-4" />
              <span>الإدارة</span>
            </Link>
          )}
        </nav>

        {profile && (
          <div className="px-4 py-4 border-t border-sidebar-border">
            <div className="flex items-center justify-between gap-2 text-[11px] text-sidebar-foreground/70">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-sidebar-primary" /> النقاط
              </span>
              <RankBadge points={profile.points ?? 0} />
            </div>
          </div>
        )}
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-40 md:pe-64 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="md:hidden">
            <Link to="/feed">
              <NexusLogo size="md" showTagline={false} />
            </Link>
          </div>

          <div className="hidden md:block text-xs tracking-wide text-muted-foreground uppercase">
            {navItems.find((n) => path.startsWith(n.to))?.label ?? ""}
          </div>

          <div className="flex items-center gap-1.5">
            <GlobalSearchDialog />
            <NotificationsPopover />
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none group">
                <UserAvatar
                  avatarUrl={profile?.avatar_url}
                  fullName={profile?.full_name ?? "مستخدم"}
                  className="w-9 h-9 rounded-md ring-1 ring-border group-hover:ring-accent transition"
                />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-60 p-1.5 rounded-md border-border">
                <DropdownMenuLabel className="p-2">
                  <div className="font-semibold text-sm text-foreground truncate">
                    {profile?.full_name}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono" dir="ltr">
                    {formatUnivNumber(profile?.university_number, false, isAdmin)}
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {profile && !isSubAdmin && (
                  <DropdownMenuItem
                    onClick={() => navigate({ to: "/profile/$id", params: { id: profile.id } })}
                    className="rounded-md cursor-pointer py-2 px-2.5 gap-2 text-xs font-medium"
                  >
                    <UserIcon className="w-4 h-4 text-accent" /> ملفي الشخصي
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={() => navigate({ to: "/change-password" })}
                  className="rounded-md cursor-pointer py-2 px-2.5 gap-2 text-xs font-medium"
                >
                  <KeyRound className="w-4 h-4 text-muted-foreground" /> تغيير كلمة السر
                </DropdownMenuItem>

                {isAdmin && (
                  <DropdownMenuItem
                    onClick={() => navigate({ to: "/admin" })}
                    className="rounded-md cursor-pointer py-2 px-2.5 gap-2 text-xs font-medium text-accent"
                  >
                    <Shield className="w-4 h-4" /> لوحة الإدارة
                  </DropdownMenuItem>
                )}

                <InstallPWAButton variant="menu" />

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={signOut}
                  className="rounded-md cursor-pointer py-2 px-2.5 gap-2 text-xs font-medium text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" /> تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="md:pe-64">
        <div className="max-w-4xl mx-auto px-3 sm:px-5 py-6 pb-24 md:pb-10">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 md:hidden z-50 bg-background/95 backdrop-blur border-t border-border flex items-center justify-around">
        {navItems.map((it) => {
          const active = path.startsWith(it.to);
          const isMessages = it.to === "/messages";
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors",
                active ? "text-accent" : "text-muted-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="mobileNavTab"
                  className="absolute top-0 inset-x-4 h-0.5 bg-accent"
                  transition={{ type: "spring", stiffness: 450, damping: 34 }}
                />
              )}
              <span className="relative">
                <it.icon className="w-5 h-5" />
                {isMessages && unreadMessages > 0 && (
                  <span className="absolute -top-1.5 -end-2 min-w-[15px] h-[15px] px-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                )}
              </span>
              <span className="text-[10px] leading-tight">{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <InstallPWAButton variant="banner" />
    </div>
  );
}

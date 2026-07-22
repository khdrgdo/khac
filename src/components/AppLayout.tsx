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
  GraduationCap,
  KeyRound,
  Trophy,
  ShieldCheck,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { RankBadge } from "@/components/RankBadge";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin, isTeacher, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });

  // Redirect Google/incomplete users to complete-profile
  useEffect(() => {
    if (loading || !profile) return;
    if (path.startsWith("/complete-profile")) return;
    const needs =
      !profile.major || !profile.year || (profile.university_number?.startsWith("U") ?? false);
    if (needs) navigate({ to: "/complete-profile", replace: true });
  }, [loading, profile, path, navigate]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (profile?.full_name ?? "؟").slice(0, 2);

  const navItems = [
    { to: "/feed", label: "الرئيسية", icon: Home },
    { to: "/courses", label: "الكورسات", icon: BookOpen },
    ...(isAdmin || isTeacher ? [{ to: "/courses/mine", label: "كورساتي", icon: ShieldCheck }] : []),
    { to: "/leaderboard", label: "لوحة الصدارة", icon: Trophy },
    { to: "/messages", label: "المراسلة", icon: MessageCircle },
    { to: "/saved", label: "المحفوظات", icon: Bookmark },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <Link to="/feed" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="font-bold hidden sm:inline">منصة الكلية</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((it) => {
              const active = path.startsWith(it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <it.icon className="w-4 h-4" />
                  {it.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                to="/admin"
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors",
                  path.startsWith("/admin")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Shield className="w-4 h-4" />
                لوحة الإدارة
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none">
                <Avatar className="w-9 h-9 ring-2 ring-transparent hover:ring-primary/30 transition">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-semibold">{profile?.full_name}</div>
                  <div className="text-xs text-muted-foreground font-normal" dir="ltr">
                    {profile?.university_number}
                  </div>
                  {profile && (
                    <div className="mt-1.5">
                      <RankBadge points={profile.points ?? 0} />
                    </div>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profile && (
                  <DropdownMenuItem
                    onClick={() => navigate({ to: "/profile/$id", params: { id: profile.id } })}
                  >
                    <UserIcon className="w-4 h-4" /> ملفي الشخصي
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate({ to: "/change-password" })}>
                  <KeyRound className="w-4 h-4" /> تغيير كلمة السر
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                    <Shield className="w-4 h-4" /> لوحة الإدارة
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={signOut}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4" /> تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex items-center justify-around border-t bg-card py-1">
          {navItems.map((it) => {
            const active = path.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1.5 px-2 rounded text-[10px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <it.icon className="w-5 h-5" />
                {it.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 pb-20 md:pb-8">{children}</main>
    </div>
  );
}

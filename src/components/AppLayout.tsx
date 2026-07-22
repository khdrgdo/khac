import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  Sparkles,
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
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
import { useUnivPrivacy } from "@/hooks/useUnivPrivacy";
import { GlobalSearchDialog } from "@/components/GlobalSearchDialog";
import { motion, AnimatePresence } from "motion/react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const { isHidden: isUnivHidden } = useUnivPrivacy(profile?.id);
  const [scrolled, setScrolled] = useState(false);

  // Monitor scroll for shadow and elevation effects
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const navItems = [
    { to: "/feed", label: "الرئيسية", icon: Home },
    { to: "/courses", label: "الكورسات", icon: BookOpen },
    { to: "/leaderboard", label: "لوحة الصدارة", icon: Trophy },
    { to: "/messages", label: "المراسلة", icon: MessageCircle },
    { to: "/saved", label: "المحفوظات", icon: Bookmark },
  ];

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20 selection:text-primary">
      {/* Sleek Top Navigation Bar */}
      <header
        className={cn(
          "sticky top-0 z-40 w-full transition-all duration-300 border-b border-border/40",
          scrolled
            ? "bg-background/80 backdrop-blur-xl shadow-xs border-border/70 py-0"
            : "bg-background/90 backdrop-blur-md py-0.5",
        )}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-15 flex items-center justify-between gap-3">
          {/* Brand Logo & Title */}
          <Link
            to="/feed"
            className="flex items-center gap-2.5 group shrink-0 transition-transform active:scale-95"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary via-primary/90 to-primary/70 text-primary-foreground flex items-center justify-center shadow-md shadow-primary/20 group-hover:scale-105 group-hover:shadow-primary/30 transition-all duration-300">
              <GraduationCap className="w-5 h-5 transition-transform duration-300 group-hover:-rotate-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-sm sm:text-base tracking-tight leading-none text-foreground group-hover:text-primary transition-colors">
                منصة الكلية
              </span>
              <span className="text-[10px] font-medium text-muted-foreground/80 leading-tight hidden sm:flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                تواصل أكاديمي
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links with Animated Pill Effect */}
          <nav className="hidden md:flex items-center gap-1 bg-muted/40 p-1 rounded-2xl border border-border/40">
            {navItems.map((it) => {
              const active = path.startsWith(it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={cn(
                    "relative px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors z-10",
                    active
                      ? "text-primary dark:text-primary-foreground font-bold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="activeNavTab"
                      className="absolute inset-0 bg-background dark:bg-primary/20 rounded-xl shadow-xs border border-primary/10 dark:border-primary/30 -z-10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <it.icon
                    className={cn(
                      "w-4 h-4 transition-transform duration-200",
                      active ? "scale-110" : "opacity-80 group-hover:opacity-100",
                    )}
                  />
                  <span>{it.label}</span>
                </Link>
              );
            })}

            {isAdmin && (
              <Link
                to="/admin"
                className={cn(
                  "relative px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors z-10",
                  path.startsWith("/admin")
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20"
                    : "text-amber-600/80 dark:text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-600",
                )}
              >
                <Shield className="w-4 h-4" />
                <span>الإدارة</span>
              </Link>
            )}
          </nav>

          {/* Right Actions: Search, Theme, Avatar Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <GlobalSearchDialog />
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none group">
                <div className="relative p-0.5 rounded-full hover:bg-muted/80 transition duration-200">
                  <UserAvatar
                    avatarUrl={profile?.avatar_url}
                    fullName={profile?.full_name ?? "مستخدم"}
                    className="w-9 h-9 ring-2 ring-primary/20 group-hover:ring-primary/50 group-data-[state=open]:ring-primary transition-all duration-300"
                  />
                  <span className="absolute bottom-0 end-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-background rounded-full" />
                </div>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-60 p-1.5 rounded-2xl shadow-xl border-border/60 backdrop-blur-xl animate-in fade-in-80 zoom-in-95 duration-200"
              >
                <DropdownMenuLabel className="p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-foreground truncate">
                        {profile?.full_name}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono" dir="ltr">
                        {isUnivHidden ? "••••••••••" : profile?.university_number}
                      </div>
                    </div>
                  </div>

                  {profile && (
                    <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" /> النقاط
                      </span>
                      <RankBadge points={profile.points ?? 0} />
                    </div>
                  )}
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {profile && (
                  <DropdownMenuItem
                    onClick={() => navigate({ to: "/profile/$id", params: { id: profile.id } })}
                    className="rounded-xl cursor-pointer py-2 px-2.5 gap-2 text-xs font-semibold"
                  >
                    <UserIcon className="w-4 h-4 text-primary" /> ملفي الشخصي
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={() => navigate({ to: "/change-password" })}
                  className="rounded-xl cursor-pointer py-2 px-2.5 gap-2 text-xs font-semibold"
                >
                  <KeyRound className="w-4 h-4 text-muted-foreground" /> تغيير كلمة السر
                </DropdownMenuItem>

                {isAdmin && (
                  <DropdownMenuItem
                    onClick={() => navigate({ to: "/admin" })}
                    className="rounded-xl cursor-pointer py-2 px-2.5 gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400"
                  >
                    <Shield className="w-4 h-4" /> لوحة الإدارة
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={signOut}
                  className="rounded-xl cursor-pointer py-2 px-2.5 gap-2 text-xs font-semibold text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" /> تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Page Layout Wrapper */}
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 pb-24 md:pb-8">{children}</main>

      {/* Floating Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-3 inset-x-3 md:hidden z-50 pointer-events-none">
        <nav className="pointer-events-auto bg-card/85 dark:bg-card/90 backdrop-blur-2xl border border-border/60 shadow-2xl rounded-2xl p-1.5 max-w-md mx-auto flex items-center justify-around gap-1">
          {navItems.map((it) => {
            const active = path.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200",
                  active ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.div
                    layoutId="mobileNavTab"
                    className="absolute inset-0 bg-primary/10 dark:bg-primary/20 rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <it.icon
                  className={cn("w-5 h-5 transition-transform duration-200", active && "scale-110")}
                />
                <span className="text-[10px] leading-tight mt-0.5">{it.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

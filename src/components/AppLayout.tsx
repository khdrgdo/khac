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
import { NexusLogo } from "@/components/NexusLogo";
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
import { useIsPWAInstalled } from "@/hooks/useIsPWAInstalled";
import { Fingerprint } from "lucide-react";
import { useUnivPrivacy } from "@/hooks/useUnivPrivacy";
import { GlobalSearchDialog } from "@/components/GlobalSearchDialog";
import { NotificationsPopover } from "@/components/NotificationsPopover";
import { InstallPWAButton } from "@/components/InstallPWAButton";
import { motion, AnimatePresence } from "motion/react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin, isSubAdmin, loading } = useAuth();
  const isPWAInstalled = useIsPWAInstalled();
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
    if (loading || !profile || isAdmin) return;
    if (path.startsWith("/complete-profile")) return;
    const needs =
      !profile.major || !profile.year || (profile.university_number?.startsWith("U") ?? false);
    if (needs) navigate({ to: "/complete-profile", replace: true });
  }, [loading, profile, isAdmin, path, navigate]);

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
      {/* Sleek Top Navigation Bar with Ultra-Translucent Glassmorphism */}
      <header
        className={cn(
          "sticky top-0 z-40 w-full transition-all duration-200 border-b border-border/40",
          "bg-background/80 backdrop-blur-md shadow-xs",
          scrolled ? "py-1 shadow-xs bg-background/95" : "py-2",
        )}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-3">
          {/* Brand Logo & Title */}
          <Link
            to="/feed"
            className="flex items-center gap-2.5 group shrink-0 transition-transform active:scale-95"
          >
            <NexusLogo size="md" showTagline={true} taglineText="المنصة الأكاديمية" />
          </Link>

          {/* Desktop Navigation Links with Translucent Floating Pill Effect */}
          <nav className="hidden md:flex items-center gap-1 bg-muted/20 dark:bg-muted/15 backdrop-blur-2xl p-1.5 rounded-2xl border border-white/20 dark:border-white/10 shadow-lg shadow-black/5">
            {navItems.map((it) => {
              const active = path.startsWith(it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={cn(
                    "relative px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-200 z-10 hover:text-foreground",
                    active
                      ? "text-primary dark:text-primary-foreground font-bold"
                      : "text-muted-foreground hover:bg-background/20",
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="activeNavTab"
                      className="absolute inset-0 bg-background/80 dark:bg-primary/30 backdrop-blur-md rounded-xl shadow-xs border border-primary/25 dark:border-primary/40 -z-10"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  )}
                  <it.icon
                    className={cn(
                      "w-4 h-4 transition-transform duration-200",
                      active
                        ? "scale-110 text-primary dark:text-primary-foreground"
                        : "opacity-75 group-hover:opacity-100",
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
                  "relative px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 z-10",
                  path.startsWith("/admin")
                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/35 shadow-xs"
                    : "text-amber-600/80 dark:text-amber-400/80 hover:bg-amber-500/15 hover:text-amber-600",
                )}
              >
                <Shield className="w-4 h-4" />
                <span>الإدارة</span>
              </Link>
            )}
          </nav>

          {/* Right Actions: Search, Notifications, Theme, Install PWA, Avatar Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <GlobalSearchDialog />
            <NotificationsPopover />
            <ThemeToggle />
            <InstallPWAButton variant="button" className="hidden lg:inline-flex" />

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

                {profile && !isSubAdmin && (
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

                <InstallPWAButton variant="menu" />

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

      {/* Floating Translucent Mobile Bottom Navigation Bar */}
      <div className="fixed bottom-3 inset-x-3 md:hidden z-50 pointer-events-none">
        <nav className="pointer-events-auto bg-background/25 dark:bg-background/30 backdrop-blur-3xl backdrop-saturate-200 border border-white/25 dark:border-white/10 shadow-2xl shadow-primary/15 rounded-3xl p-1.5 max-w-md mx-auto flex items-center justify-around gap-1">
          {navItems.map((it) => {
            const active = path.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "relative flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 active:scale-95",
                  active
                    ? "text-primary dark:text-primary-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.div
                    layoutId="mobileNavTab"
                    className="absolute inset-0 bg-primary/20 dark:bg-primary/30 backdrop-blur-md rounded-2xl border border-primary/25 dark:border-primary/40 -z-10"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                  />
                )}
                <it.icon
                  className={cn(
                    "w-5 h-5 transition-transform duration-200",
                    active && "scale-110 text-primary dark:text-primary-foreground",
                  )}
                />
                <span className="text-[10px] leading-tight mt-0.5">{it.label}</span>
                {active && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -bottom-0.5 w-1 h-1 bg-primary rounded-full shadow-xs shadow-primary"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

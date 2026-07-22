import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationItem, NotificationType } from "@/types/notification";
import {
  getStoredNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  formatArabicTimeAgo,
} from "@/lib/notificationsStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import {
  Bell,
  BookOpen,
  MessageSquare,
  Heart,
  Megaphone,
  Trophy,
  CheckCheck,
  Trash2,
  X,
  FileText,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export function NotificationsPopover() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id || "";

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "unread">("all");

  const loadNotifications = useCallback(() => {
    if (!userId) return;
    const items = getStoredNotifications(userId);
    setNotifications(items);
  }, [userId]);

  useEffect(() => {
    loadNotifications();

    const handleUpdate = () => {
      loadNotifications();
    };

    window.addEventListener("notifications_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("notifications_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    if (!userId) return;
    markAllNotificationsAsRead(userId);
    loadNotifications();
    toast.success("تم تحديد جميع الإشعارات كأنها قُرئت ✔️");
  };

  const handleClearAll = () => {
    if (!userId) return;
    clearAllNotifications(userId);
    loadNotifications();
    toast.info("تم مسح جميع الإشعارات");
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!userId) return;
    if (!item.read) {
      markNotificationAsRead(userId, item.id);
      loadNotifications();
    }
    setOpen(false);

    if (item.link) {
      navigate({ to: item.link });
    }
  };

  const handleDeleteItem = (e: React.MouseEvent, item: NotificationItem) => {
    e.stopPropagation();
    if (!userId) return;
    deleteNotification(userId, item.id);
    loadNotifications();
  };

  const filteredItems = notifications.filter((n) => {
    if (filterTab === "unread") return !n.read;
    return true;
  });

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "course_added":
        return <BookOpen className="w-4 h-4 text-emerald-500" />;
      case "material_added":
        return <FileText className="w-4 h-4 text-blue-500" />;
      case "comment_reply":
      case "post_comment":
        return <MessageSquare className="w-4 h-4 text-indigo-500" />;
      case "post_like":
      case "comment_like":
        return <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />;
      case "announcement":
        return <Megaphone className="w-4 h-4 text-amber-500" />;
      case "points_awarded":
        return <Trophy className="w-4 h-4 text-yellow-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full w-9 h-9 hover:bg-muted transition duration-200"
          aria-label="الإشعارات"
        >
          <Bell className="w-5 h-5 text-foreground/80 hover:text-foreground transition-colors" />

          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-background shadow-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[340px] sm:w-[380px] p-0 rounded-3xl shadow-2xl border-border/80 bg-card/95 backdrop-blur-xl z-50 overflow-hidden dir-rtl"
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-border/60 bg-muted/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-primary/10 text-primary">
              <Bell className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <span>الإشعارات</span>
              {unreadCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border-none"
                >
                  {unreadCount} جديد
                </Badge>
              )}
            </h3>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                title="تحديد الكل كقراءة"
                className="h-8 px-2 rounded-xl text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
              </Button>
            )}

            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                title="مسح الإشعارات"
                className="h-8 px-2 rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        {notifications.length > 0 && (
          <div className="px-3 pt-2 pb-1 border-b border-border/40 flex items-center gap-2 bg-background/50">
            <button
              onClick={() => setFilterTab("all")}
              className={`text-xs px-3 py-1 rounded-xl font-medium transition-all ${
                filterTab === "all"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              الكل ({notifications.length})
            </button>
            <button
              onClick={() => setFilterTab("unread")}
              className={`text-xs px-3 py-1 rounded-xl font-medium transition-all ${
                filterTab === "unread"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              غير مقروءة ({unreadCount})
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="max-h-[360px] overflow-y-auto divide-y divide-border/30">
          <AnimatePresence initial={false}>
            {filteredItems.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto mb-2">
                  <Bell className="w-6 h-6 opacity-40" />
                </div>
                <p className="text-xs font-semibold text-foreground">
                  {filterTab === "unread"
                    ? "لا توجد إشعارات غير مقروءة"
                    : "لا توجد إشعارات حتى الآن"}
                </p>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                  ستتلقى تنبيهاً فورياً عند إضافة مادة جديدة، الرد على تعليقك، أو تفاعل زملائك معك.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  onClick={() => handleItemClick(item)}
                  className={`relative group p-3 sm:p-3.5 flex items-start gap-3 cursor-pointer transition-colors duration-150 ${
                    !item.read
                      ? "bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15"
                      : "hover:bg-muted/50"
                  }`}
                >
                  {/* Unread dot */}
                  {!item.read && (
                    <span className="absolute top-4 start-1.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}

                  {/* Icon / Avatar */}
                  <div className="relative shrink-0 mt-0.5">
                    {item.actorName ? (
                      <UserAvatar
                        avatarUrl={item.actorAvatar}
                        fullName={item.actorName}
                        className="w-9 h-9 ring-1 ring-border"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center border">
                        {getNotificationIcon(item.type)}
                      </div>
                    )}

                    <div className="absolute -bottom-1 -end-1 p-0.5 rounded-full bg-background border shadow-xs">
                      {getNotificationIcon(item.type)}
                    </div>
                  </div>

                  {/* Body Text */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-foreground line-clamp-1">
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatArabicTimeAgo(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.body}
                    </p>
                  </div>

                  {/* Delete Item Button */}
                  <button
                    onClick={(e) => handleDeleteItem(e, item)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded-lg hover:bg-destructive/10 transition-all shrink-0"
                    title="حذف الإشعار"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </PopoverContent>
    </Popover>
  );
}

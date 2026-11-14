import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/UserAvatar";

interface MentionItem {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  university_number?: string | null;
}

interface MentionListProps {
  items: MentionItem[];
  command: (item: { id: string; label: string }) => void;
}

interface MentionListRef {
  onKeyDown: (ctx: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) {
      command({ id: item.id, label: item.full_name });
    }
  };

  const upHandler = () => {
    if (items.length) setSelectedIndex((current) => (current - 1 + items.length) % items.length);
  };

  const downHandler = () => {
    if (items.length) setSelectedIndex((current) => (current + 1) % items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }
      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        if (items.length) enterHandler();
        return items.length > 0;
      }
      return false;
    },
  }));

  return (
    <div role="listbox" aria-label="اقتراحات الإشارة" className="min-w-[260px] max-w-[min(340px,calc(100vw-32px))] overflow-hidden rounded-xl border border-border bg-popover shadow-lg z-50">
      <div className="border-b border-border/70 px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground">
        الإشارة إلى زميل
      </div>
      {items.length ? (
        <div className="max-h-64 overflow-y-auto p-1">
          {items.map((item, index) => (
            <button
              key={item.id}
              role="option"
              aria-selected={index === selectedIndex}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-right transition-colors",
                index === selectedIndex ? "bg-accent/15" : "hover:bg-muted/70"
              )}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => selectItem(index)}
            >
              <UserAvatar avatarUrl={item.avatar_url} fullName={item.full_name} className="w-8 h-8 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{item.full_name}</span>
                {item.university_number && (
                  <span className="block truncate text-[10px] text-muted-foreground" dir="ltr">{item.university_number}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-3 py-3 text-sm text-muted-foreground">لا يوجد مستخدمون مطابقون</div>
      )}
    </div>
  );
});
MentionList.displayName = "MentionList";

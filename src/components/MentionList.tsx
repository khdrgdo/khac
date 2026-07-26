import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { cn } from "@/lib/utils";

interface MentionItem {
  id: string;
  full_name: string;
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
    setSelectedIndex((selectedIndex + items.length - 1) % items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % items.length);
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
      if (event.key === "Enter") {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-popover border border-border rounded-md shadow-md overflow-hidden min-w-[200px] z-50">
      {items.length ? (
        items.map((item, index) => (
          <button
            key={item.id}
            className={cn(
              "block w-full text-right px-3 py-2 text-sm text-foreground hover:bg-accent",
              index === selectedIndex && "bg-accent"
            )}
            onClick={() => selectItem(index)}
          >
            {item.full_name}
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-muted-foreground">لا يوجد مستخدمون</div>
      )}
    </div>
  );
});
MentionList.displayName = "MentionList";

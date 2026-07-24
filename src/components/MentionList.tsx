import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { cn } from "@/lib/utils";

export const MentionList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: item.full_name });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

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
      {props.items.length ? (
        props.items.map((item: any, index: number) => (
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

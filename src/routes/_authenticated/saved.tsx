import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { PostList } from "@/components/PostList";
import { Bookmark } from "lucide-react";

export const Route = createFileRoute("/_authenticated/saved")({
  component: SavedPage,
});

function SavedPage() {
  const { user } = useAuth();
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Bookmark className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">المحفوظات</h1>
          <p className="text-xs text-muted-foreground">المنشورات التي حفظتها</p>
        </div>
      </div>
      {user && <PostList savedByUserId={user.id} />}
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { CreatePost } from "@/components/CreatePost";
import { PostList } from "@/components/PostList";
import { Card, CardContent } from "@/components/ui/card";
import { majorLabel } from "@/lib/college";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
});

function FeedPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.must_change_password) {
      navigate({ to: "/change-password", replace: true });
    }
  }, [profile, navigate]);

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="md:col-span-2 space-y-4">
        <CreatePost />
        <PostList />
      </div>
      <aside className="hidden md:block space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-semibold mb-2">مرحبًا</div>
            <div className="font-bold text-lg">{profile?.full_name}</div>
            <div className="text-xs text-muted-foreground mt-1" dir="ltr">
              {profile?.university_number}
            </div>
            <div className="mt-3 text-sm space-y-1">
              <div>التخصص: <span className="font-medium">{majorLabel(profile?.major)}</span></div>
              {profile?.year && <div>السنة: <span className="font-medium">{profile.year}</span></div>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            <div className="font-semibold text-foreground mb-1">نصيحة</div>
            استخدم شريط التنقل للانتقال بين الكورسات والمراسلة والمحفوظات.
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

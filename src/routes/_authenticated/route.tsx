import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) throw redirect({ to: "/auth" });
      return { user: data.user };
    } catch (err) {
      if ((err as { to?: string })?.to) throw err;
      throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});

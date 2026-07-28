import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";

function AuthenticatedLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

let lastCheck = 0;
const CHECK_COOLDOWN = 2000;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      return {};
    }

    const now = Date.now();
    if (now - lastCheck < CHECK_COOLDOWN) {
      return {};
    }
    lastCheck = now;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw redirect({ to: "/auth" });
      }
      return { user: session.user };
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        ("isRedirect" in err || "to" in err || "options" in err)
      ) {
        throw err;
      }
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthenticatedLayout,
});

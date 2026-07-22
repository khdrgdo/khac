import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      // First check cached local session
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData?.session?.user;

      if (!sessionUser) {
        throw redirect({ to: "/auth" });
      }

      // Try validating user via getUser(), but fall back to session user if network fails
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userData?.user) {
          return { user: userData.user };
        }
        if (
          userError &&
          (userError.status === 401 || userError.message?.includes("Invalid token"))
        ) {
          throw redirect({ to: "/auth" });
        }
      } catch (innerErr) {
        if (
          innerErr &&
          typeof innerErr === "object" &&
          ("isRedirect" in innerErr || "to" in innerErr || "options" in innerErr)
        ) {
          throw innerErr;
        }
        // If network fetch failed, proceed with session user rather than kicking user out
      }

      return { user: sessionUser };
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        ("isRedirect" in err || "to" in err || "options" in err)
      ) {
        throw err;
      }
      console.warn("Auth check fallback to login:", err);
      throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});

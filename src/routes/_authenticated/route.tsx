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

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      return {};
    }
    const ts = new Date().toISOString();
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      const sessionUser = sessionData?.session?.user;
      console.warn(`[AUTH][${ts}] getSession: user=${sessionUser ? sessionUser.id : "NONE"}, expiresAt=${sessionData?.session?.expires_at}, error=${sessionErr?.message ?? "none"}`);

      if (!sessionUser) {
        console.warn(`[AUTH][${ts}] → REDIRECT: no session user`);
        throw redirect({ to: "/auth" });
      }

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        console.warn(`[AUTH][${ts}] getUser: user=${userData?.user ? userData.user.id : "NONE"}, error=${userError?.message ?? "none"}, status=${userError?.status ?? "none"}`);
        if (
          userError &&
          (userError.status === 401 || userError.message?.includes("Invalid token"))
        ) {
          console.warn(`[AUTH][${ts}] → REDIRECT: 401/Invalid token`);
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
        console.warn(`[AUTH][${ts}] getUser exception (trusted session):`, innerErr);
      }

      console.warn(`[AUTH][${ts}] → OK: returning user`);
      return { user: sessionUser };
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        ("isRedirect" in err || "to" in err || "options" in err)
      ) {
        throw err;
      }
      console.warn(`[AUTH][${ts}] → REDIRECT: outer catch`, err);
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthenticatedLayout,
});

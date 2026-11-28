import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildMobileFallbackLink,
  buildMobileSessionLink,
  clearMobileRedirect,
  getMobileRedirect,
} from "@/lib/mobileAuthBridge";

export function MobileReturnGate() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const [session, setSession] = useState<Session | null>(null);
  const [links, setLinks] = useState<{ primary: string; fallback: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const attemptedReturn = useRef(false);
  const excluded = pathname === "/auth" || pathname === "/complete-profile";

  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true;
      if (active) setSession(nextSession);
    });
    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (active && !receivedAuthEvent) setSession(sessionData.session);
    }).catch(() => {
      if (active && !receivedAuthEvent) setSession(null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || excluded || dismissed) {
      setLinks(null);
      return;
    }
    const redirect = getMobileRedirect();
    const primary = buildMobileSessionLink(session, redirect);
    const fallback = buildMobileFallbackLink(session, redirect);
    if (!primary || !fallback) {
      setLinks(null);
      return;
    }
    setLinks({ primary, fallback });
    if (!attemptedReturn.current) {
      attemptedReturn.current = true;
      window.location.href = primary;
    }
    // Recheck freshness while this page remains open, not just on navigation.
    const expiryCheck = window.setInterval(() => {
      if (!getMobileRedirect()) setLinks(null);
    }, 1000);
    return () => window.clearInterval(expiryCheck);
  }, [session, excluded, dismissed, pathname]);

  if (!session || excluded || dismissed || !links) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-background p-5" dir="rtl">
      <Card className="w-full max-w-md border-t-4 border-t-accent text-center shadow-xl">
        <CardHeader className="items-center gap-3">
          <CheckCircle2 className="h-12 w-12 text-accent" />
          <CardTitle>تم تسجيل الدخول بنجاح!</CardTitle>
          <CardDescription className="leading-7">
            جاري تحويلك لتطبيق نيكسوس على الهاتف...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full gap-2" asChild>
            <a href={links.primary}>
              <ExternalLink className="h-4 w-4" />
              فتح تطبيق نيكسوس الآن
            </a>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <a href={links.fallback}>العودة إلى التطبيق</a>
          </Button>
          <p className="text-xs text-muted-foreground">
            إذا لم يفتح التطبيق تلقائياً اضغط الزر أعلاه.
          </p>
          <Button variant="link" size="sm" className="text-xs" asChild>
            <a href={pathname} onClick={(event) => {
              event.preventDefault();
              clearMobileRedirect();
              setDismissed(true);
              setLinks(null);
            }}>
              المتابعة في الموقع
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
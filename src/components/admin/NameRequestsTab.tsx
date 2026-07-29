import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatUnivNumber } from "@/lib/privacy";
import {
  getNameChangeRequests,
  approveNameChangeRequest,
  rejectNameChangeRequest,
  type NameChangeRequest,
} from "@/lib/nameChangeRequests";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { formatArabicTimeAgo } from "@/lib/notificationsStore";

export function NameRequestsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: requests = [], refetch } = useQuery({
    queryKey: ["name_change_requests"],
    queryFn: getNameChangeRequests,
  });

  useEffect(() => {
    window.addEventListener("name_change_requests_updated", refetch as EventListener);
    return () =>
      window.removeEventListener("name_change_requests_updated", refetch as EventListener);
  }, [refetch]);

  const handleApprove = async (req: NameChangeRequest) => {
    setProcessingId(req.id);
    try {
      await approveNameChangeRequest(req.id);
      toast.success(
        `تمت الموافقة على تغيير اسم "${req.current_name}" إلى "${req.requested_name}" بنجاح!`,
      );
      refetch();
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["public-profiles"] });
    } catch (e) {
      toast.error((e as Error).message || "حدث خطأ أثناء تنفيذ الطلب");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (req: NameChangeRequest) => {
    await rejectNameChangeRequest(req.id);
    toast.info(`تم رفض طلب تغيير الاسم للمستخدم "${req.current_name}"`);
    refetch();
  };

  const filtered = requests.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <Card className="border-border/60 shadow-xs">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-500" />
              طلبات تغيير الأسماء
              {pendingCount > 0 && (
                <Badge className="bg-amber-500 text-slate-950 font-bold px-2 py-0.5 text-xs">
                  {pendingCount} قيد الانتظار
                </Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              مراجعة طلبات تغيير الأسماء المقدمة من الطلاب والأساتذة، وقبولها أو رفضها مع إعادة
              تفعيل التغيير المباشر
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg flex-wrap">
            <Button
              size="sm"
              variant={filter === "pending" ? "default" : "ghost"}
              onClick={() => setFilter("pending")}
              className="h-7 text-xs"
            >
              قيد الانتظار ({pendingCount})
            </Button>
            <Button
              size="sm"
              variant={filter === "approved" ? "default" : "ghost"}
              onClick={() => setFilter("approved")}
              className="h-7 text-xs"
            >
              المقبولة
            </Button>
            <Button
              size="sm"
              variant={filter === "rejected" ? "default" : "ghost"}
              onClick={() => setFilter("rejected")}
              className="h-7 text-xs"
            >
              المرقوضة
            </Button>
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "ghost"}
              onClick={() => setFilter("all")}
              className="h-7 text-xs"
            >
              الكل ({requests.length})
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/60">
            لا توجد طلبات تغيير أسماء لهذا الفلتر حالياً
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl border border-border/60 bg-card hover:border-amber-500/40 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">الاسم الحالي:</span>
                      <span className="font-bold text-sm text-foreground">{req.current_name}</span>
                      <span className="text-amber-500 font-bold">←</span>
                      <span className="text-xs text-muted-foreground font-mono">المطلوب:</span>
                      <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold">
                        {req.requested_name}
                      </Badge>
                    </div>

                    {req.university_number && (
                      <div className="text-xs font-mono text-muted-foreground">
                        الرقم الجامعي: {formatUnivNumber(req.university_number, req.user_id, false, true)}
                      </div>
                    )}
                  </div>

                  <Badge
                    variant={
                      req.status === "approved"
                        ? "default"
                        : req.status === "rejected"
                          ? "destructive"
                          : "outline"
                    }
                    className="text-xs"
                  >
                    {req.status === "approved"
                      ? "تم القبول وتحديث الاسم"
                      : req.status === "rejected"
                        ? "مرفوض"
                        : "قيد المراجعة"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded-lg border border-border/40">
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-0.5">
                      سبب الطلب:
                    </span>
                    <span className="text-foreground leading-relaxed">{req.reason}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground block mb-0.5">
                      معلومات التواصل:
                    </span>
                    <span className="text-foreground font-mono font-medium">
                      {req.contact_info}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 flex-wrap gap-2">
                  <span>تاريخ الطلب: {new Date(req.created_at).toLocaleString("ar-EG")}</span>

                  {req.status === "pending" && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(req)}
                        disabled={processingId === req.id}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10"
                      >
                        رفض الطلب
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(req)}
                        disabled={processingId === req.id}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-bold"
                      >
                        {processingId === req.id && <Loader2 className="w-3 h-3 animate-spin" />}
                        قبول وتحديث الاسم
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";

export function DeleteCourseDialog({
  onDelete,
  isPending,
}: {
  onDelete: () => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive rounded-xl gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          حذف المقرر
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" /> تأكيد حذف المقرر الدراسي
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground pt-2 leading-relaxed">
          هل أنت متأكد من رغبتك في حذف هذا المقرر الدراسي نهائياً؟ ستُحذف جميع الملفات والروابط
          والإعلانات التابعة له بشكل لا يمكن التراجع عنه.
        </p>
        <DialogFooter className="pt-4 gap-2 flex flex-col-reverse sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl" disabled={isPending}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onDelete();
              if (!isPending) setOpen(false);
            }}
            disabled={isPending}
            className="rounded-xl font-semibold"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin ml-1.5" />} نعم، حذف المقرر
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";

export function DeleteCourseDialog({
  onDelete,
  isPending,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: {
  onDelete?: () => void;
  isPending?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? (externalOnOpenChange || (() => {})) : setInternalOpen;

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      {!isControlled && (
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="rounded-xl text-destructive hover:bg-destructive/10 gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> حذف
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent className="dir-rtl rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>حذف المادة الدراسية؟</AlertDialogTitle>
          <AlertDialogDescription>
            هل أنت أسبوع من إتمام عملية الحذف؟ سيتم حذف المقرر وجميع الملفات والروابط المرتبطة به بشكل نهائي.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDelete?.()}
            className="bg-destructive hover:bg-destructive/90 rounded-xl text-white"
            disabled={isPending}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : "تأكيد الحذف"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

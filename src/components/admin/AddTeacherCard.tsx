import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export function AddTeacherCard() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const qc = useQueryClient();

  const { data: courses } = useQuery({
    queryKey: ["all-courses-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, name");
      return data || [];
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (pw.length < 6) throw new Error("┘â┘ä┘à╪⌐ ╪º┘ä╪│╪▒ ┘é╪╡┘è╪▒╪⌐");
      const uniqueUniv = "T" + Date.now().toString().slice(-8);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pw,
        options: {
          data: {
            university_number: uniqueUniv,
            full_name: name.trim(),
            role: "teacher",
            must_change_password: false,
          },
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("┘ä┘à ┘è╪¬┘à ╪Ñ┘å╪┤╪º╪í ╪º┘ä╪¡╪│╪º╪¿");

      // Promote user to teacher role securely using RPC, falling back to direct table write if RPC fails
      let roleError;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.rpc("admin_set_teacher_role" as any, {
          _user: data.user.id,
        });
        roleError = error;
      } catch (e) {
        roleError = e;
      }

      if (roleError) {
        const { error: deleteError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", data.user.id);
        if (deleteError) throw deleteError;

        const { error: insertError } = await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: "teacher",
        });
        if (insertError) throw insertError;
      }

      // Assign selected courses to the teacher
      if (selectedCourses.length > 0) {
        const { error: coursesError } = await supabase
          .from("courses")
          .update({ teacher_id: data.user.id })
          .in("id", selectedCourses);
        if (coursesError) {
        }
      }
    },
    onSuccess: () => {
      toast.success("╪¬┘à ╪Ñ┘å╪┤╪º╪í ╪¡╪│╪º╪¿ ╪º┘ä╪ú╪│╪¬╪º╪░ ┘ê╪¬╪╣┘è┘è┘å ╪º┘ä┘à┘é╪▒╪▒╪º╪¬");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      setOpen(false);
      setEmail("");
      setName("");
      setPw("");
      setSelectedCourses([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-border/40 shadow-none bg-card">
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground mb-3">
          ╪ú┘å╪┤╪ª ╪¡╪│╪º╪¿ ╪ú╪│╪¬╪º╪░ ┘è╪»╪«┘ä ╪¿╪º┘ä╪¿╪▒┘è╪» ╪º┘ä╪Ñ┘ä┘â╪¬╪▒┘ê┘å┘è╪î ┘ê╪¡╪»╪» ╪º┘ä┘à┘é╪▒╪▒╪º╪¬ ╪º┘ä╪¬┘è ┘è╪»╪▒╪│┘ç╪º.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4" /> ╪Ñ╪╢╪º┘ü╪⌐ ╪ú╪│╪¬╪º╪░
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>╪¡╪│╪º╪¿ ╪ú╪│╪¬╪º╪░ ╪¼╪»┘è╪»</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>╪º┘ä╪º╪│┘à ╪º┘ä┘â╪º┘à┘ä</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>╪º┘ä╪¿╪▒┘è╪» ╪º┘ä╪Ñ┘ä┘â╪¬╪▒┘ê┘å┘è</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label>┘â┘ä┘à╪⌐ ╪º┘ä╪│╪▒</Label>
                <Input
                  type="text"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label>╪º┘ä┘à┘é╪▒╪▒╪º╪¬ ╪º┘ä╪¬┘è ┘è╪»╪▒╪│┘ç╪º</Label>
                <ScrollArea className="h-40 border rounded-md p-3">
                  <div className="space-y-2">
                    {courses?.map((course) => (
                      <div key={course.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`course-${course.id}`}
                          checked={selectedCourses.includes(course.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCourses([...selectedCourses, course.id]);
                            } else {
                              setSelectedCourses(selectedCourses.filter((id) => id !== course.id));
                            }
                          }}
                        />
                        <Label
                          htmlFor={`course-${course.id}`}
                          className="font-normal cursor-pointer text-sm"
                        >
                          {course.name}
                        </Label>
                      </div>
                    ))}
                    {courses?.length === 0 && (
                      <p className="text-sm text-muted-foreground">┘ä╪º ┘è┘ê╪¼╪» ┘à┘é╪▒╪▒╪º╪¬ ┘à╪¬╪º╪¡╪⌐</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => mut.mutate()}
                disabled={!email || !name || !pw || mut.isPending}
              >
                {mut.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />} ╪Ñ┘å╪┤╪º╪í ┘ê╪¬╪╣┘è┘è┘å
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

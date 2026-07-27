const fs = require('fs');
const path = require('path');

const COURSE = path.join(process.env.TEMP || '/tmp', 'nexus_fix', 'src', 'routes', '_authenticated', 'courses.$id.tsx');
const content = fs.readFileSync(COURSE, 'utf8');
const lines = content.split('\n');

function extractLines(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

const DIR = path.join(process.env.TEMP || '/tmp', 'nexus_fix', 'src', 'components', 'courses');
fs.mkdirSync(DIR, { recursive: true });

// 1. course-types.ts — shared types
const types = `export interface CourseFile {
  id: string;
  title: string;
  url: string;
  link_type: string;
  created_by: string;
  created_at: string;
}

export interface CourseUpdate {
  id: string;
  course_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface CourseData {
  id: string;
  name: string;
  description: string;
  major: string;
  year: number;
  semester: string;
  teacher_id: string | null;
}

export interface ScheduleEntry {
  day: string;
  start: string;
  end: string;
  room: string;
}

export interface CoursePublicProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  verified?: boolean;
}

export interface CourseQuestionPost {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  author: CoursePublicProfile | null;
  cleanContent: string;
}
`;
fs.writeFileSync(path.join(DIR, 'course-types.ts'), types, 'utf8');
console.log('Created course-types.ts');

// 2. DeleteCourseDialog.tsx
const deleteDialog = `import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";

${extractLines(310, 359)}
`;
fs.writeFileSync(path.join(DIR, 'DeleteCourseDialog.tsx'), deleteDialog, 'utf8');
console.log('Created DeleteCourseDialog.tsx');

// 3. EditCourseDialog.tsx
const editDialog = `import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type CourseData } from "@/components/courses/course-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { majorLabel, MAJORS, YEARS, SEMESTERS } from "@/lib/college";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

${extractLines(371, 549)}
`;
fs.writeFileSync(path.join(DIR, 'EditCourseDialog.tsx'), editDialog, 'utf8');
console.log('Created EditCourseDialog.tsx');

// 4. LinksTab.tsx (includes AddLinkDialog)
const linksTab = `import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { type CourseFile } from "@/components/courses/course-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ExternalLink, Plus, Trash2, Loader2, MessageSquare, Clock } from "lucide-react";
import { parseTitleAndNote, formatTitleAndNote } from "@/lib/courseUtils";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

${extractLines(551, 769)}
`;
fs.writeFileSync(path.join(DIR, 'LinksTab.tsx'), linksTab, 'utf8');
console.log('Created LinksTab.tsx');

// 5. FilesTab.tsx
const filesTab = `import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { type CourseFile } from "@/components/courses/course-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Download, Play, Trash2, Loader2, FileText, Video, Image as ImageIcon, MessageSquare, Clock } from "lucide-react";
import { parseTitleAndNote, formatTitleAndNote, getFileTypeInfo } from "@/lib/courseUtils";
import { broadcastNotification } from "@/lib/notificationsStore";
import { signedUrl } from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

${extractLines(771, 1077)}
`;
fs.writeFileSync(path.join(DIR, 'FilesTab.tsx'), filesTab, 'utf8');
console.log('Created FilesTab.tsx');

// 6. ScheduleTab.tsx
const scheduleTab = `import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type ScheduleEntry } from "@/components/courses/course-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";

${extractLines(1079, 1235)}
`;
fs.writeFileSync(path.join(DIR, 'ScheduleTab.tsx'), scheduleTab, 'utf8');
console.log('Created ScheduleTab.tsx');

// 7. UpdatesTab.tsx
const updatesTab = `import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { renderMarkdownContent } from "@/lib/markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Megaphone, Trash2, Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

${extractLines(1237, 1365)}
`;
fs.writeFileSync(path.join(DIR, 'UpdatesTab.tsx'), updatesTab, 'utf8');
console.log('Created UpdatesTab.tsx');

// 8. DiscussionsTab.tsx
const discussionsTab = `import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { type CourseQuestionPost, type CoursePublicProfile } from "@/components/courses/course-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/RichTextEditor";
import { HelpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { QuestionCard } from "@/components/courses/QuestionCard";

${extractLines(1383, 1533)}
`;
fs.writeFileSync(path.join(DIR, 'DiscussionsTab.tsx'), discussionsTab, 'utf8');
console.log('Created DiscussionsTab.tsx');

// 9. QuestionCard.tsx
const questionCard = `import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { type CourseQuestionPost, type CoursePublicProfile } from "@/components/courses/course-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock, Send, Trash2, Loader2 } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { broadcastNotification } from "@/lib/notificationsStore";
import DOMPurify from "dompurify";
import parse, { DOMNode, Element } from "html-react-parser";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

${extractLines(1535, 1800)}
`;
fs.writeFileSync(path.join(DIR, 'QuestionCard.tsx'), questionCard, 'utf8');
console.log('Created QuestionCard.tsx');

// 10. Rewrite courses.$id.tsx as slim orchestrator
const orchestrator = `import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getSubAdminPermissions } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ArrowRight, BookOpen, UserCheck, Pencil, Trash2 } from "lucide-react";
import { majorLabel } from "@/lib/college";
import { DeleteCourseDialog } from "@/components/courses/DeleteCourseDialog";
import { EditCourseDialog } from "@/components/courses/EditCourseDialog";
import { FilesTab } from "@/components/courses/FilesTab";
import { LinksTab } from "@/components/courses/LinksTab";
import { DiscussionsTab } from "@/components/courses/DiscussionsTab";
import { UpdatesTab } from "@/components/courses/UpdatesTab";
import { ScheduleTab } from "@/components/courses/ScheduleTab";
import { toast } from "sonner";
import type { CourseData } from "@/components/courses/course-types";

export const Route = createFileRoute("/_authenticated/courses/$id")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: search.tab as string | undefined,
    };
  },
  component: CourseDetailPage,
});

${extractLines(91, 308)}
`;
fs.writeFileSync(COURSE, orchestrator, 'utf8');
console.log('Rewrote courses.$id.tsx as slim orchestrator');

console.log('\\nDone! courses.$id.tsx split into 9 files + orchestrator.');

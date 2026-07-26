export interface CourseFile {
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
  description: string | null;
  major: string;
  year: number;
  semester: number | string;
  teacher_id: string | null;
  created_by?: string | null;
  created_at?: string;
  schedule?: unknown;
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

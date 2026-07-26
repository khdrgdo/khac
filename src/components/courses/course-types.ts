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

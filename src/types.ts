/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  department: string;
  createdAt: string;
}

export interface Schedule {
  id: string; // unique database id
  semester: number; // 1 or 2
  day: "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday"; // الأيام الدراسية
  period: number; // 1 to 5
  periodTime: string; // e.g. "08:30 - 10:00"
  room: string; // e.g. "قاعة 1", "مدرج أ"
  professor: string;
  specialty: string; // e.g. "رياضيات", "فيزياء", "كيمياء"
  level: string; // e.g. "ليسانس", "ماستر"
  year: string; // e.g. "سنة 1", "سنة 2"
  group: string; // e.g. "فوج 1", "فوج 2"
  module: string; // e.g. "تحليل 1", "ميكانيك الكم"
}

export interface Reservation {
  id: string; // format: {roomId}_{date}_{period}
  roomId: string; // room name
  date: string; // YYYY-MM-DD
  dayName: string; // e.g., "Sunday"
  period: number;
  periodTime: string;
  profEmail: string;
  profName: string;
  specialty: string;
  level: string;
  year: string;
  group: string;
  module: string;
  createdAt: string; // date-time string
}

export const ROOMS_LIST = [
  "قاعة 1",
  "قاعة 2",
  "قاعة 3",
  "قاعة 4",
  "قاعة 5",
  "قاعة 6",
  "قاعة 7",
  "مدرج أ",
  "مدرج ب",
  "مدرج ج",
  "مخبر الفيزياء",
  "مخبر الكيمياء",
  "مخبر الإعلام الآلي"
];

export const PERIODS = [
  { id: 1, time: "08:30 - 10:00", label: "الحصة الأولى" },
  { id: 2, time: "10:15 - 11:45", label: "الحصة الثانية" },
  { id: 3, time: "12:00 - 13:30", label: "الحصة الثالثة" },
  { id: 4, time: "13:45 - 15:15", label: "الحصة الرابعة" },
  { id: 5, time: "15:30 - 17:00", label: "الحصة الخامسة" }
];

export const DAYS_ARABIC: Record<string, string> = {
  "Sunday": "الأحد",
  "Monday": "الاثنين",
  "Tuesday": "الثلاثاء",
  "Wednesday": "الأربعاء",
  "Thursday": "الخميس"
};

export const DAYS_LIST: ("Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday")[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday"
];

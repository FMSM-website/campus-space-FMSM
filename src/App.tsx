/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, 
  onSnapshot, 
  doc, 
  getDoc, 
  setDoc,
  writeBatch
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { Schedule, Reservation, UserProfile } from "./types";
import { SEED_SCHEDULES } from "./data/seedData";
import AuthSection from "./components/AuthSection";
import SearchSection from "./components/SearchSection";
import TimetableGrid from "./components/TimetableGrid";
import BookingSection from "./components/BookingSection";
import ImportSection from "./components/ImportSection";
import { 
  GraduationCap, 
  Building2, 
  Compass, 
  Calendar, 
  Clock, 
  ShieldAlert, 
  Database,
  ChevronRight,
  Info,
  Sparkles,
  LogIn,
  UserPlus
} from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  
  const [currentSemester, setCurrentSemester] = useState<number>(1);
  const [selectedDay, setSelectedDay] = useState<"Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday">("Sunday");
  const [activeTab, setActiveTab] = useState<"timetable" | "booking" | "import">("timetable");
  
  const [initialRoom, setInitialRoom] = useState("");
  const [initialPeriod, setInitialPeriod] = useState<number>(1);
  
  const [loading, setLoading] = useState(true);
  const [initializingDb, setInitializingDb] = useState(false);

  // Set default day of week dynamically based on Algerian time
  useEffect(() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
    const d = new Date();
    const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
    if (days.includes(dayName)) {
      setSelectedDay(dayName as any);
    }
  }, []);

  // Listen to Auth State changes
  useEffect(() => {
    // Check if there's a cached local user first as fallback
    const cachedUser = localStorage.getItem("local_professor_user");
    const cachedProfile = localStorage.getItem("local_professor_profile");
    if (cachedUser && cachedProfile) {
      setCurrentUser(JSON.parse(cachedUser));
      setUserProfile(JSON.parse(cachedProfile));
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const profileDoc = await getDoc(doc(db, "users", user.uid));
          if (profileDoc.exists()) {
            setUserProfile(profileDoc.data() as UserProfile);
          } else {
            // Build fallback profile if needed
            const fallbackProfile: UserProfile = {
              uid: user.uid,
              email: user.email || "",
              name: user.displayName || user.email?.split("@")[0] || "الزميل الأستاذ",
              department: "قسم الرياضيات",
              createdAt: new Date().toISOString()
            };
            setUserProfile(fallbackProfile);
          }
        } catch (e) {
          console.error("Error reading profile document:", e);
        }
      } else {
        // Only clear if we don't have a local fallback logged in
        if (!localStorage.getItem("local_professor_user")) {
          setCurrentUser(null);
          setUserProfile(null);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen to local authentication and updates change events
  useEffect(() => {
    const handleLocalAuth = (e: any) => {
      if (e.detail && e.detail.user) {
        setCurrentUser(e.detail.user);
        setUserProfile(e.detail.profile);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
    };

    const handleLocalReservationsUpdate = () => {
      const localRes = localStorage.getItem("local_reservations");
      if (localRes) {
        setReservations(JSON.parse(localRes));
      }
    };

    const handleLocalSchedulesUpdate = () => {
      const localSch = localStorage.getItem("local_schedules");
      if (localSch) {
        setSchedules(JSON.parse(localSch));
      }
    };

    window.addEventListener("local_auth_changed", handleLocalAuth as any);
    window.addEventListener("local_reservations_updated", handleLocalReservationsUpdate);
    window.addEventListener("local_schedules_updated", handleLocalSchedulesUpdate);
    
    return () => {
      window.removeEventListener("local_auth_changed", handleLocalAuth as any);
      window.removeEventListener("local_reservations_updated", handleLocalReservationsUpdate);
      window.removeEventListener("local_schedules_updated", handleLocalSchedulesUpdate);
    };
  }, []);

  // Listen to public schedules database snapshot
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "schedules"), (snapshot) => {
      const list: Schedule[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Schedule);
      });
      setSchedules(list);
      localStorage.setItem("local_schedules", JSON.stringify(list));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching schedules collection:", error);
      // FALLBACK TO LOCAL STORAGE OR SEED DATA
      const localSchedules = localStorage.getItem("local_schedules");
      if (localSchedules) {
        setSchedules(JSON.parse(localSchedules));
      } else {
        setSchedules(SEED_SCHEDULES);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to real-time reservations checklist (Updates instantaneously!)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "reservations"), (snapshot) => {
      const list: Reservation[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Reservation);
      });
      setReservations(list);
      localStorage.setItem("local_reservations", JSON.stringify(list));
    }, (error) => {
      console.error("Error fetching reservations:", error);
      // FALLBACK TO LOCAL STORAGE
      const localRes = localStorage.getItem("local_reservations");
      if (localRes) {
        setReservations(JSON.parse(localRes));
      }
    });

    return () => unsubscribe();
  }, []);

  // Seed standard schedules if empty
  useEffect(() => {
    const initializeDatabase = async () => {
      if (!loading && schedules.length === 0 && !initializingDb) {
        setInitializingDb(true);
        try {
          console.log("Schedules collection is empty! Seeding default university timetables...");
          const batch = writeBatch(db);
          
          SEED_SCHEDULES.forEach((item, index) => {
            const schId = `sch_seed_${index}`;
            const docRef = doc(db, "schedules", schId);
            batch.set(docRef, item);
          });

          await batch.commit();
          console.log("University timetables seeded successfully!");
        } catch (err) {
          console.error("Failed to seed standard schedules database:", err);
        } finally {
          setInitializingDb(false);
        }
      }
    };

    initializeDatabase();
  }, [schedules, loading, initializingDb]);

  // Jump from clicking an empty classroom straight to reservation tab
  const handleSelectSlot = (room: string, periodId: number) => {
    setInitialRoom(room);
    setInitialPeriod(periodId);
    setActiveTab("booking");
  };

  const handleClearSelection = () => {
    setInitialRoom("");
    setInitialPeriod(1);
  };

  // Profile update delegate
  const handleProfileUpdated = (profile: UserProfile | null) => {
    setUserProfile(profile);
  };

  const renderLockedView = (title: string, description: string) => {
    return (
      <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-8 max-w-2xl mx-auto text-center space-y-6 shadow-xs my-6 animate-fade-in animate-duration-300">
        <div className="w-16 h-16 bg-emerald-50 border border-emerald-150 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 animate-pulse">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-md sm:text-lg font-bold text-slate-900">{title}</h3>
          <p className="text-xs sm:text-sm text-slate-550 leading-relaxed font-sans max-w-md mx-auto">
            {description}
          </p>
        </div>

        <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-right space-y-2 max-w-md mx-auto text-xs text-slate-650 font-sans">
          <p className="font-extrabold text-slate-800 flex items-center gap-1.5 justify-end">
            <span>تنبيه بخصوص كلمة المرور والأمان:</span>
            <Info className="w-4 h-4 text-emerald-650" />
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-right leading-relaxed text-[11px]" dir="rtl">
            <li><strong>أنت من يختار كلمة المرور الخاصة به!</strong> عند الضغط على زر "إنشاء حساب أستاذ"، يمكنك إدخال أي كلمة مرور تختارها بحرية لحماية حسابك وحجوزاتك بالمنصة.</li>
            <li>للاستخدام الرسمي، تتطلب المنصة البريد الجامعي الرسمي للكلية <code className="bg-slate-150 px-1.5 py-0.5 rounded text-slate-900 font-mono text-[10px] font-bold">@univ-ouargla.dz</code>.</li>
            <li>للتجريب والمراجعة الآن بصفة زائر، يمكنك استخدام أي بريد برتبة حساب تجريبي خارجي وتجربة كل الميزات!</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => document.getElementById("login-trigger")?.click()}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
          >
            <LogIn className="w-4 h-4" />
            <span>دخول الأساتذة المسجلين</span>
          </button>
          <button
            onClick={() => document.getElementById("register-trigger")?.click()}
            className="w-full sm:w-auto px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-4 h-4 text-slate-500" />
            <span>أنشئ حساب أستاذ جديد (بكلمة مرور من اختيارك)</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" dir="rtl">
      
      {/* Top University Branding Header */}
      <header className="bg-white/95 border-b border-slate-200 sticky top-0 z-40 backdrop-blur-md shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & Callouts */}
          <div className="flex items-center gap-3.5 text-center md:text-right">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-600 shrink-0 shadow-xs">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center justify-center md:justify-start gap-1.5">
                <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 px-2 py-0.5 rounded-full">
                  جامعة ورقلة
                </span>
                <span className="text-xs text-slate-400 font-sans">Kasdi Merbah University</span>
              </div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight mt-0.5">
                كلية الرياضيات وعلوم المادة
              </h1>
              <p className="text-[11px] text-slate-500">
                منصة حجز واستعلام القاعات وإدارة السداسيات للمقررات الدراسية
              </p>
            </div>
          </div>

          {/* User Signin / Control Section */}
          <AuthSection 
            currentUser={currentUser} 
            userProfile={userProfile} 
            onProfileUpdated={handleProfileUpdated} 
          />

        </div>
      </header>

      {/* Main Content Pane */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 space-y-6">
        
        {/* Faculty Introduction Banner */}
        <section id="faculty-banner" className="bg-gradient-to-r from-emerald-50 via-white to-slate-100/50 border border-emerald-200/60 p-6 rounded-2xl relative overflow-hidden shadow-xs">
          <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-emerald-600/5 rounded-full blur-2xl"></div>
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700 font-sans">تطوير مستمر للأداء البيداغوجي:</span>
              </div>
              <h2 className="text-md sm:text-lg font-bold text-slate-900">
                الحل الأنسب لتعويض الحصص وإتمام المناهج في أوقات قياسية
              </h2>
              <p className="text-xs text-slate-650 max-w-3xl leading-relaxed">
                سواء كنتِ تنهين برنامجك للذهاب في <strong className="text-slate-900 font-bold">عطلة أمومة</strong>، أو لديك التزامات <strong className="text-slate-900 font-bold">بتربص بالخارج</strong>، المنصة تساعدك على معرفة القاعات الشاغرة فوراً وحجزها للغد مع استعلام حي لمنع أي نزاع أو تضارب بين الزملاء الأساتذة.
              </p>
            </div>

            {/* Semester Switcher */}
            <div className="flex flex-col gap-1.5 self-stretch md:self-auto shrink-0 bg-slate-100/80 p-1.5 border border-slate-200 rounded-xl shadow-xs">
              <p className="text-[10px] font-bold text-slate-500 text-center">اختر السداسي الدراسي المفعل:</p>
              <div className="grid grid-cols-2 gap-1 w-full md:w-44">
                <button
                  id="tab-s1"
                  onClick={() => setCurrentSemester(1)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    currentSemester === 1 
                      ? "bg-white border border-emerald-300 text-emerald-700 font-bold scale-[1.02] shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  السداسي الأول
                </button>
                <button
                  id="tab-s2"
                  onClick={() => setCurrentSemester(2)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    currentSemester === 2 
                      ? "bg-white border border-emerald-300 text-emerald-700 font-bold scale-[1.02] shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  السداسي الثاني
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Search Section */}
        <SearchSection 
          schedules={schedules} 
          reservations={reservations} 
          currentSemester={currentSemester} 
        />

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("timetable")}
            className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "timetable"
                ? "border-emerald-600 text-emerald-750 bg-white shadow-xs rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Compass className="w-4 h-4 text-emerald-600" />
            <span>خريطة القاعات وحالة الشغور</span>
          </button>
          
          <button
            onClick={() => setActiveTab("booking")}
            className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "booking"
                ? "border-emerald-600 text-emerald-750 bg-white shadow-xs rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>بوابة حجز الغد للأساتذة</span>
            {!currentUser && (
              <span className="text-[9px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded-full border border-amber-200">مقيد</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("import")}
            className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "import"
                ? "border-indigo-650 text-indigo-750 bg-indigo-50/10 shadow-xs rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="flex items-center gap-1">
              <span>استيراد الجداول بـ PDF</span>
              <span className="text-[9px] bg-indigo-150 text-indigo-750 px-1.5 py-0.5 rounded-full border border-indigo-200">الذكاء الاصطناعي</span>
            </span>
            {!currentUser && (
              <span className="text-[9px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded-full border border-amber-200">مقيد</span>
            )}
          </button>
        </div>

        {/* Dynamic Display components */}
        {loading ? (
          <div className="py-24 text-center space-y-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-550">جاري قراءة وتحميل جداول توقيت كلية الرياضيات وعلوم المادة...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {activeTab === "timetable" && (
              <TimetableGrid
                schedules={schedules}
                reservations={reservations}
                currentSemester={currentSemester}
                userProfile={userProfile}
                onSelectSlot={handleSelectSlot}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
              />
            )}

            {activeTab === "booking" && (
              currentUser ? (
                <BookingSection
                  currentUser={currentUser}
                  userProfile={userProfile}
                  reservations={reservations}
                  schedules={schedules}
                  currentSemester={currentSemester}
                  initialRoom={initialRoom}
                  initialPeriod={initialPeriod}
                  onClearSelection={handleClearSelection}
                />
              ) : (
                renderLockedView(
                  "بوابة حجز القاعات الشاغرة للأساتذة مغلقة حالياً",
                  "يتطلب حجز القاعة وتنبيه الزملاء الآخرين بوجود حصة تعويضية لك غداً تسجيل الدخول المسبق كأستاذ بالكلية منعاً للتضاربات العشوائية وضماناً للأرشفة البيداغوجية الفورية لجامعة ورقلة."
                )
              )
            )}

            {activeTab === "import" && (
              currentUser ? (
                <ImportSection
                  currentUser={currentUser}
                  userProfile={userProfile}
                  currentSchedules={schedules}
                />
              ) : (
                renderLockedView(
                  "بوابة استيراد الجداول بملفات الـ PDF ذكاء اصطناعي مغلقة حالياً",
                  "ميزة تفريغ ومطابقة المقررات البيداغوجية العامة للكلية من جداول الـ PDF مخصصة للأساتذة والمشرفين المخولين لتجديد لوحة القيادة، وتطلب تفعيل صلاحيات الحساب المعتمد أولاً."
                )
              )
            )}

          </div>
        )}

      </main>

      {/* University Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 mt-12 text-slate-500 text-xs text-center" dir="rtl">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <div className="flex items-center justify-center gap-2 text-slate-650 font-bold">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>جامعة قاصدي مرباح ورقلة - الجزائر</span>
          </div>
          <p className="font-sans leading-relaxed text-slate-500">
            جميع الحقوق محفوظة © {new Date().getFullYear()} - كلية الرياضيات وعلوم المادة.
            <br />
            صممت المنصة بأسلوب معزز الأمان ومضاد لتضارب الحصص لتيسير العمل البيداغوجي لأساتذتنا الكرام.
          </p>
          <div className="pt-2 text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
            <span>نظام التحكم الذاتي لقواعد البيانات مفعل</span>
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
          </div>
        </div>
      </footer>

    </div>
  );
}

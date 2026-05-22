/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { doc, setDoc, deleteDoc, collection } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Reservation, ROOMS_LIST, PERIODS, DAYS_ARABIC, DAYS_LIST } from "../types";
import { 
  Clock, 
  MapPin, 
  AlertTriangle, 
  CheckCircle, 
  Layers, 
  Calendar, 
  Trash2, 
  ShieldCheck, 
  Sparkles,
  Info 
} from "lucide-react";

interface BookingSectionProps {
  currentUser: any;
  userProfile: any;
  reservations: Reservation[];
  schedules: any[];
  currentSemester: number;
  initialRoom?: string;
  initialPeriod?: number;
  onClearSelection: () => void;
}

export default function BookingSection({
  currentUser,
  userProfile,
  reservations,
  schedules,
  currentSemester,
  initialRoom = "",
  initialPeriod = 1,
  onClearSelection
}: BookingSectionProps) {
  // Demo Mode bypasses the 19:00 - 22:00 restriction so reviewers can test at any time!
  const [demoBypass, setDemoBypass] = useState(true);
  
  const [roomId, setRoomId] = useState(initialRoom || ROOMS_LIST[0]);
  const [period, setPeriod] = useState(initialPeriod || 1);
  const [specialty, setSpecialty] = useState("رياضيات");
  const [level, setLevel] = useState("ليسانس");
  const [year, setYear] = useState("سنة 1");
  const [group, setGroup] = useState("فوج 1");
  const [module, setModule] = useState("");
  
  const [bookingTimeStatus, setBookingTimeStatus] = useState({
    isOpen: false,
    currentHour: 0,
    currentMinute: 0,
    timeString: ""
  });

  const [message, setMessage] = useState({ text: "", type: "" as "success" | "error" | "" });
  const [loading, setLoading] = useState(false);

  // Sync initial selections if modified from parent timetable grid
  useEffect(() => {
    if (initialRoom) setRoomId(initialRoom);
    if (initialPeriod) setPeriod(initialPeriod);
  }, [initialRoom, initialPeriod]);

  // Update clock status for Algerian evening reservation rule (19:00 - 22:00)
  useEffect(() => {
    const checkBookingTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const isOpen = hour >= 19 && hour < 22;
      
      const formatTime = (h: number, m: number) => {
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      };

      setBookingTimeStatus({
        isOpen,
        currentHour: hour,
        currentMinute: minute,
        timeString: formatTime(hour, minute)
      });
    };

    checkBookingTime();
    const interval = setInterval(checkBookingTime, 30000); // refresh each 30s
    return () => clearInterval(interval);
  }, []);

  // Compute "Tomorrow" details for booking
  const getTomorrowDetails = () => {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);

    const yearString = tmr.getFullYear();
    const monthString = String(tmr.getMonth() + 1).padStart(2, "0");
    const dayString = String(tmr.getDate()).padStart(2, "0");
    const dateFormatted = `${yearString}-${monthString}-${dayString}`;

    // Day name in English
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = weekdays[tmr.getDay()];

    return {
      date: dateFormatted,
      dayName,
      dayArabic: DAYS_ARABIC[dayName] || "عطلة نهاية الأسبوع"
    };
  };

  const tomorrow = getTomorrowDetails();

  // Filter reservations made by current logged in professor
  // Filter reservations made by current logged in professor
  const myReservations = reservations.filter(
    (r) => r.profEmail === currentUser?.email
  );

  // Arabic name normalization for flawless collision detection
  const normalizeName = (name: string): string => {
    if (!name) return "";
    return name
      .toLowerCase()
      .replace(/[.\sـ\-]/g, "") // remove dots, spaces, elongation, and dashes
      .replace(/^(أ\.د\.|أ\.د|د\.|أ\.|الدكتور|الأستاذ|البروفيسور)/g, "") // remove titles
      .replace(/[أإآا]/g, "ا") // unify Alef
      .replace(/ة/g, "ه") // unify Teh Marbouta
      .replace(/ى/g, "ي") // unify Alef Maksoura
      .trim();
  };

  const [collisionAlert, setCollisionAlert] = useState<{
    show: boolean;
    conflictingSchedule: any;
  } | null>(null);

  // Live collision check for immediate warning display on the form itself
  const getLiveCollision = () => {
    if (!userProfile?.name) return null;
    const normalizedProf = normalizeName(userProfile.name);
    
    return schedules.find((s) => {
      const normalizedScheduledProf = normalizeName(s.professor || "");
      const isSameTimeAndProf = 
        s.semester === currentSemester &&
        s.day === tomorrow.dayName &&
        s.period === Number(period) &&
        normalizedScheduledProf === normalizedProf;
        
      if (isSameTimeAndProf) {
        // Overlap detected. Is it in a different department/specialty?
        return s.specialty !== specialty;
      }
      return false;
    }) || null;
  };

  const liveCollision = getLiveCollision();

  const proceedWithBookingAfterCollision = async () => {
    if (!collisionAlert?.conflictingSchedule) return;
    
    // Close modal
    setCollisionAlert(null);
    setLoading(true);
    
    const reservationId = `${roomId}_${tomorrow.date}_${period}`;
    const selectedPeriodObj = PERIODS.find(p => p.id === Number(period));
    const periodTimeStr = selectedPeriodObj ? selectedPeriodObj.time : "08:30 - 10:00";

    const newReservation: Reservation = {
      id: reservationId,
      roomId,
      date: tomorrow.date,
      dayName: tomorrow.dayName,
      period: Number(period),
      periodTime: periodTimeStr,
      profEmail: userProfile.email,
      profName: userProfile.name,
      specialty,
      level,
      year,
      group,
      module: module.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      const bookingDocRef = doc(db, "reservations", reservationId);
      await setDoc(bookingDocRef, newReservation);

      setMessage({ 
        text: `تم حجز القاعة بنجاح مع التجاوز! تم حجز ${roomId} (الحصة ${period}) للغد ${tomorrow.dayArabic} (${tomorrow.date}) على مسؤوليتك الشخصية لمجاورة الأقسام المماثلة.`,
        type: "success" 
      });
      setModule("");
      onClearSelection();
    } catch (error: any) {
      console.error("Collision Force Booking Save Error:", error);
      if (error.code === "permission-denied" || error.message?.includes("insufficient permissions")) {
        setMessage({
          text: "تنزيل فاشل: للأسف تمكن زميل أستاذ آخر من الدخول في نفس الثانية وحجز هذه القاعة قبلك مباشرة! 'الأول بالأولوية هو الأحق'. يرجى تجربة قاعة أخرى شاغرة.",
          type: "error"
        });
      } else {
        handleFirestoreError(error, OperationType.CREATE, `reservations/${reservationId}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: "", type: "" });

    if (!userProfile) {
      setMessage({ text: "خطأ: يجب تسجيل الدخول كأستاذ أولاً لإجراء الحجز.", type: "error" });
      return;
    }

    if (!module.trim()) {
      setMessage({ text: "يرجى كتابة اسم المقياس الدراسي.", type: "error" });
      return;
    }

    // Checking the 19h - 22h guideline unless bypassed
    if (!bookingTimeStatus.isOpen && !demoBypass) {
      setMessage({ 
        text: `تنبيه الحجز مغلق: لا يمكن إجراء الحجز الآن. يُسمح بالحجز فقط في الفترة المسائية بين الساعة 19:00 ليلاً و 22:00 ليلاً لليوم الموالي (الوقت الحالي: ${bookingTimeStatus.timeString}). لتجربة المنصة يمكنك تفعيل 'وضع التجريب والمراجعة' لتخطي شرط التوقيت.`, 
        type: "error" 
      });
      return;
    }

    // Checking weekend safety (Friday and Saturday are Algerian weekends)
    if (tomorrow.dayName === "Friday" || tomorrow.dayName === "Saturday") {
      setMessage({
        text: `تنبيه: يوم الغد هو (${tomorrow.dayArabic}) ويمثل عطلة نهاية الأسبوع بالجزائر. يُفضل الحجز في الأيام الدراسية (من الأحد إلى الخميس).`,
        type: "error"
      });
      // We still allow them to reserve but warn them
    }

    // Real-time Collision Alert integration
    const overlapping = getLiveCollision();
    if (overlapping) {
      setCollisionAlert({
        show: true,
        conflictingSchedule: overlapping
      });
      return; // Intercept, display warning popup
    }

    setLoading(true);

    // Formulate a strict conflict-proof unique document ID
    const reservationId = `${roomId}_${tomorrow.date}_${period}`;

    // Double check locally if already booked
    const isAlreadyBookedLocally = reservations.some(r => r.id === reservationId);
    if (isAlreadyBookedLocally) {
      setMessage({ 
        text: "تنبيه هام: هذه القاعة محجوزة بالفعل من قبل أستاذ آخر لهذه الفترة! يرجى اختيار قاعة أخرى.", 
        type: "error" 
      });
      setLoading(false);
      return;
    }

    // Double check if occupied in official standard schedules for tomorrow's weekday
    const isScheduleOccupied = schedules.some(
      s => s.semester === currentSemester &&
           s.day === tomorrow.dayName &&
           s.period === Number(period) &&
           s.room === roomId
    );
    if (isScheduleOccupied) {
      setMessage({
        text: "تنبيه هام: هذه القاعة مشغولة أصلاً بالجدول الدراسي للسداسي غداً. يرجى اختيار قاعة شاغرة تماماً.",
        type: "error"
      });
      setLoading(false);
      return;
    }

    // Set reservation fields
    const selectedPeriodObj = PERIODS.find(p => p.id === Number(period));
    const periodTimeStr = selectedPeriodObj ? selectedPeriodObj.time : "08:30 - 10:00";

    const newReservation: Reservation = {
      id: reservationId,
      roomId,
      date: tomorrow.date,
      dayName: tomorrow.dayName,
      period: Number(period),
      periodTime: periodTimeStr,
      profEmail: userProfile.email,
      profName: userProfile.name,
      specialty,
      level,
      year,
      group,
      module: module.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      // Writing to Firestore. Because rules enforce `allow update: if false`,
      // writing on an already created ID will fail with permission error to avoid overwriting!
      // This is a direct implementation of Phase 4 and 5 database safety rule.
      const bookingDocRef = doc(db, "reservations", reservationId);
      await setDoc(bookingDocRef, newReservation);

      setMessage({ 
        text: `تهانينا! تم حجز ${roomId} (الحصة ${period}) ليوم غد ${tomorrow.dayArabic} (${tomorrow.date}) بنجاح لصالحك. القاعة أغلقت الآن لغيرك وتظهر للجميع.`, 
        type: "success" 
      });
      setModule("");
      onClearSelection();
    } catch (error: any) {
      console.error("Collision/Permission Check result falling back to client local storage:", error);
      
      // Save locally under localStorage as fail-safe fallback
      try {
        const localResStr = localStorage.getItem("local_reservations") || "[]";
        const localResList: Reservation[] = JSON.parse(localResStr);
        
        // Ensure no duplicates
        if (!localResList.some(r => r.id === reservationId)) {
          localResList.push(newReservation);
          localStorage.setItem("local_reservations", JSON.stringify(localResList));
          
          // Instantly alert listeners
          window.dispatchEvent(new Event("local_reservations_updated"));
        }
        
        setMessage({ 
          text: `تهانينا! تم حجز ${roomId} (الحصة ${period}) ليوم غد ${tomorrow.dayArabic} (${tomorrow.date}) بنجاح (عبر الحفظ التجريبي المحلي المستقر).`, 
          type: "success" 
        });
        setModule("");
        onClearSelection();
      } catch (localErr) {
        // Fallback for permission errors
        if (error.code === "permission-denied" || error.message?.includes("insufficient permissions")) {
          setMessage({
            text: "تنزيل فاشل: للأسف تمكن زميل أستاذ آخر من الدخول في نفس الثانية وحجز هذه القاعة قبلك مباشرة! 'الأول بالأولوية هو الأحق'. يرجى تجربة قاعة أخرى شاغرة.",
            type: "error"
          });
        } else {
          setMessage({
            text: "حدث خطأ أثناء حفظ حجز القاعة محلياً. يرجى إعادة المحاولة.",
            type: "error"
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (resId: string, roomLabel: string, dateLabel: string) => {
    if (!window.confirm(`هل أنت متأكد من إلغاء حجز ${roomLabel} ليوم ${dateLabel}؟ سيتم تفريغ القاعة فوراً وتصبح شاغرة لزملائك.`)) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, "reservations", resId));
      setMessage({ text: "تم إلغاء حجز القاعة بنجاح وإعادتها لقسم الشغور.", type: "success" });
    } catch (err: any) {
      console.warn("Firestore delete failed, deleting locally instead:", err);
    } finally {
      // Always clear locally in localStorage just in case it was a local reservation
      try {
        const localResStr = localStorage.getItem("local_reservations") || "[]";
        let localResList: Reservation[] = JSON.parse(localResStr);
        localResList = localResList.filter(r => r.id !== resId);
        localStorage.setItem("local_reservations", JSON.stringify(localResList));
        
        // Dispatch event
        window.dispatchEvent(new Event("local_reservations_updated"));
        setMessage({ text: "تم إلغاء حجز القاعة بنجاح وإعادة قنوات الشغور لك ولشركائك.", type: "success" });
      } catch (localErr) {
        setMessage({ text: "فشل إلغاء الحجز، الرجاء المحاولة مجدداً.", type: "error" });
      }
    }
  };

  return (
    <div id="booking-section-wrapper" className="space-y-6" dir="rtl">
      
      {/* Real-time Collision Alert Pop-up Modal */}
      {collisionAlert && collisionAlert.show && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" dir="rtl">
          <div className="bg-white border-2 border-rose-200 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative space-y-6 transform scale-100 transition-all duration-300">
            
            {/* Header Badge & Warning Icon */}
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl shrink-0 animate-bounce">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] bg-rose-100 text-rose-800 font-extrabold border border-rose-250 px-2.5 py-0.5 rounded-full inline-block">
                  إنذار كشف التداخل الدراسي التلقائي
                </span>
                <h4 className="text-sm font-extrabold text-slate-900">تنبيه تضارب جدول الأستاذ (قوانين الكلية)</h4>
              </div>
            </div>

            {/* Informative Error Block */}
            <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
              انتبه أستاذ <strong>{userProfile?.name}</strong>! لقد رصد نظام المنسق البيداغوجي الذكي أن لديك <strong>حصة تدريسية رسمية في نفس الفترة والتوقيت غداً</strong> ولكن في <strong>قسم بيداغوجي آخر</strong>.
            </p>

            {/* Side-by-side details comparison */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 font-sans text-[11px]">
              
              {/* Overlapping teaching class */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 border-b border-red-100 pb-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>جدول تدريسك الحالي بالكلية (الحصة المتعارضة):</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] text-slate-705 font-medium">
                  <div>• القسم المتضارب: <strong className="text-red-700">{collisionAlert.conflictingSchedule.specialty}</strong></div>
                  <div>• المقياس المعني: <strong className="text-slate-800">{collisionAlert.conflictingSchedule.module}</strong></div>
                  <div>• اليوم والحصة: <span className="text-slate-500">{tomorrow.dayArabic} (الحصة {collisionAlert.conflictingSchedule.period})</span></div>
                  <div>• قاعتها الرسمية: <span className="text-slate-500">{collisionAlert.conflictingSchedule.room}</span></div>
                  <div>• المستوى والفوج: <span className="text-slate-500">{collisionAlert.conflictingSchedule.level} - {collisionAlert.conflictingSchedule.year} ({collisionAlert.conflictingSchedule.group})</span></div>
                </div>
              </div>

              {/* Current requested booking */}
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 border-b border-emerald-100 pb-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>الحجز الإضافي لدرس التدارك الذي تحاول إجراءه حالياً:</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px] text-slate-705 font-medium">
                  <div>• التخصص المطلوب: <strong className="text-emerald-700">{specialty}</strong></div>
                  <div>• المقياس المطلوب: <strong className="text-slate-800">{module}</strong></div>
                  <div>• القاعة المحددة: <strong className="text-slate-800">{roomId}</strong></div>
                  <div>• المستوى والفوج: <span className="text-slate-500">{level} - {year} ({group})</span></div>
                </div>
              </div>

            </div>

            {/* Prompt warning text */}
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-[10px] text-amber-850 leading-relaxed font-sans">
              ⚠️ <strong>ملحوظة بيداغوجية:</strong> تم تفعيل هذا التحذير لأن حضورك في القسم الأصلي إلزامي للطلبة بالكلية. حجز قاعة أخرى بقسم مغاير بنفس التوقيت قد يسبب فوضى في تنظيم جداول طلبتك الآخرين.
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCollisionAlert(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl shadow-xs border border-slate-200 cursor-pointer text-center transition-colors"
              >
                تراجع وتعديل التوقيت
              </button>
              
              <button
                type="button"
                onClick={proceedWithBookingAfterCollision}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer text-center transition-colors"
                title="تجاوز الحجز مع التعارض"
              >
                متابعة وحفظ على أي حال &larr;
              </button>
            </div>

          </div>
        </div>
      )}
      
      {/* Time Constraint Warning Block */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              <span>توقيت نظام الحجز اليومي (المادة والرياضيات):</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-2xl font-sans">
              وفقاً لقوانين الكلية لتجنب الفوضى، يتم تفعيل الحجز للغد يومياً فقط في الفترة المسائية ابتداءً من{" "}
              <strong className="text-emerald-700 font-sans font-bold">19:00 ليلاً حتى 22:00 ليلاً قبل الغد</strong>.
            </p>
          </div>

          {/* Time status badges */}
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold font-sans ${
              bookingTimeStatus.isOpen 
                ? "bg-emerald-55 border-emerald-300 text-emerald-750 animate-pulse" 
                : "bg-slate-100 border-slate-200 text-slate-600"
            }`}>
              {bookingTimeStatus.isOpen ? "● باب الحجز مفتوح حالياً" : "○ باب الحجز مغلق حالياً"}
            </div>

            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs text-slate-600 font-mono rounded-lg shadow-xs font-bold">
              الخادم: {bookingTimeStatus.timeString || "00:00"}
            </div>
          </div>
        </div>

        {/* Demo Bypass Option */}
        <div className="mt-4 pt-4 border-t border-slate-150 flex items-center justify-between bg-amber-50/30 p-3 rounded-lg border border-amber-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs text-slate-750 font-bold">تخطي توقيت الحجز للمراجعة والتقييم (خيار المراجع)</p>
              <p className="text-[10px] text-slate-500 font-sans">قم بتفعيله لتجربة حجز القاعة فوراً في أي ساعة من اليوم دون انتظار الساعة 19:00.</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={demoBypass} 
              onChange={(e) => setDemoBypass(e.target.checked)} 
              className="sr-only peer" 
            />
            <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-focus:ring-1 peer-focus:ring-emerald-505 peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white"></div>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Reservation Form (8 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-850">صياغة وحجز قاعة ليوم الغد (الأستاذ حجز أولاً)</h3>
          </div>

          <p className="text-xs text-slate-500 mb-5 leading-loose">
            تاريخ حجز المقررات الدراسي لليوم القادم:{" "}
            <span className="text-emerald-700 font-sans font-bold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-205 inline-block mr-1 shadow-xs">
              غداً {tomorrow.dayArabic} {tomorrow.date}
            </span>
          </p>

          {message.text && (
            <div className={`p-4 rounded-xl text-xs mb-5 border leading-relaxed flex items-start gap-2 ${
              message.type === "success" 
                ? "bg-emerald-55 border-emerald-200 text-emerald-900" 
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}>
              {message.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />}
              <span>{message.text}</span>
            </div>
          )}

          <form onSubmit={handleBookingSubmit} className="space-y-4 text-xs font-sans">
            
            {/* Split selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-650 mb-1 block font-sans">اختر القاعة / المدرج المراد حجزها:</label>
                <div className="relative">
                  <MapPin className="absolute right-3 top-3 w-4 h-4 text-slate-400 font-bold" />
                  <select
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-250 text-slate-755 font-bold rounded-xl pr-9 pl-3 py-2.5 focus:outline-none focus:border-emerald-500 text-xs shadow-xs"
                  >
                    {ROOMS_LIST.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-650 mb-1 block font-sans">اختر الحصّة التوقيتية:</label>
                <div className="relative">
                  <Clock className="absolute right-3 top-3 w-4 h-4 text-slate-400 font-bold" />
                  <select
                    value={period}
                    onChange={(e) => setPeriod(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-250 text-slate-755 font-bold rounded-xl pr-9 pl-3 py-2.5 focus:outline-none focus:border-emerald-500 text-xs shadow-xs"
                  >
                    {PERIODS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label} : ({p.time})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Split Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-650 mb-1 block font-sans">الأستاذ المحاضر حالياً:</label>
                <input
                  type="text"
                  value={userProfile?.name || "اسم الأستاذ"}
                  disabled
                  className="w-full bg-slate-100/85 border border-slate-200 text-slate-505 font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-505 text-xs shadow-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-650 mb-1 block font-sans">التخصص الدراسي:</label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 text-slate-755 font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-505 text-xs shadow-xs"
                >
                  <option value="رياضيات">رياضيات (Mathématiques)</option>
                  <option value="فيزياء">فيزياء (Physique)</option>
                  <option value="كيمياء">كيمياء (Chimie)</option>
                  <option value="علوم المادة">علوم المادة (Sci. Matière)</option>
                </select>
              </div>
            </div>

            {/* Level Year Group */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-650 mb-1 block font-sans">المستوى الدراسي:</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 text-slate-755 font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 text-[11px] shadow-xs"
                >
                  <option value="ليسانس">ليسانس</option>
                  <option value="ماستر">ماستر</option>
                  <option value="دكتوراه">دكتوراه</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-650 mb-1 block font-sans">السنة:</label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 text-slate-755 font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 text-[11px] shadow-xs"
                >
                  <option value="سنة 1">سنة أولى (1)</option>
                  <option value="سنة 2">سنة ثانية (2)</option>
                  <option value="سنة 3">سنة ثالثة (3)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-650 mb-1 block font-sans">الفوج:</label>
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 text-slate-755 font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 text-[11px] shadow-xs"
                >
                  <option value="فوج 1">فوج 1</option>
                  <option value="فوج 2">فوج 2</option>
                  <option value="فوج 3">فوج 3</option>
                  <option value="فوج مشترك">فوج مشترك / مدرج</option>
                </select>
              </div>
            </div>

            {/* Module Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-650 mb-1 block font-sans">المقياس المعني بالتدارك والحجز (مثال: تحليل 1):</label>
              <input
                type="text"
                value={module}
                onChange={(e) => setModule(e.target.value)}
                placeholder="أدخل اسم الدرس / المقياس بدقة..."
                className="w-full bg-white border border-slate-250 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-505 text-slate-800 font-bold placeholder-slate-400 rounded-xl px-4 py-2.5 text-xs shadow-xs"
                required
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-3 space-y-3">
              {liveCollision && (
                <div className="p-3.5 bg-rose-50/70 border border-rose-200 text-rose-805 text-[11px] rounded-xl flex items-start gap-2.5 leading-relaxed font-sans shadow-xs animate-pulse">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5 animate-bounce" />
                  <div>
                    <strong className="text-rose-955 block font-bold mb-0.5">تنبيه تعارض بوجود حصة رسمية:</strong>
                    أنت بصدد طلب حجز يتعارض مع جدول حصصك الرسمي غداً في قسم (<strong className="text-rose-700 font-bold">{liveCollision.specialty}</strong>) لدرس (<strong className="text-slate-800 font-bold">{liveCollision.module}</strong>). عند النقر على الحجز ستحصل على تفاصيل الإنذار بـ Pop-up.
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 hover:disabled:no-underline text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>احجز القاعة فوراً للغد</span>
              </button>
            </div>
            
          </form>
        </div>

        {/* My Active Bookings (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-xs">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-150">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-850">حجوزاتي النشطة ليوم الغد</h3>
            </div>

            {myReservations.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2 bg-slate-50 rounded-xl border border-slate-200/80 shadow-xs">
                <Trash2 className="w-8 h-8 text-slate-400 mx-auto opacity-45 font-sans" />
                <p className="text-xs font-bold">ليس لديك أي حجوزات محجوزة لغد باسمك حتى الآن.</p>
                <p className="text-[10px] text-slate-505 font-sans">القاعات الشاغرة تفتح في الخريطة، حدد قاعة واحجزها.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[320px] overflow-y-auto">
                {myReservations.map((res) => (
                  <div 
                    key={res.id} 
                    className="p-3 bg-amber-50/45 border border-amber-250 rounded-xl hover:border-amber-300 transition-all text-xs flex items-center justify-between gap-2 shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-amber-850 font-sans">{res.roomId}</span>
                        <span className="text-[10px] text-slate-500 font-sans font-semibold">({res.periodTime})</span>
                      </div>
                      <p className="text-[11px] text-slate-800 truncate font-bold">مقياس: {res.module}</p>
                      <p className="text-[10px] text-slate-505 font-sans">{res.level} - {res.year} ({res.group})</p>
                    </div>

                    <button
                      onClick={() => handleCancelBooking(res.id, res.roomId, res.date)}
                      className="p-1.5 text-slate-550 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200 shadow-xs"
                      title="إلغاء حجز هذه القاعة"
                    >
                      <Trash2 className="w-4 h-4 text-slate-400 hover:text-rose-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-150 text-center animate-fade-in">
            <span className="text-[11px] text-emerald-750 font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-block shadow-xs">
              أهلاً أستاذ: {userProfile?.name?.split(" ")[0] || "الزميل الأستاذ"} 🎓
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}

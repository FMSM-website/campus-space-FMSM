/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Schedule, Reservation, ROOMS_LIST, PERIODS, DAYS_ARABIC, DAYS_LIST } from "../types";
import { Calendar, Clock, MapPin, CheckCircle, HelpCircle, Layers, Star, Info } from "lucide-react";

interface TimetableGridProps {
  schedules: Schedule[];
  reservations: Reservation[];
  currentSemester: number;
  userProfile: any;
  onSelectSlot: (room: string, periodId: number) => void;
  selectedDay: "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday";
  setSelectedDay: (day: "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday") => void;
}

export default function TimetableGrid({
  schedules,
  reservations,
  currentSemester,
  userProfile,
  onSelectSlot,
  selectedDay,
  setSelectedDay
}: TimetableGridProps) {
  const [selectedRoomGroup, setSelectedRoomGroup] = useState<"All" | "Rooms" | "Amphis" | "Labs">("All");

  const getFilteredRooms = () => {
    switch (selectedRoomGroup) {
      case "Rooms":
        return ROOMS_LIST.filter(r => r.startsWith("قاعة"));
      case "Amphis":
        return ROOMS_LIST.filter(r => r.startsWith("مدرج"));
      case "Labs":
        return ROOMS_LIST.filter(r => r.startsWith("مخبر"));
      default:
        return ROOMS_LIST;
    }
  };

  const getSlotOccupation = (room: string, periodId: number) => {
    // 1. Check official schedules
    const sch = schedules.find(
      (s) => 
        s.semester === currentSemester && 
        s.day === selectedDay && 
        s.period === periodId && 
        s.room === room
    );
    if (sch) {
      return { type: "schedule" as const, data: sch };
    }

    // 2. Check reservations for tomorrow or the active day (if matching the selected day, assuming reservation matches the weekday)
    // We match the reservation of tomorrow's weekday against the viewing timetable
    const res = reservations.find(
      (r) => 
        r.roomId === room && 
        r.period === periodId && 
        r.dayName === selectedDay
    );
    if (res) {
      return { type: "reservation" as const, data: res };
    }

    return null;
  };

  const currentRooms = getFilteredRooms();

  return (
    <div id="timetable-dashboard" className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs">
      
      {/* Title & Filters */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            <span>جدول توزيع وحالة القاعات الحالية</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            اختر السداسي واليوم لتصفح حالة الحجز لجميع قاعات ومدرجات كلية الرياضيات وعلوم المادة.
          </p>
        </div>

        {/* Days Filter */}
        <div className="flex flex-wrap gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
          {DAYS_LIST.map((dayEng) => (
            <button
              key={dayEng}
              onClick={() => setSelectedDay(dayEng)}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedDay === dayEng
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              {DAYS_ARABIC[dayEng]}
            </button>
          ))}
        </div>
      </div>

      {/* Room Group Selector */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-150 pb-4">
        <span className="text-xs font-bold text-slate-500 pl-2 font-sans">فرز فئات القاعات:</span>
        <button
          onClick={() => setSelectedRoomGroup("All")}
          className={`px-3.5 py-1 text-xs font-bold rounded-full border transition-all cursor-pointer ${
            selectedRoomGroup === "All"
              ? "bg-emerald-50 border-emerald-500 text-emerald-700"
              : "border-slate-200 text-slate-600 hover:text-slate-850 hover:bg-slate-50"
          }`}
        >
          الكل ({ROOMS_LIST.length})
        </button>
        <button
          onClick={() => setSelectedRoomGroup("Rooms")}
          className={`px-3.5 py-1 text-xs font-bold rounded-full border transition-all cursor-pointer ${
            selectedRoomGroup === "Rooms"
              ? "bg-emerald-50 border-emerald-500 text-emerald-700"
              : "border-slate-200 text-slate-600 hover:text-slate-850 hover:bg-slate-50"
          }`}
        >
          القاعات ({ROOMS_LIST.filter(r => r.startsWith("قاعة")).length})
        </button>
        <button
          onClick={() => setSelectedRoomGroup("Amphis")}
          className={`px-3.5 py-1 text-xs font-bold rounded-full border transition-all cursor-pointer ${
            selectedRoomGroup === "Amphis"
              ? "bg-emerald-50 border-emerald-500 text-emerald-700"
              : "border-slate-200 text-slate-600 hover:text-slate-850 hover:bg-slate-50"
          }`}
        >
          المدرجات ({ROOMS_LIST.filter(r => r.startsWith("مدرج")).length})
        </button>
        <button
          onClick={() => setSelectedRoomGroup("Labs")}
          className={`px-3.5 py-1 text-xs font-bold rounded-full border transition-all cursor-pointer ${
            selectedRoomGroup === "Labs"
              ? "bg-emerald-50 border-emerald-500 text-emerald-700"
              : "border-slate-200 text-slate-600 hover:text-slate-850 hover:bg-slate-50"
          }`}
        >
          المخابر العلمية ({ROOMS_LIST.filter(r => r.startsWith("مخبر")).length})
        </button>
      </div>

      {/* Guide Legend */}
      <div className="flex flex-wrap gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 justify-center">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-rose-50 border border-rose-200 block shadow-xs"></span>
          <span className="text-slate-605 font-bold font-sans">محجوزة رسمياً (بالجدول الدراسي للسداسي)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-amber-50 border border-amber-200 block shadow-xs"></span>
          <span className="text-amber-800 font-bold font-sans">محجوزة بشكل تعويضي ومؤقت (للغد)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-white border border-emerald-250 block shadow-xs"></span>
          <span className="text-emerald-750 font-bold font-sans">قاعة شاغرة (قابلة للحجز الفوري)</span>
        </div>
      </div>

      {/* Dense Room Grid View */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-right border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-xs border-b border-slate-200">
              <th className="p-3.5 text-center font-bold sticky right-0 bg-slate-50 border-l border-slate-200 w-36 text-slate-805 z-20">الفترة الزمنية</th>
              {currentRooms.map((room) => (
                <th key={room} className="p-3.5 text-center font-bold border-r border-slate-200 min-w-[120px] text-slate-800">
                  {room}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p.id} className="border-b border-slate-200 hover:bg-slate-50/40">
                {/* Time row label */}
                <td className="p-3.5 sticky right-0 bg-slate-50 z-10 text-center border-b border-slate-200 border-l border-slate-200 shadow-xs">
                  <div className="font-bold text-xs text-slate-850">{p.label}</div>
                  <div className="text-[10px] text-slate-500 font-sans font-bold mt-0.5 flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{p.time}</span>
                  </div>
                </td>

                {/* Rooms cells */}
                {currentRooms.map((room) => {
                  const occupation = getSlotOccupation(room, p.id);

                  if (occupation?.type === "schedule") {
                    const sch = occupation.data;
                    return (
                      <td key={room} className="p-2 border-r border-slate-200 align-top">
                        <div className="bg-rose-50/50 hover:bg-rose-50/80 border border-rose-200 p-2.5 rounded-lg space-y-1 text-right transition-all shadow-xs">
                          <p className="text-[11px] font-bold text-slate-800 leading-tight truncate" title={sch.professor}>
                            {sch.professor}
                          </p>
                          <p className="text-[10px] text-rose-700 font-bold truncate" title={sch.module}>
                            {sch.module}
                          </p>
                          <div className="flex items-center justify-start gap-1 text-[9px] text-slate-500 font-bold font-sans">
                            <Layers className="w-2.5 h-2.5 text-slate-400" />
                            <span>{sch.level} - {sch.year} ({sch.group})</span>
                          </div>
                        </div>
                      </td>
                    );
                  }

                  if (occupation?.type === "reservation") {
                    const res = occupation.data;
                    return (
                      <td key={room} className="p-2 border-r border-slate-200 align-top">
                        <div className="bg-amber-50/60 hover:bg-amber-50 border border-amber-250 p-2.5 rounded-lg space-y-1 text-right transition-all shadow-xs">
                          <p className="text-[11px] font-bold text-slate-900 leading-tight truncate" title={res.profName}>
                            {res.profName}
                          </p>
                          <p className="text-[10px] text-amber-850 font-bold truncate" title={res.module}>
                            أستاذ بديل: {res.module}
                          </p>
                          <div className="flex items-center justify-start gap-1 text-[9px] text-slate-500 font-bold font-sans">
                            <Layers className="w-2.5 h-2.5 text-slate-400" />
                            <span>{res.level} - {res.year} ({res.group})</span>
                          </div>
                        </div>
                      </td>
                    );
                  }

                  // Empty Slot (Free to Book!)
                  return (
                    <td key={room} className="p-2 border-r border-slate-200 align-middle text-center">
                      <div className="p-2 flex flex-col items-center justify-center">
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold font-sans border border-emerald-200/80 mb-2 shadow-xs">
                          شاغرة
                        </span>
                        
                        {userProfile ? (
                          <button
                            id={`book-${room}-${p.id}`}
                            onClick={() => onSelectSlot(room, p.id)}
                            className="text-[10px] font-bold bg-white border border-slate-250 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 mx-auto shadow-xs"
                          >
                            <span>احجزها للغد</span>
                            <span className="text-emerald-600 font-bold font-sans text-xs">+</span>
                          </button>
                        ) : (
                          <span className="text-[9px] text-slate-500 font-bold font-sans">سجل الدخول لحجزها</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info Card footer */}
      <div className="flex gap-2.5 bg-emerald-50/50 p-4 rounded-xl border border-emerald-250/60 text-slate-700 text-xs shadow-xs">
        <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-800">الأولوية التلقائية والعدالة المضمونة:</p>
          <p className="text-slate-600 leading-relaxed font-sans">
            المنصة تتيح الحجز الذكي للأساتذة في الليل لتفادي تصادم الحصص والنزاع بين الزملاء عند التدارك أو إتمام المقاييس بسبب عودة من عطلة أمومة أو تربص خارجي. الأستاذ الذي يسجل الحجز أولاً يغلق القاعة نهائياً للغد في تلك الحصة.
          </p>
        </div>
      </div>
    </div>
  );
}

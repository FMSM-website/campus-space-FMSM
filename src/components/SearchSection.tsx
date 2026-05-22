/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Schedule, Reservation, DAYS_ARABIC, PERIODS } from "../types";
import { Search, MapPin, User, BookOpen, Layers, Clock, AlertCircle, Compass, Info } from "lucide-react";

interface SearchSectionProps {
  schedules: Schedule[];
  reservations: Reservation[];
  currentSemester: number;
}

export default function SearchSection({ schedules, reservations, currentSemester }: SearchSectionProps) {
  const [query, setQuery] = useState("");
  const [selectedDay, setSelectedDay] = useState<string>("All");

  const normalizeArabic = (str: string) => {
    return str
      .replace(/[أإآا]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .trim()
      .toLowerCase();
  };

  const currentDayOfWeekEnglish = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const d = new Date();
    // Normalizing timezone representation
    return days[d.getDay()];
  };

  const getDayArabic = (dayEng: string) => {
    return DAYS_ARABIC[dayEng] || dayEng;
  };

  // Filter both standard schedules and reservations based on query
  const filteredSchedules = query ? schedules.filter((s) => {
    if (s.semester !== currentSemester) return false;
    const normSearch = normalizeArabic(query);
    const inProf = normalizeArabic(s.professor).includes(normSearch);
    const inModule = normalizeArabic(s.module).includes(normSearch);
    const inRoom = normalizeArabic(s.room).includes(normSearch);
    const inSpec = normalizeArabic(s.specialty).includes(normSearch);
    const inLevel = normalizeArabic(s.level).includes(normSearch);

    const matchesDay = selectedDay === "All" || s.day === selectedDay;

    return (inProf || inModule || inRoom || inSpec || inLevel) && matchesDay;
  }) : [];

  const filteredReservations = query ? reservations.filter((r) => {
    const normSearch = normalizeArabic(query);
    const inProf = normalizeArabic(r.profName).includes(normSearch);
    const inModule = normalizeArabic(r.module).includes(normSearch);
    const inRoom = normalizeArabic(r.roomId).includes(normSearch);
    const inSpec = normalizeArabic(r.specialty).includes(normSearch);
    const inLevel = normalizeArabic(r.level).includes(normSearch);

    const matchesDay = selectedDay === "All" || r.dayName === selectedDay;

    return (inProf || inModule || inRoom || inSpec || inLevel) && matchesDay;
  }) : [];

  return (
    <div id="search-section" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Search className="w-5 h-5 text-emerald-600" />
            <span>البحث الفوري العام في الكلية (طلاب / أساتذة)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            ابحث بالاسم الكامل للأستاذ، اسم المقياس الدراسي، أو رقم القاعة لمعرفة أين يتواجد الأستاذ الآن بالتفصيل.
          </p>
        </div>

        {/* Quick filters by study day */}
        <div className="flex flex-wrap gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setSelectedDay("All")}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer font-sans font-bold ${
              selectedDay === "All" 
                ? "bg-emerald-600 text-white shadow-xs" 
                : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            كل الأيام
          </button>
          {Object.entries(DAYS_ARABIC).map(([eng, arb]) => (
            <button
              key={eng}
              onClick={() => setSelectedDay(eng)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer font-sans font-bold ${
                selectedDay === eng 
                  ? "bg-emerald-600 text-white shadow-xs" 
                  : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              {arb}
            </button>
          ))}
        </div>
      </div>

      {/* Visitors & Students Welcome Info Card */}
      <div className="bg-gradient-to-l from-emerald-50/70 via-white to-slate-50 border border-emerald-150 rounded-2xl p-4 flex flex-col sm:flex-row items-start gap-4 text-right mb-5 shadow-xs">
        <div className="p-2.5 bg-emerald-50 border border-emerald-250 rounded-xl text-emerald-600 shrink-0 hidden sm:block">
          <Compass className="w-5 h-5 animate-pulse" />
        </div>
        <div className="space-y-1 w-full text-right" dir="rtl">
          <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 justify-start">
            <span>💡 دليل الزوار والطلبة (كيف تجد الأستاذ x في الكلية فوراً؟)</span>
          </h4>
          <p className="text-[11px] sm:text-xs text-slate-650 leading-relaxed font-sans">
            لا داعي للتجول والبحث الطويل في مباني وأروقة الكلية! إذا كنت تبحث عن أستاذ معيّن وتريد معرفة أين يلقي درسه الآن أو موعد حصصه الجارية لمقابلته، اكتب كنيته أو اسمه في الحقل أدناه. سيبحث النظام فوراً في الجداول البيداغوجية والتعويضية ويعرض لك رقم القاعة بالضبط، نوع المقياس، والتوقيت بالتفصيل.
          </p>
        </div>
      </div>

      {/* Quick Search Badges */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-right justify-start" dir="rtl">
        <span className="text-[11px] text-slate-500 font-bold">بكبسة زر واحدة - جرب البحث عن بعض الأساتذة والقاعات:</span>
        <div className="flex flex-wrap gap-1.5">
          {[
            { name: "بوعزيز", label: "د. بوعزيز بيداغوجي" },
            { name: "مسعودي", label: "أ.د. مسعودي عبد الرزاق" },
            { name: "بوشناق", label: "أ.د. بوشناق أحمد" },
            { name: "زيتوني", label: "د. زيتوني مريم" },
            { name: "بلخير", label: "د. بلخير عماد" },
            { name: "خليفي", label: "أ. خليفي سليم" },
            { name: "قاعة 1", label: "قاعة 1" },
            { name: "مدرج", label: "استعلام المدرجات" }
          ].map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setQuery(item.name);
              }}
              className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all cursor-pointer font-bold ${
                query === item.name
                  ? "bg-emerald-600 border-emerald-650 text-white shadow-xs scale-[1.02]"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-350"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Search Input */}
      <div className="relative">
        <div className="absolute right-3.5 top-4">
          <Search className="w-5 h-5 text-slate-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="اكتب هنا للبحث... (مثال: بوعزيز، تحليل، قاعة 1، ميكانيك)"
          className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none focus:bg-white text-slate-800 placeholder-slate-400 rounded-xl pr-11 pl-4 py-3.5 text-sm transition-all shadow-inner font-sans"
        />
        {query && (
          <button 
            onClick={() => setQuery("")}
            className="absolute left-3 top-3.5 px-2.5 py-1 text-slate-500 hover:text-slate-800 text-xs bg-white border border-slate-250 rounded-lg cursor-pointer shadow-xs font-bold font-sans"
          >
            مسح
          </button>
        )}
      </div>

      {/* Search results */}
      {query ? (
        <div className="mt-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <span>نتائج البحث الفوري للبحث عن ({query}):</span>
            <span className="text-slate-400 font-mono">[{filteredSchedules.length + filteredReservations.length} تطابق]</span>
          </h3>

          {filteredSchedules.length === 0 && filteredReservations.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500 space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-700">لم نجد أي مطابقات لاسم الأستاذ، المقياس، التخصص أو القاعة المحددة.</p>
              <p className="text-xs text-slate-450">يرجى التحقق من صياغة الاسم أو جرب كلمات مفتاحية أخرى.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Reservations section */}
              {filteredReservations.map((res) => (
                <div 
                  key={`res-${res.id}`} 
                  className="bg-amber-50/50 border border-amber-200 hover:border-amber-300 p-4 rounded-xl relative overflow-hidden group transition-all shadow-xs"
                >
                  <div className="absolute top-0 left-0 bg-amber-100 border-b border-r border-amber-200 text-amber-800 text-[10px] px-2.5 py-1 rounded-br-lg font-bold tracking-wide">
                    حجز تعويضي خاص للغد
                  </div>

                  <div className="flex items-start gap-3 mt-1.5">
                    <div className="p-2.5 bg-amber-100 rounded-lg text-amber-700 shadow-xs">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 w-full">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-850">{res.profName}</h4>
                        <span className="text-xs text-slate-500 font-bold font-sans">{res.date} ({getDayArabic(res.dayName)})</span>
                      </div>
                      <p className="text-xs text-slate-700 font-bold flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>مقياس: {res.module}</span>
                      </p>
                      
                      <div className="grid grid-cols-2 gap-1 pt-1.5 text-[11px] text-slate-500 border-t border-slate-150 mt-1">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-600 animate-bounce" />
                          <span className="font-bold text-slate-900">{res.roomId}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-600" />
                          <span className="font-sans">{res.periodTime}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-slate-400" />
                          <span className="font-sans">{res.level} - {res.year} - {res.group}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate" title={res.specialty}>
                          {res.specialty}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Standard Schedule matches */}
              {filteredSchedules.map((sch) => (
                <div 
                  key={`sch-${sch.id}`} 
                  className="bg-slate-50 border border-slate-200 hover:border-slate-300 p-4 rounded-xl relative overflow-hidden group transition-all shadow-xs"
                >
                  <div className="absolute top-0 left-0 bg-emerald-50 border-b border-l border-emerald-250 text-emerald-700 text-[10px] px-2.5 py-1 rounded-br-lg font-bold">
                    جدول التوقيت الرسمي (س {sch.semester})
                  </div>

                  <div className="flex items-start gap-3 mt-1.5">
                    <div className="p-2.5 bg-emerald-50 border border-emerald-150 rounded-lg text-emerald-700 shadow-xs">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 w-full">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-850">{sch.professor}</h4>
                        <span className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">{getDayArabic(sch.day)}</span>
                      </div>
                      <p className="text-xs text-slate-700 font-bold flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>مقياس: {sch.module}</span>
                      </p>
                      
                      <div className="grid grid-cols-2 gap-1 pt-1.5 text-[11px] text-slate-500 border-t border-slate-150 mt-1">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-600" />
                          <span className="font-bold text-slate-850">{sch.room}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="font-sans">الحصة {sch.period} ({sch.periodTime})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-slate-400" />
                          <span className="font-sans">{sch.level} - {sch.year} - {sch.group}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate" title={sch.specialty}>
                          {sch.specialty}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
          <p className="text-xs text-slate-500 font-sans font-medium leading-relaxed">
            المنصة محدّثة تلقائياً ببيانات وحجوزات كلية الرياضيات وعلوم المادة لجامعة ورقلة. ابدأ بالبحث للعثور على النتائج بشكل فوري.
          </p>
        </div>
      )}
    </div>
  );
}

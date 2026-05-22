/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { 
  db, 
  handleFirestoreError, 
  OperationType 
} from "../firebase";
import { 
  collection, 
  doc, 
  writeBatch 
} from "firebase/firestore";
import { Schedule, UserProfile, ROOMS_LIST } from "../types";
import { 
  FileText, 
  UploadCloud, 
  AlertCircle, 
  CheckCircle, 
  Sparkles, 
  Database, 
  Loader2, 
  HelpCircle,
  Clock,
  ArrowLeft,
  ChevronLeft
} from "lucide-react";

interface ImportSectionProps {
  currentUser: any;
  userProfile: UserProfile | null;
  currentSchedules: Schedule[];
}

export default function ImportSection({ 
  currentUser, 
  userProfile,
  currentSchedules 
}: ImportSectionProps) {
  const [selectedSemester, setSelectedSemester] = useState<number>(1);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<Omit<Schedule, "id">[] | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        processFile(file);
      } else {
        setErrorStatus("الرجاء سحب وإفلات ملف PDF صالح فقط يحوي جداول الحصص.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === "application/pdf") {
        processFile(file);
      } else {
        setErrorStatus("الملف المحدد ليس ملف PDF. يرجى اختيار ملف توزيع التوقيت الخاص بالكلية.");
      }
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const processFile = async (file: File) => {
    setErrorStatus(null);
    setSuccessInfo(null);
    setExtractedData(null);
    setUploading(true);

    try {
      // Read file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Result = reader.result as string;
        
        // Call backend API to parse using Gemini
        try {
          const response = await fetch("/api/schedules/parse-pdf", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              pdfBase64: base64Result,
              semester: selectedSemester
            })
          });

          const data = await response.json();
          if (!response.ok || data.error) {
            throw new Error(data.error || "فشل تحليل الملف بواسطة خادم الذكاء الاصطناعي.");
          }

          if (data.schedules && Array.isArray(data.schedules)) {
            setExtractedData(data.schedules);
            setSuccessInfo(`تم استخراج ${data.count} حصة بيداغوجية بنجاح من جداول الكلية بالكامل.`);
          } else {
            throw new Error("تنسيق البيانات المستلمة غير صالح.");
          }
        } catch (apiErr: any) {
          setErrorStatus(apiErr.message || "عذرًا، حدث خطأ أثناء الاتصال بخادم تحليل جداول التوقيت.");
        } finally {
          setUploading(false);
        }
      };

      reader.onerror = () => {
        setErrorStatus("تعذر قراءة ملف الـ PDF. يرجى المحاولة بقراءة ملف آخر.");
        setUploading(false);
      };

      reader.readAsDataURL(file);

    } catch (e: any) {
      setErrorStatus("حدث خطأ غير متوقع أثناء معالجة الملف: " + e.message);
      setUploading(false);
    }
  };

  // Overwrite existing database schedules with the newly extracted ones
  const handleSaveToDatabase = async () => {
    if (!extractedData || extractedData.length === 0) return;
    
    setSaving(true);
    setErrorStatus(null);

    try {
      const batch = writeBatch(db);

      // 1. Queue deletion for all current schedules in database
      currentSchedules.forEach((sch) => {
        const docRef = doc(db, "schedules", sch.id);
        batch.delete(docRef);
      });

      // 2. Queue setting of all brand-new schemas
      extractedData.forEach((item, index) => {
        const schId = `sch_pdf_${Date.now()}_${index}`;
        const docRef = doc(db, "schedules", schId);
        batch.set(docRef, item);
      });

      // 3. Commit atomic update
      await batch.commit();

      setSuccessInfo("🎉 تم بنجاح تحديث وتنسيق جداول الكلية الشاملة وحفظها بقاعدة البيانات الرسمية. جميع القاعات والشواغر تم تنظيمها الآن تلقائياً!");
      setExtractedData(null); // Clear preview

    } catch (err: any) {
      console.warn("Firestore batch write failed, falling back to local storage schedules instead:", err);
      
      try {
        // Build list of newly extracted schedules with generated local IDs
        const newLocalSchedules: Schedule[] = extractedData.map((item, index) => ({
          id: `sch_local_${Date.now()}_${index}`,
          ...item
        }));

        // Persist to local storage
        localStorage.setItem("local_schedules", JSON.stringify(newLocalSchedules));

        // Dispatch updated event to notify App.tsx
        window.dispatchEvent(new Event("local_schedules_updated"));

        setSuccessInfo("🎉 تم بنجاح جلب وتحديث جداول التدرج الأسبوعي للكلية (تم تفعيل نظام التخزين المحلي الاحتياطي بنجاح).");
        setExtractedData(null); // Clear preview
      } catch (localErr) {
        setErrorStatus("فشل حفظ التوزيع الجديد بقاعدة البيانات.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Grouping statistics for UI presentation
  const getDeptStats = () => {
    if (!extractedData) return { math: 0, physics: 0, chemistry: 0 };
    return {
      math: extractedData.filter(s => s.specialty === "رياضيات").length,
      physics: extractedData.filter(s => s.specialty === "فيزياء").length,
      chemistry: extractedData.filter(s => s.specialty === "كيمياء").length,
    };
  };

  const deptStats = getDeptStats();

  return (
    <div id="import-section-wrapper" className="space-y-6" dir="rtl">
      
      {/* Intro Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-xl shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">تحديث جداول التوقيت الرسمي عبر الملفات الذكية (PDF):</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              لتسهيل عمل الإدارة وتجنب مجهود الكتابة اليدوية، توفر المنصة تقنية <strong>المنسق البيداغوجي الذكي</strong> المدعم بـ Gemini.
              اسحب وأفلت ملف PDF الموحد لتوزيع حصص الأسبوع للأقسام الثلاثة (الرياضيات، الفيزياء، الكيمياء) وسيتولى الخادم تفريغ الجداول، تصنيف المستويات، وترتيب الفراغات والشواغر للقاعات فورياً دون أي تضارب.
            </p>
          </div>
        </div>

        {/* Info Note list */}
        <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-2">
          <p className="font-bold text-slate-700 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
            <span>لوائح تصنيف البيانات المستخرجة والمنظومة:</span>
          </p>
          <ul className="list-disc list-inside space-y-1 pr-1 font-sans text-[10px]">
            <li>الجداول المستخرجة تحل تلقائياً مكان التواقيت المخزنة قديماً لتحديث خريطة الفراغات والشواغر الفورية.</li>
            <li>يقوم الذكاء الاصطناعي برصد أسماء المدرجات والقاعات (مثال قاعة 1 إلى 7 ومدرج أ وب وج) لتنظيم لوحة الحجز.</li>
            <li>يتم تحييد الأوقات المشغولة تلقائياً لكي لا يحجزها أي أستاذ تفادياً للاصطدام أو شغل القاعات المزدوج.</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Upload Portal Form */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="pb-3 border-b border-slate-150">
              <h4 className="text-xs font-bold text-slate-700">بوابة استيراد الجداول للأقسام الثلاثة</h4>
            </div>

            {/* Semester Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 block">اختر السداسي المعتمد في الملف:</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 border border-slate-150 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSelectedSemester(1)}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    selectedSemester === 1
                      ? "bg-white border border-slate-200/80 text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  السداسي الأول (S1)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSemester(2)}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    selectedSemester === 2
                      ? "bg-white border border-slate-200/80 text-indigo-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  السداسي الثاني (S2)
                </button>
              </div>
            </div>

            {/* Drag & Drop Window Area */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={onButtonClick}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 min-h-[190px] ${
                dragActive 
                  ? "border-indigo-500 bg-indigo-50/30" 
                  : "border-slate-250 bg-slate-50/40 hover:bg-slate-50/90"
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".pdf"
                className="hidden" 
                onChange={handleFileChange}
                disabled={uploading || saving}
              />

              {uploading ? (
                <div className="space-y-2 animate-pulse">
                  <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-800">جاري مسح وقراءة ملف جداول التوزيع البيداغوجي...</p>
                  <p className="text-[10px] text-slate-400 font-sans">تستغرق معالجة الجداول وتحليلها بذكاء حوالي 20 إلى 30 ثانية...</p>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200 text-slate-400">
                    <UploadCloud className="w-8 h-8 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-slate-800">اسحب وأفلت ملف PDF لجداول الكلية هنا</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-sans">أو انقر هنا لاستعراض الملفات من حاسوبك</p>
                  </div>
                  <span className="text-[10px] bg-indigo-50 border border-indigo-150 inline-block text-indigo-750 font-bold px-3 py-1 rounded-full font-sans">
                    يدعم تصنيفات الأقسام الثلاثة
                  </span>
                </>
              )}
            </div>

            {/* Error or Success banners */}
            {errorStatus && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs text-rose-800 flex items-start gap-2 leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorStatus}</span>
              </div>
            )}

            {successInfo && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs text-emerald-800 flex items-start gap-2 leading-relaxed">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successInfo}</span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>عدد تواقيت الحصص المخزنة حالياً: <strong className="text-slate-800 font-sans font-bold">{currentSchedules.length}</strong> حصة</span>
            {userProfile && (
              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">الأستاذ: {userProfile.name}</span>
            )}
          </div>
        </div>

        {/* Preview Extracted Dashboard (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between min-h-[420px] space-y-6">
          <div className="space-y-4 flex-1">
            <div className="flex items-center justify-between pb-3 border-b border-slate-150">
              <h4 className="text-xs font-bold text-slate-700">معاينة التوزيع وإعادة جدولة الكلية</h4>
              {extractedData && (
                <span className="text-[10px] bg-amber-50 text-amber-700 font-bold border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> تم تنقيح جداول الأقسام الثلاثة بالكامل
                </span>
              )}
            </div>

            {!extractedData ? (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center text-slate-400 space-y-3 bg-slate-50/50 rounded-2xl border border-slate-150 border-dashed">
                <FileText className="w-12 h-12 text-slate-300 bg-white p-3 rounded-2xl border border-slate-150 shadow-xs" />
                <div>
                  <p className="text-xs font-bold text-slate-650">يرجى رفع ملف توزيق التوقيت بـ PDF أولاً</p>
                  <p className="text-[10px] text-slate-500 max-w-sm mt-1 leading-relaxed font-sans">
                    بمجرد سحب ملف الجداول، ستظهر إحصاءات الحصص مقسمة حسب الفروع (رياضيات، فيزياء، كيمياء) مع جدول مسبق لمعاينة الحصص والتواقيت المستخرجة قبل إلحاقها بقاعدة البيانات.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-blue-50/50 border border-blue-150 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-blue-650">قسم الرياضيات</span>
                    <p className="text-lg font-bold font-sans text-blue-800">{deptStats.math} <span className="text-[10px] font-normal font-sans">حصة</span></p>
                  </div>
                  <div className="p-3 bg-purple-50/50 border border-purple-150 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-purple-650">قسم الفيزياء</span>
                    <p className="text-lg font-bold font-sans text-purple-800">{deptStats.physics} <span className="text-[10px] font-normal font-sans">حصة</span></p>
                  </div>
                  <div className="p-3 bg-emerald-50/50 border border-emerald-150 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-emerald-650">قسم الكيمياء</span>
                    <p className="text-lg font-bold font-sans text-emerald-800">{deptStats.chemistry} <span className="text-[10px] font-normal font-sans">حصة</span></p>
                  </div>
                </div>

                {/* Micro Review Table */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 block">نموذج لبعض الفروع والحصص المنبثقة من الملف:</label>
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs max-h-[180px] overflow-y-auto">
                    <table className="w-full text-center text-[10px] border-collapse bg-white">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-slate-600 font-bold">
                          <th className="py-2 px-1">اليوم</th>
                          <th className="py-2 px-1">الحصة</th>
                          <th className="py-2 px-1">القاعة</th>
                          <th className="py-2 px-1">المقياس</th>
                          <th className="py-2 px-1">الأستاذ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans">
                        {extractedData.slice(0, 10).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/40">
                            <td className="py-2 px-1 font-bold">
                              {item.day === "Sunday" ? "الأحد" :
                               item.day === "Monday" ? "الاثنين" :
                               item.day === "Tuesday" ? "الثلاثاء" :
                               item.day === "Wednesday" ? "الأربعاء" : "الخميس"}
                            </td>
                            <td className="py-2 px-1 text-slate-500">ح{item.period} ({item.periodTime})</td>
                            <td className="py-2 px-1 font-bold text-slate-800">{item.room}</td>
                            <td className="py-2 px-1 truncate max-w-[100px] text-emerald-700 font-bold" title={item.module}>
                              {item.module}
                            </td>
                            <td className="py-2 px-1 text-slate-600 truncate max-w-[100px]">{item.professor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>

          {extractedData && (
            <div className="pt-4 border-t border-slate-150 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleSaveToDatabase}
                disabled={saving}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-slate-200 text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري حفظ واعتماد المقررات...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span>حفظ واعتماد الجداول الثلاثة بالكلية فورداً</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setExtractedData(null)}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-all border border-slate-200"
              >
                إلغاء
              </button>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}

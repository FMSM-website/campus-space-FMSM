import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Let's use generous body limits so larger schedule PDFs can be uploaded as base64
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API router for custom full-stack solutions
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // End point to parse PDF and extract structured timetables using Gemini 3.5 Flash
  app.post("/api/schedules/parse-pdf", async (req, res) => {
    try {
      const { pdfBase64, semester } = req.body;
      const parsedSemester = semester ? Number(semester) : 1;

      if (!pdfBase64) {
        res.status(400).json({ error: "الرجاء توفير ملف الجدول بصيغة base64." });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ 
          error: "مفتاح API الخاص بـ Gemini غير مهيأ بالخادم. يرجى إعداده في Settings > Secrets." 
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      // Strip potential mime prefix
      let pureBase64 = pdfBase64;
      if (pdfBase64.startsWith("data:")) {
        const commaIdx = pdfBase64.indexOf(",");
        if (commaIdx !== -1) {
          pureBase64 = pdfBase64.substring(commaIdx + 1);
        }
      }

      const pdfPart = {
        inlineData: {
          mimeType: "application/pdf",
          data: pureBase64
        }
      };

      const systemInstruction = `أنت منسق بيداغوجي خبير في كلية الرياضيات وعلوم المادة بجامعة ورقلة (الجزائر).
مهمتك بدقة هي قراءة ملف PDF الذي يحتوي على جداول التوزيع الأسبوعية للحصص لأقسام الكلية الثلاثة:
1. قسم الرياضيات (Timetables of Mathematics) - وتخصصهم: "رياضيات"
2. قسم الفيزياء (Timetables of Physics) - وتخصصهم: "فيزياء"
3. قسم الكيمياء (Timetables of Chemistry) - وتخصصهم: "كيمياء"

استخرج جميع الحصص والمقررات من الجداول بدقة متناهية للسداسي الدراسي ${parsedSemester}.
قم بهيكلة البيانات وتصنيفها وتنظيمها بشكل كامل لتعود كقائمة JSON مهيكلة للتطبيق. 

شروط مطابقة الحقول:
- "specialty": يجب تصنيف التخصص بدقة تامة ليكون أحد القيم الآتية فقط: "رياضيات" أو "فيزياء" أو "كيمياء" بناء على تخصص الجدول في الـ PDF.
- "day": يجب ترجمته ومطابقته لليوم بالإنجليزية بدقة:
    الأحد -> Sunday
    الاثنين -> Monday
    الثلاثاء -> Tuesday
    الأربعاء -> Wednesday
    الخميس -> Thursday
- "period": رقم الحصة من 1 إلى 5.
    الحصة الأولى (08:30 - 10:00) -> 1
    الحصة الثانية (10:15 - 11:45) -> 2
    الحصة الثالثة (12:00 - 13:30) -> 3
    الحصة الرابعة (13:45 - 15:15) -> 4
    الحصة الخامسة (15:30 - 17:00) -> 5
- "periodTime": الوقت الدقيق للحصة (مثال: "08:30 - 10:00"، "10:15 - 11:45").
- "room": اسم القاعة أو المدرج (مثال: "قاعة 1"، "قاعة 2"، "مدرج أ"، "مخبر الفيزياء"). حاول كتابة الاسم بشكل قياسي ونظيف.
- "professor": اسم الأستاذ المحاضر المسؤول عن الحصة.
- "level": المستوى الدراسي ("ليسانس" أو "ماستر").
- "year": السنة الدراسية ("سنة 1" أو "سنة 2" أو "سنة 3").
- "group": الفوج المعني بالحصة (مثال: "فوج 1"، "فوج 2"، أو "فوج مشترك").
- "module": اسم المقياس أو المقرر الدراسي (مثال: "تحليل 1"، "كيمياء عضوية"، "ميكانيك الكم"). لا تتركه فارغاً.

استخرج كل الحصص بضمير مهني، ورتبها لكي تكون جاهزة للاستيراد المباشر بقاعدة البيانات.`;

      const prompt = `الرجاء استخراج جداول التوقيت بالتفصيل من ملف الـ PDF المرفق للسداسي ${parsedSemester}. أعد ترتيب الحصص بشكل متناسق ومطابق تماماً للمواصفات المطلوبة.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [pdfPart, prompt],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            description: "List of extracted schedules from the PDF timetables",
            items: {
              type: Type.OBJECT,
              properties: {
                semester: { 
                  type: Type.INTEGER, 
                  description: "السداسي المعني (1 أو 2)" 
                },
                day: { 
                  type: Type.STRING, 
                  description: "المطابقة لليوم بالإنجليزية: Sunday, Monday, Tuesday, Wednesday, Thursday" 
                },
                period: { 
                  type: Type.INTEGER, 
                  description: "رقم الحصة من 1 إلى 5" 
                },
                periodTime: { 
                  type: Type.STRING, 
                  description: "وقت الحصة القياسي (على سبيل المثال: 08:30 - 10:00)" 
                },
                room: { 
                  type: Type.STRING, 
                  description: "اسم القاعة أو المدرج القياسي" 
                },
                professor: { 
                  type: Type.STRING, 
                  description: "اسم الأستاذ المحاضر" 
                },
                specialty: { 
                  type: Type.STRING, 
                  description: "التخصص القياسي: رياضيات، فيزياء، كيمياء" 
                },
                level: { 
                  type: Type.STRING, 
                  description: "المستوى: ليسانس، ماستر" 
                },
                year: { 
                  type: Type.STRING, 
                  description: "السنة الدراسية: سنة 1، سنة 2، سنة 3" 
                },
                group: { 
                  type: Type.STRING, 
                  description: "الفوج الدراسي: فوج 1، فوج 2، فوج مشترك" 
                },
                module: { 
                  type: Type.STRING, 
                  description: "اسم المقياس الدراسي المستخرج" 
                }
              },
              required: [
                "semester", 
                "day", 
                "period", 
                "periodTime", 
                "room", 
                "professor", 
                "specialty", 
                "level", 
                "year", 
                "group", 
                "module"
              ]
            }
          }
        }
      });

      const extractedText = response.text;
      if (!extractedText) {
        res.status(500).json({ error: "فشل استخراج البيانات من ملف PDF بواسطة الذكاء الاصطناعي." });
        return;
      }

      const schedulesList = JSON.parse(extractedText.trim());
      res.json({
        success: true,
        count: schedulesList.length,
        schedules: schedulesList
      });

    } catch (error: any) {
      console.error("PDF Parsing Error:", error);
      res.status(500).json({ 
        error: "حدث خطأ أثناء معالجة ملف PDF واستخراج المقررات: " + (error.message || String(error)) 
      });
    }
  });

  // Serve Vite app in dev mode, or static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

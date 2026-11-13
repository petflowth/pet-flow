"use client";

import { useLocale, useTr } from "@/components/LocaleProvider";
import { savedPopup } from "@/components/Toast";
import { IntakeFlowBar } from "@/components/IntakeFlowBar";
import { flowProgress } from "@/lib/intake-flow";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiff } from "@/components/LiffProvider";
import { useConfig } from "@/components/ConfigProvider";
import { answeredRecently, otherKey, type GroomField } from "@/lib/groom-form";
import { intakeFields } from "@/lib/intake-rules";
import { formKindOf, normalizeSpecies, petKindOf, petWords, speciesWords } from "@/lib/pet-kind";
import { BATH_SHARED_WITH_STAY } from "@/lib/stay-form";
import { localizeFields } from "@/lib/form-en";
import { LoadingScreen } from "@/components/LoadingScreen";
import { BTN_PRIMARY, PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { ReviewSheet, type ReviewSection } from "@/components/ReviewSheet";

type Answers = Record<string, string | string[]>;

type CatForm = {
  id: string;
  catName: string;
  /** คำถามของน้องตัวนี้ — หมากับแมวคนละชุด (หมาไม่ถามเรื่องทราย) */
  fields: GroomField[];
  /** คำถามภาษาไทยตามที่ร้านตั้ง — fields คือฉบับตามภาษาที่ลูกค้าเลือก (แปลใหม่เมื่อสลับภาษา) */
  rawFields: GroomField[];
  /** อีโมจิของน้องตัวนี้ 🐶 / 🐱 */
  emoji: string;
  answers: Answers;
  /** ติ๊ก "ไม่ทราบน้ำหนัก" */
  weightUnknown: boolean;
  /** คำถามที่ข้ามให้ตัวนี้ (เช่น โรคประจำตัวที่ตอบไว้แล้วตอนสมัครสมาชิก) */
  skip: string[];
  /** เข้าพัก + อาบก่อนกลับ — ถามเรื่องอาบน้ำต่อท้ายในฟอร์มเดียว (key ขึ้นต้น "g:") */
  bath: boolean;
  /** ข้อที่ตอบไว้แล้ว (ตอนสมัครสมาชิก / ครั้งก่อน) — ซ่อนไว้ ไม่ถามซ้ำ กด "แก้คำตอบเดิม" เพื่อดู */
  answered: string[];
  showAnswered: boolean;
  /** บันทึกสำเร็จแล้ว — กดส่งใหม่ (หลังมีตัวที่ไม่สำเร็จ) ไม่ส่งตัวนี้ซ้ำ */
  saved?: boolean;
};

/** เหตุที่บันทึกไม่ผ่าน → ข้อความที่ลูกค้าอ่านเข้าใจ */
function saveFailReason(status: number, error: string | undefined, en: boolean): string {
  if (status === 401)
    return en ? "LINE account check failed — close this page and open the link from the chat again" : "ยืนยันบัญชี LINE ไม่ผ่าน ปิดหน้านี้แล้วเปิดลิงก์จากแชทใหม่";
  if (status === 404) return en ? "This pet isn't in your account" : "ไม่พบน้องตัวนี้ในบัญชี";
  if (error === "feature_disabled") return en ? "The shop has turned this form off" : "ร้านปิดฟอร์มนี้อยู่";
  return en ? "System error" : "ระบบขัดข้อง";
}

/** คำถามอาบน้ำในฟอร์มรวม — ใส่ "g:" กัน key ชนกับฝั่งเข้าพัก */
const BATH_PREFIX = "g:";

function emptyAnswers(fields: GroomField[]): Answers {
  const a: Answers = {};
  for (const f of fields) {
    a[f.key] = f.type === "multi" ? [] : "";
    if (f.allowOther) a[otherKey(f.key)] = "";
  }
  return a;
}

/** แปลงค่าที่เคยบันทึกไว้ให้ตรงชนิดของคำถาม (รองรับข้อมูลเก่าที่เป็น string เดี่ยว) */
function loadAnswers(fields: GroomField[], info: Record<string, unknown> | null, keepOld = false): Answers {
  const a = emptyAnswers(fields);
  if (!info) return a;
  const recent = answeredRecently(info.submittedAt);
  for (const f of fields) {
    // ข้อที่ถามใหม่ทุกนัด (โรคติดต่อ/เชื้อรา) — คำตอบเก่าเกินสัปดาห์ไม่ใส่ให้ ลูกค้าเลือกใหม่ตามอาการตอนนี้
    if (f.askEveryTime && !recent && !keepOld) continue;
    const v = info[f.key];
    if (v == null) continue;
    if (f.type === "multi") {
      a[f.key] = Array.isArray(v) ? (v as string[]) : v ? [String(v)] : [];
    } else {
      a[f.key] = Array.isArray(v) ? String(v[0] ?? "") : String(v);
    }
    if (f.allowOther && info[otherKey(f.key)]) a[otherKey(f.key)] = String(info[otherKey(f.key)]);
  }
  return a;
}

/** ข้อที่มีคำตอบใช้ได้แล้ว — ตัวเลือกต้องตรงกับตัวเลือกปัจจุบัน (คำตอบพิมพ์แบบเก่าของข้อที่เปลี่ยนเป็นปุ่มเลือก ถามใหม่) */
function answeredKeys(fields: GroomField[], a: Answers): string[] {
  return fields
    .filter((f) => {
      const v = a[f.key];
      if (f.type === "single") return f.options.some((o) => o.key === v);
      if (f.type === "multi") {
        // พิมพ์เองไว้อย่างเดียว (ไม่ได้กดปุ่ม) ก็นับว่าตอบแล้ว
        const typed = f.allowOther && !!String(a[otherKey(f.key)] || "").trim();
        const list = Array.isArray(v) ? v : [];
        return (list.length > 0 || typed) && list.every((x) => f.options.some((o) => o.key === x));
      }
      return !!String(v || "").trim();
    })
    .map((f) => f.key);
}

function GroomInfoContent() {
  const params = useSearchParams();
  // ลิงก์จากนัด (id = bookingId) หรือจากหน้าข้อมูลลูกค้า (cats = ตัวน้อง ยังไม่ต้องมีนัด)
  const catMode = !!params.get("cats");
  const ids = (params.get("cats") || params.get("id") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const { profile } = useLiff();
  const { config } = useConfig();
  const { locale } = useLocale();
  const tr = useTr();
  const en = locale === "en";

  // คำถามทั้งหมด — ก่อนอาบน้ำ: ตามที่ร้านตั้งไว้ในหลังบ้าน · ก่อนเข้าพัก: ชุดการกิน/การดูแล (stay-form)
  // เลือกชุดตามชนิดของน้องแต่ละตัว (หมา/แมว) · ไม่รู้ชนิด = ชนิดที่ร้านรับ
  const petKind = petKindOf(config);
  const groomForm = config.groomForm;
  const stayForm = config.stayForm;
  const rules = config.intakeRules;

  const [forms, setForms] = useState<CatForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [attempted, setAttempted] = useState(false);
  // ป๊อปอัปสรุปให้ลูกค้าเช็คก่อนส่งจริง
  const [reviewing, setReviewing] = useState(false);
  // โหลดไม่ขึ้นเพราะยืนยัน LINE ไม่ผ่าน (401) — บอกลูกค้าให้เปิดลิงก์ใหม่ แทน "ไม่พบข้อมูลการนัด"
  const [loadError, setLoadError] = useState("");
  // นัดเข้าพัก / ลิงก์ kind=stay → ฟอร์มก่อนเข้าพัก (คนละชุดคำถามกับก่อนอาบน้ำ)
  const kindParam = params.get("kind") || "";
  // ร้านกด "ขออัปเดต" — เปิดทุกข้อพร้อมคำตอบเดิม ให้แก้เฉพาะข้อที่เปลี่ยน (ไม่ซ่อนข้อที่เคยตอบ)
  const updateMode = params.get("update") === "1";
  const [isStay, setIsStay] = useState(kindParam === "stay");

  // สลับภาษา → แปลคำถามใหม่ (คำตอบที่กรอกไว้ยังอยู่ เพราะเก็บเป็น key)
  useEffect(() => {
    setForms((prev) => prev.map((f) => ({ ...f, fields: localizeFields(f.rawFields, locale) })));
  }, [locale]);

  useEffect(() => {
    if (ids.length === 0) {
      setLoading(false);
      return;
    }
    // รอเชื่อม LINE เสร็จก่อน (ได้คุกกี้เซสชันลูกค้า) — ยิงก่อนจะโดน 401 แล้วขึ้น "ไม่พบข้อมูลการนัด"
    if (!profile?.lineUserId) return;
    Promise.all(
      ids.map((id) =>
        fetch(
          `/api/bookings/groom-info?${catMode ? "cat" : "id"}=${encodeURIComponent(id)}${kindParam ? `&kind=${kindParam}` : ""}`
        )
          .then(async (r) => (r.status === 401 ? { unauthorized: true } : r.json()))
          .catch(() => null)
      )
    )
      .then((results) => {
        const loaded: CatForm[] = [];
        // เซิร์ฟเวอร์บอกว่าเป็นฟอร์มไหน (นัดเข้าพัก = ก่อนเข้าพัก) — ใช้ชุดคำถามนั้นทั้งหน้า
        // ไม่มีตัวไหนโหลดขึ้น → คงฟอร์มตามลิงก์ไว้ (ไม่งั้นการ์ดก่อนเข้าพักจะโชว์หัว "ก่อนอาบน้ำ")
        const anyFound = results.some((d) => d?.found);
        const stay = anyFound ? results.some((d) => d?.kind === "stay") : kindParam === "stay";
        setIsStay(stay);
        if (!anyFound && results.some((d) => d?.unauthorized)) {
          setLoadError(tr("ระบบยังยืนยันบัญชี LINE ไม่สำเร็จ — ปิดหน้านี้แล้วเปิดลิงก์จากแชท LINE ใหม่อีกครั้งนะคะ", "We couldn't verify your LINE account — close this page and open the link from the LINE chat again"));
        }
        results.forEach((d, i) => {
          if (!d?.found) return;
          const info = d.info || null;
          const species = normalizeSpecies(d.species);
          const kind = species ? formKindOf(species, config) : petKind;
          const own = intakeFields(stay ? "stay" : "groom", kind, { groomForm, stayForm, intakeRules: rules });
          // เข้าพัก + อาบก่อนกลับ — ถามเรื่องอาบน้ำต่อท้าย ข้อที่ซ้ำกับฟอร์มเข้าพักถามครั้งเดียว
          const bath = stay && !!d.withBath;
          const bathFs = bath
            ? intakeFields("groom", kind, { groomForm, stayForm, intakeRules: rules })
                .filter((fd) => !(fd.key in BATH_SHARED_WITH_STAY) && !own.some((o) => o.key === fd.key))
                .map((fd) => ({ ...fd, key: BATH_PREFIX + fd.key }))
            : [];
          const fs = [...own, ...bathFs];
          const answers = loadAnswers(fs, info, updateMode);
          loaded.push({
            id: ids[i],
            catName: d.booking?.catName || tr("น้อง", "Your pet"),
            fields: localizeFields(fs, locale),
            rawFields: fs,
            emoji: speciesWords(species, config).emoji,
            answers,
            weightUnknown: info?.weight === "unknown",
            skip: d.knownMedical ? ["medical"] : [],
            bath,
            // ข้อที่ถามใหม่ทุกนัด ไม่ซ่อน (ยกเว้นเพิ่งตอบในสัปดาห์นี้)
            answered: answeredKeys(
              fs.filter((fd) => !fd.askEveryTime || answeredRecently(info?.submittedAt)),
              answers
            ),
            showAnswered: updateMode,
          });
        });
        setForms(loaded);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString(), groomForm, stayForm, rules, petKind, profile?.lineUserId]);

  const setAnswer = (idx: number, key: string, value: string | string[]) =>
    setForms((prev) =>
      prev.map((f, i) =>
        i === idx ? { ...f, answers: { ...f.answers, [key]: value } } : f
      )
    );

  /**
   * บ้านเดียวกันหลายตัว ส่วนใหญ่กิน/ดูแลเหมือนกัน — แตะเดียวคัดลอกคำตอบจากตัวแรก แล้วแก้เฉพาะข้อที่ต่าง
   * ไม่คัดลอกน้ำหนัก (คนละตัวน้ำหนักไม่เท่ากัน)
   */
  const copyFromFirst = (idx: number) =>
    setForms((prev) =>
      prev.map((f, i) => {
        if (i !== idx || !prev[0]) return f;
        const answers = { ...f.answers };
        for (const fd of f.fields) {
          if (fd.hasUnknownToggle || !(fd.key in prev[0].answers)) continue;
          const v = prev[0].answers[fd.key];
          answers[fd.key] = Array.isArray(v) ? [...v] : v;
        }
        return { ...f, answers };
      })
    );

  const toggleOption = (idx: number, key: string, optKey: string) =>
    setForms((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        const cur = (f.answers[key] as string[]) || [];
        // "✅ ไม่มี" กับตัวเลือกอื่นเลือกพร้อมกันไม่ได้ — กดไม่มี = ล้างข้ออื่น · กดข้ออื่น = เอาไม่มีออก
        const next = cur.includes(optKey)
          ? cur.filter((x) => x !== optKey)
          : optKey === "none"
            ? ["none"]
            : [...cur.filter((x) => x !== "none"), optKey];
        return { ...f, answers: { ...f.answers, [key]: next } };
      })
    );

  /** คำถามที่บังคับตอบแล้วยังว่างอยู่ */
  const missingKeys = (f: CatForm) =>
    f.fields
      .filter((fd) => {
        if (!fd.required || f.skip.includes(fd.key)) return false;
        if (fd.hasUnknownToggle && f.weightUnknown) return false;
        if (fd.allowOther && String(f.answers[otherKey(fd.key)] || "").trim()) return false;
        const v = f.answers[fd.key];
        return Array.isArray(v) ? v.length === 0 : !String(v || "").trim();
      })
      .map((fd) => fd.key);

  const nextStep = flowProgress(params, locale)?.next;

  /** กดส่ง → เช็คข้อบังคับ แล้วเปิดป๊อปอัปสรุปให้ดูก่อน (ยังไม่บันทึก) */
  const submit = () => {
    if (forms.length === 0) return;
    setAttempted(true);
    if (forms.some((f) => missingKeys(f).length > 0)) {
      // บอกชื่อข้อที่ยังไม่ได้ตอบ + เลื่อนไปข้อแรก — ข้อที่ขาดมักอยู่ด้านบน ลูกค้ามองไม่เห็นว่าขาดข้อไหน
      const list = forms.flatMap((f, i) =>
        missingKeys(f).map((k) => {
          const label = (f.fields.find((fd) => fd.key === k)?.label || k).replace(/\s*[—(].*$/, "");
          return { id: `q-${i}-${k}`, text: forms.length > 1 ? `${f.catName}: ${label}` : label };
        })
      );
      setSaveError(
        tr(
          `ยังไม่ได้ตอบ ${list.length} ข้อ: ${list.map((x) => x.text).join(" · ")} — ข้อที่ขาดมีตัวหนังสือสีส้มนะคะ 🙏`,
          `${list.length} question(s) still to answer: ${list.map((x) => x.text).join(" · ")} — they're marked in orange 🙏`,
        )
      );
      setTimeout(() => {
        const el = list[0] && document.getElementById(list[0].id);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    setSaveError("");
    setReviewing(true);
  };

  /** สรุปคำตอบเป็นข้อความอ่านง่าย — ตัวเลือกโชว์ชื่อ ไม่ใช่ key */
  const reviewSections = (): ReviewSection[] =>
    forms.flatMap((f) => {
      const visible = f.fields.filter((fd) => !f.skip.includes(fd.key));
      const row = (fd: GroomField) => {
        const v = f.answers[fd.key];
        const label = fd.label;
        // ช่อง "อื่นๆ (พิมพ์เอง)" ต่อท้ายตัวเลือกที่ติ๊ก
        const other = fd.allowOther ? String(f.answers[otherKey(fd.key)] || "").trim() : "";
        if (fd.type === "single")
          return { label, value: [fd.options.find((o) => o.key === v)?.label || "", other].filter(Boolean) };
        if (fd.type === "multi")
          return {
            label,
            value: [...((v as string[]) || []).map((k) => fd.options.find((o) => o.key === k)?.label || k), other],
          };
        if (fd.hasUnknownToggle && f.weightUnknown) return { label, value: tr("ไม่ทราบ", "Not sure") };
        return { label, value: String(v || "") };
      };
      const own = visible.filter((fd) => !fd.key.startsWith(BATH_PREFIX)).map(row);
      const bath = visible.filter((fd) => fd.key.startsWith(BATH_PREFIX)).map(row);
      return [
        { title: f.catName, icon: "paw", rows: own },
        ...(bath.length ? [{ title: `${f.catName} · ${tr("ก่อนอาบน้ำ", "before grooming")}`, icon: "bath", rows: bath }] : []),
      ];
    });

  const save = async () => {
    if (forms.length === 0) return;
    setSaving(true);
    setSaveError("");
    try {
      // ส่งทีละตัว (ไม่ยิงพร้อมกัน) — ทุกตัวยืนยันนัดทั้งบ้านซ้ำกัน ยิงพร้อมกันจะชนกันเอง
      // ตัวที่บันทึกแล้วไม่ส่งซ้ำ · ตัวที่ไม่ผ่านบอกชื่อ + เหตุ ลูกค้า/ร้านจะได้รู้ว่าตัวไหน
      const failed: string[] = [];
      for (let i = 0; i < forms.length; i++) {
        const f = forms[i];
        if (f.saved) continue;
        const own: Answers = {};
        const bath: Answers = {};
        for (const [k, v] of Object.entries(f.answers)) {
          if (k.startsWith(BATH_PREFIX)) bath[k.slice(BATH_PREFIX.length)] = v;
          else own[k] = v;
        }
        let reason = "";
        try {
          const r = await fetch("/api/bookings/groom-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(catMode ? { catId: f.id } : { bookingId: f.id }),
              kind: isStay ? "stay" : "groom",
              ...(updateMode ? { update: true } : {}),
              lineUserId: profile?.lineUserId,
              info: {
                ...own,
                weight: f.weightUnknown ? "unknown" : own.weight || "",
              },
              ...(f.bath
                ? { groomInfo: { ...bath, weight: f.weightUnknown ? "unknown" : bath.weight || "" } }
                : {}),
            }),
          });
          const j = await r.json().catch(() => ({}));
          // 200 แต่ ok:false = เขียนลงฐานไม่สำเร็จ — ไม่นับว่าบันทึกแล้ว
          if (!r.ok || j.ok === false) reason = saveFailReason(r.status, j.error, en);
        } catch {
          reason = tr("อินเทอร์เน็ตหลุด", "internet connection lost");
        }
        if (reason) failed.push(`${f.catName} (${reason})`);
        else setForms((prev) => prev.map((x, k) => (k === i ? { ...x, saved: true } : x)));
      }
      if (failed.length > 0) {
        setSaveError(
          tr(
            `บันทึกไม่สำเร็จ: ${failed.join(", ")} — ลองกดบันทึกอีกครั้ง หรือแจ้งพนักงานที่ร้านได้เลยค่ะ`,
            `Couldn't save: ${failed.join(", ")} — please tap save again or let our staff know`,
          )
        );
        return;
      }
      // มาจากการ์ดรวมขอข้อมูล → ไปขั้นต่อไปเลย (สมุดวัคซีน / บัตร / กฎ) ไม่ปิดหน้า
      if (nextStep) {
        savedPopup(tr("บันทึกข้อมูลน้องสำเร็จ", "Saved"), [tr("ไปขั้นต่อไปกันเลยค่ะ", "On to the next step")], { afterNav: true });
        window.location.href = nextStep.href;
        return;
      }
      try {
        const liff = (await import("@line/liff")).default;
        if (liff.isInClient()) {
          liff.closeWindow();
          return;
        }
      } catch {
        /* เปิดนอก LINE — โชว์หน้าจอเสร็จแทน */
      }
      setReviewing(false);
      setDone(true);
      savedPopup(tr("บันทึกข้อมูลน้องสำเร็จ", "Saved"));
    } catch {
      setSaveError(tr("บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง หรือแจ้งพนักงานที่ร้านได้เลยค่ะ", "Couldn't save — please try again or let our staff know"));
    } finally {
      setSaving(false);
    }
  };

  const Chip = ({
    active,
    label,
    onClick,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[44px] rounded-full px-4 text-xs font-bold transition ${
        active ? "bg-latte-deep text-card shadow-petflow-sm" : "bg-paper text-brown-soft"
      }`}
    >
      {label}
    </button>
  );

  if (done) {
    return (
      <div className="px-4 pb-6 pt-10">
        <div className="rounded-petflow border border-petflow-line bg-card p-6 text-center shadow-petflow">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/25 text-ok">
          <Icon name="check" size={28} strokeWidth={2.4} />
        </span>
        <h1 className="mt-4 text-lg font-extrabold text-petflow-chocolate">
          {tr("ขอบคุณที่แจ้งประวัติน้องนะคะ!", "Thanks for telling us about your pet!")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-brown-soft">
          {tr(
            `เราจะดูแล${forms.map((f) => f.catName).join(", ") || "น้อง"}อย่างระมัดระวังที่สุด`,
            `We'll take great care of ${forms.map((f) => f.catName).join(", ") || "your pet"}`,
          )}{" "}
          {petWords(config).emoji}
          <br />
          {tr("กลับไปที่แชท LINE ได้เลยค่ะ", "You can go back to the LINE chat now")}
        </p>
        </div>
      </div>
    );
  }

  const inputClass =
    "min-h-[44px] w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2.5 text-sm";

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        eyebrow={isStay ? "Before your stay" : "Before grooming"}
        title={
          isStay
            ? forms.some((f) => f.bath)
              ? tr("ข้อมูลน้องก่อนเข้าพัก + อาบน้ำ", "Before your stay + grooming")
              : tr("ข้อมูลน้องก่อนเข้าพัก", "Before your stay")
            : tr("ประวัติน้องก่อนอาบน้ำ", "Before grooming")
        }
        back="/app"
        backLabel={tr("กลับหน้าแรก", "Back to home")}
        showLang={false}
      />
      <IntakeFlowBar mode="progress" />

      {loading ? (
        <LoadingScreen />
      ) : forms.length === 0 ? (
        <div className="rounded-petflow border border-petflow-line bg-card shadow-petflow-sm">
          <EmptyState
            icon="calendar"
            title={loadError || (catMode ? tr("ไม่พบข้อมูลน้องในบัญชี LINE นี้", "No pets found in this LINE account") : tr("ไม่พบข้อมูลการนัด", "Booking not found"))}
          />
        </div>
      ) : (
        <>
          {updateMode && (
            <p className="mb-3 flex items-start gap-1.5 rounded-petflow-sm bg-sage/15 px-3 py-2 text-xs font-bold text-petflow-chocolate">
              <Icon name="edit" size={14} className="mt-0.5 shrink-0" />
              {tr("ร้านขอให้ช่วยอัปเดตข้อมูลน้องให้เป็นปัจจุบันค่ะ — คำตอบเดิมใส่ไว้ให้แล้ว แก้เฉพาะข้อที่เปลี่ยน แล้วกดส่งได้เลย", "The shop asked you to update your pet's details — your previous answers are filled in, just change what's different and send")}
            </p>
          )}
          {forms.length > 1 && (
            <p className="flex items-center gap-1.5 rounded-petflow-sm bg-honey/20 px-3 py-2 text-xs font-bold text-petflow-chocolate">
              <Icon name="paw" size={14} />
              {tr(`มีน้อง ${forms.length} ตัว — รบกวนกรอกให้ครบทุกตัวนะคะ`, `${forms.length} pets — please fill in for each one`)}
            </p>
          )}

          {forms.map((f, idx) => {
            const missing = missingKeys(f);
            const hidden = f.showAnswered ? [] : f.answered.filter((k) => !missing.includes(k));
            const shown = f.fields.filter((fd) => !f.skip.includes(fd.key) && !hidden.includes(fd.key));
            return (
              <div
                key={f.id}
                className="mt-4 rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm"
              >
                <p className="flex items-center gap-2 text-sm font-extrabold text-petflow-chocolate">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-honey/25">
                    <span aria-hidden className="text-base">{f.emoji}</span>
                  </span>
                  {f.catName}
                </p>
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => copyFromFirst(idx)}
                    className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-petflow-sm border border-dashed border-latte/60 bg-honey/10 px-3 text-xs font-bold text-latte-deep"
                  >
                    <Icon name="copy" size={15} />
                    {tr(`ตอบเหมือน${forms[0].catName} (แก้เฉพาะข้อที่ต่างได้)`, `Same answers as ${forms[0].catName} (edit what's different)`)}
                  </button>
                )}
                {forms.length === 1 && shown.length > 0 && (
                  <p className="mt-1 text-xs text-brown-soft">
                    {tr("เพื่อความปลอดภัยของน้อง 🧡 กดเลือกสั้นๆ ไม่กี่ข้อ ให้เราเตรียมดูแลน้องได้ถูกวิธีนะคะ", "For your pet's safety 🧡 a few quick taps help us care for them the right way")}
                  </p>
                )}
                {hidden.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setForms((prev) => prev.map((x, i) => (i === idx ? { ...x, showAnswered: true } : x)))}
                    className="mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-petflow-sm bg-sage/15 px-3 text-left text-xs font-bold text-ok"
                  >
                    <Icon name="check" size={15} />
                    {shown.length === 0
                      ? tr("ข้อมูลน้องครบแล้วจากที่เคยกรอกไว้ กดส่งได้เลยค่ะ", "Everything's already filled in from before — you can send now")
                      : tr(`ข้อที่เคยตอบไว้แล้ว ${hidden.length} ข้อ ไม่ต้องตอบซ้ำค่ะ`, `${hidden.length} question(s) already answered — no need to repeat`)}
                    <span className="ml-auto shrink-0 text-brown-soft underline">{tr("แก้คำตอบเดิม", "Edit answers")}</span>
                  </button>
                )}

                {shown.map((fd) => {
                  const isMissing = attempted && missing.includes(fd.key);
                  const value = f.answers[fd.key];
                  return (
                    <div key={fd.key} id={`q-${idx}-${fd.key}`} className="scroll-mt-24">
                      {fd.key === f.fields.find((x) => x.key.startsWith(BATH_PREFIX))?.key && (
                        <div className="mt-5 border-t border-petflow-line pt-4">
                          <p className="flex items-center gap-1.5 text-sm font-extrabold text-petflow-chocolate">
                            <Icon name="bath" size={16} />
                            {tr("ก่อนอาบน้ำ (อาบก่อนกลับบ้าน)", "Before grooming (bath before going home)")}
                          </p>
                          <p className="mt-0.5 text-[11px] text-brown-faint">
                            {tr("น้องอาบน้ำก่อนกลับด้วย ขอถามเพิ่มอีกนิด ข้อที่ตอบไปแล้วด้านบนไม่ถามซ้ำค่ะ", "Your pet is also having a bath before going home — just a few more questions")}
                          </p>
                        </div>
                      )}
                      <p
                        className={`mt-3 mb-1.5 text-xs font-bold ${
                          isMissing ? "text-wait" : "text-brown-soft"
                        }`}
                      >
                        {fd.label}
                        {fd.required && " *"}
                        {!fd.required && !/ข้ามได้|ถ้ามี|หากมี|เว้นว่างได้|if none|if any/.test(fd.label) && (
                          <span className="font-normal text-brown-faint"> {tr("(ไม่บังคับ)", "(optional)")}</span>
                        )}
                        {isMissing &&
                          (fd.type === "multi"
                            ? tr(" — กรุณาเลือกอย่างน้อย 1 ข้อ", " — please pick at least one")
                            : fd.type === "single"
                              ? tr(" — กรุณาเลือก", " — please choose")
                              : tr(" — กรุณากรอก", " — please fill in"))}
                      </p>

                      {fd.type === "single" && (
                        <div className="flex flex-wrap gap-2">
                          {fd.options.map((o) => (
                            <Chip
                              key={o.key}
                              active={value === o.key}
                              label={o.label}
                              onClick={() => setAnswer(idx, fd.key, o.key)}
                            />
                          ))}
                        </div>
                      )}

                      {fd.type === "multi" && (
                        <div className="flex flex-wrap gap-2">
                          {fd.options.map((o) => (
                            <Chip
                              key={o.key}
                              active={((value as string[]) || []).includes(o.key)}
                              label={o.label}
                              onClick={() => toggleOption(idx, fd.key, o.key)}
                            />
                          ))}
                        </div>
                      )}

                      {fd.allowOther && (
                        <input
                          value={String(f.answers[otherKey(fd.key)] || "")}
                          onChange={(e) => setAnswer(idx, otherKey(fd.key), e.target.value)}
                          placeholder={tr("อื่นๆ พิมพ์เองได้ (ถ้ามี)", "Other — type your own (if any)")}
                          className={`mt-2 ${inputClass}`}
                        />
                      )}

                      {fd.type === "text" && (
                        <>
                          <input
                            value={f.weightUnknown && fd.hasUnknownToggle ? "" : String(value || "")}
                            onChange={(e) => setAnswer(idx, fd.key, e.target.value)}
                            disabled={fd.hasUnknownToggle && f.weightUnknown}
                            placeholder={fd.placeholder}
                            inputMode={fd.hasUnknownToggle ? "decimal" : undefined}
                            className={`${inputClass} disabled:bg-paper/50 disabled:text-brown-faint`}
                          />
                          {fd.hasUnknownToggle && (
                            <label className="mt-1 flex min-h-[44px] cursor-pointer items-center gap-2 text-xs font-bold text-brown-soft">
                              <input
                                type="checkbox"
                                checked={f.weightUnknown}
                                onChange={(e) =>
                                  setForms((prev) =>
                                    prev.map((x, i) =>
                                      i === idx
                                        ? { ...x, weightUnknown: e.target.checked }
                                        : x
                                    )
                                  )
                                }
                                className="h-5 w-5 accent-latte-deep"
                              />
                              {tr("ไม่ทราบน้ำหนัก", "Weight unknown")}
                            </label>
                          )}
                        </>
                      )}

                      {fd.type === "textarea" && (
                        <textarea
                          value={String(value || "")}
                          onChange={(e) => setAnswer(idx, fd.key, e.target.value)}
                          placeholder={fd.placeholder}
                          rows={2}
                          className={inputClass}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {saveError && (
            <p className="mt-4 flex gap-2 rounded-petflow-sm bg-wait/10 px-3 py-2 text-xs font-bold text-wait">
              <Icon name="alert" size={15} className="mt-px" />
              {saveError}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className={`mt-5 ${BTN_PRIMARY}`}
          >
            {!saving && <Icon name="send" size={18} />}
            {saving
              ? tr("กำลังบันทึก…", "Saving…")
              : nextStep
                ? tr(`บันทึก แล้วไปขั้นต่อไป: ${nextStep.label}`, `Save and continue: ${nextStep.label}`)
                : forms.length > 1
                  ? tr(`ส่งข้อมูลให้ร้าน (${forms.length} ตัว)`, `Send to the shop (${forms.length} pets)`)
                  : tr("ส่งข้อมูลให้ร้าน", "Send to the shop")}
          </button>
          <ReviewSheet
            open={reviewing}
            sections={reviewing ? reviewSections() : []}
            saving={saving}
            error={saveError}
            confirmLabel={
              nextStep
                ? tr("ยืนยัน แล้วไปขั้นต่อไป", "Confirm and continue")
                : forms.length > 1
                  ? tr(`ยืนยัน ส่งข้อมูล (${forms.length} ตัว)`, `Confirm & send (${forms.length} pets)`)
                  : tr("ยืนยัน ส่งข้อมูล", "Confirm & send")
            }
            onEdit={() => {
              setReviewing(false);
              setSaveError("");
            }}
            onConfirm={save}
          />
        </>
      )}
    </div>
  );
}

export default function GroomInfoPage() {
  return (
    <Suspense
      fallback={<LoadingScreen />}
    >
      <GroomInfoContent />
    </Suspense>
  );
}

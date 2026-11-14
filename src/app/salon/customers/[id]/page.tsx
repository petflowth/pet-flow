"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { baht, bkkDay, STATUS_LABEL, thaiDay, type Customer, type Visit } from "@/lib/salon/shared";
import { api, Btn, Card, ErrorBox, Field, Loading, Title, useBoot, useHref } from "@/components/salon/ui";
import { visitPrice } from "@/components/salon/VisitCard";

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const href = useHref();
  const { boot } = useBoot();
  const [c, setC] = useState<Customer | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api<{ customer: Customer; visits: Visit[] }>(`/api/salon/customers/${id}`);
      setC(r.customer);
      setVisits(r.visits);
      setForm({
        name: r.customer.name || "",
        nickname: r.customer.nickname || "",
        phone: r.customer.phone || "",
        allergies: r.customer.allergies || "",
        color_formula: r.customer.color_formula || "",
        notes: r.customer.notes || "",
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (!c) return error ? <ErrorBox text={error} /> : <Loading />;
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setError("");
    try {
      await api(`/api/salon/customers/${id}`, { method: "PATCH", body: form });
      setEdit(false);
      setMsg("บันทึกแล้ว");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const past = visits.filter((v) => v.status === "done");
  const upcoming = visits.filter((v) => !["done", "cancelled", "no_show"].includes(v.status));

  return (
    <div className="space-y-4">
      <Title back={href("/salon/customers")}>{c.name}</Title>
      {msg && <div className="rounded-2xl bg-[#dff3e6] p-3 text-[21px] font-bold text-[#155c35]">✅ {msg}</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Btn big tone="primary" href={href(`/salon/new?type=booking&customer=${c.id}&day=${boot?.today || ""}`)}>
          จองคิวให้คนนี้
        </Btn>
        {c.phone && (
          <a href={`tel:${c.phone}`} className="flex min-h-[80px] items-center justify-center rounded-2xl border-2 border-[#1f4e8c] bg-white text-[24px] font-bold text-[#1f4e8c]">
            📞 โทร {c.phone}
          </a>
        )}
      </div>

      {c.allergies && !edit && <ErrorBox text={`⚠️ แพ้: ${c.allergies}`} />}

      {edit ? (
        <Card className="space-y-3">
          <Field label="ชื่อ" value={form.name} onChange={set("name")} />
          <Field label="ชื่อเล่น" value={form.nickname} onChange={set("nickname")} />
          <Field label="เบอร์โทร" value={form.phone} onChange={(v) => set("phone")(v.replace(/\D/g, "").slice(0, 10))} inputMode="tel" />
          <Field label="แพ้อะไร (ยา/สารเคมี)" value={form.allergies} onChange={set("allergies")} />
          <Field label="สูตรสีที่ใช้" value={form.color_formula} onChange={set("color_formula")} multiline />
          <Field label="จดไว้" value={form.notes} onChange={set("notes")} multiline />
          <ErrorBox text={error} />
          <Btn tone="green" onClick={save}>
            บันทึก
          </Btn>
          <Btn tone="plain" onClick={() => setEdit(false)}>
            ยกเลิก
          </Btn>
        </Card>
      ) : (
        <Card>
          <Info k="ชื่อเล่น" v={c.nickname} />
          <Info k="เบอร์" v={c.phone} />
          <Info k="สูตรสี" v={c.color_formula} />
          <Info k="จดไว้" v={c.notes} />
          {boot?.settings.points.enabled && <Info k="แต้มสะสม" v={`${c.points} แต้ม`} />}
          {c.no_show_count > 0 && <Info k="ไม่มาตามนัด" v={`${c.no_show_count} ครั้ง`} />}
          <Btn className="mt-3" tone="plain" onClick={() => { setMsg(""); setEdit(true); }}>
            แก้ข้อมูล
          </Btn>
        </Card>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <div className="text-[22px] font-extrabold">นัดที่จะถึง</div>
          {upcoming.map((v) => (
            <HistoryRow key={v.id} v={v} href={href(`/salon/visit/${v.id}`)} />
          ))}
        </div>
      )}
      <div className="space-y-2">
        <div className="text-[22px] font-extrabold">เคยมาทำ ({past.length} ครั้ง)</div>
        {past.length === 0 && <div className="text-[20px] text-[#4b5563]">ยังไม่เคย</div>}
        {past.map((v) => (
          <HistoryRow key={v.id} v={v} href={href(`/salon/visit/${v.id}`)} />
        ))}
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v) return null;
  return (
    <div className="flex gap-3 border-b border-[#eceef1] py-2 last:border-0">
      <div className="w-28 shrink-0 text-[19px] text-[#4b5563]">{k}</div>
      <div className="whitespace-pre-wrap text-[21px]">{v}</div>
    </div>
  );
}

function HistoryRow({ v, href }: { v: Visit; href: string }) {
  return (
    <Card>
      <a href={href} className="block">
        <div className="flex justify-between gap-2 text-[20px] font-bold">
          <span>{thaiDay(bkkDay(v.start_at))}</span>
          <span>{STATUS_LABEL[v.status]}</span>
        </div>
        <div className="text-[19px] text-[#374151]">
          {v.services.map((s) => s.name).join(" + ")} · {baht(v.bill?.total ?? visitPrice(v))} ฿
        </div>
      </a>
    </Card>
  );
}

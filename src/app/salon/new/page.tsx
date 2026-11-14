"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { baht, busyPlan, depositFor, thaiDay, type Customer } from "@/lib/salon/shared";
import { api, Btn, Card, ErrorBox, Field, Loading, Title, useBoot, useHref } from "@/components/salon/ui";
import { CustomerPicker, ServicePicker, TimePicker, type PickedCustomer } from "@/components/salon/pickers";

type Step = "customer" | "services" | "time" | "confirm";

function NewVisit() {
  const { boot } = useBoot();
  const sp = useSearchParams();
  const router = useRouter();
  const href = useHref();
  const walkIn = sp.get("type") === "walkin";
  const steps: Step[] = walkIn ? ["services", "customer", "confirm"] : ["customer", "services", "time", "confirm"];

  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [serviceIds, setServiceIds] = useState<string[]>(() => (sp.get("services") || "").split(",").filter(Boolean));
  const [when, setWhen] = useState<{ day: string; time: string } | null>(null);
  const [now, setNow] = useState<{ free: boolean; time: string; next: string | null } | null>(null);
  const [note, setNote] = useState("");
  const [step, setStep] = useState<Step>(steps[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // มาจากหน้าลูกค้า/หลังจ่ายเงิน (นัดครั้งต่อไป) — ข้ามขั้นเลือกลูกค้า
  useEffect(() => {
    const id = sp.get("customer");
    if (!id) return;
    api<{ customer: Customer }>(`/api/salon/customers/${id}`)
      .then((r) => {
        setCustomer({ kind: "existing", customer: r.customer });
        setStep((s) => (s === "customer" ? (walkIn ? "confirm" : "services") : s));
      })
      .catch(() => {});
  }, [sp, walkIn]);

  const chosen = useMemo(
    () => serviceIds.map((id) => boot?.services.find((s) => s.id === id)).filter(Boolean) as NonNullable<typeof boot>["services"],
    [serviceIds, boot]
  );

  // walk-in: ดูว่าตอนนี้ว่างไหม
  useEffect(() => {
    if (!walkIn || step !== "confirm" || !chosen.length) return;
    setNow(null);
    api<{ now: typeof now }>(`/api/salon/availability?services=${serviceIds.join(",")}`)
      .then((r) => setNow(r.now))
      .catch((e) => setError(e.message));
  }, [walkIn, step, chosen.length, serviceIds]);

  if (!boot) return <Loading />;

  const total = chosen.reduce((a, s) => a + Number(s.price), 0);
  const minutes = busyPlan(0, chosen).end;
  const deposit = walkIn ? 0 : depositFor(boot.settings, chosen);
  const go = (s: Step) => {
    setError("");
    setStep(s);
    window.scrollTo(0, 0);
  };
  const nextOf = (s: Step) => steps[steps.indexOf(s) + 1];
  const prevOf = (s: Step) => steps[steps.indexOf(s) - 1];

  const custName =
    customer?.kind === "existing"
      ? customer.customer.name
      : customer?.kind === "new"
        ? customer.name || customer.phone
        : "ไม่ระบุชื่อ";

  const save = async (wait = false, time?: string) => {
    setSaving(true);
    setError("");
    try {
      const r = await api<{ id: string }>("/api/salon/visits", {
        body: {
          source: walkIn ? "walk_in" : "booking",
          day: when?.day,
          time: walkIn ? time : when?.time,
          wait,
          service_ids: serviceIds,
          customer_id: customer?.kind === "existing" ? customer.customer.id : undefined,
          new_customer: customer?.kind === "new" ? { name: customer.name, phone: customer.phone } : undefined,
          note,
        },
      });
      router.replace(walkIn ? href("/salon") : href(`/salon/visit/${r.id}?saved=1`));
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const back = prevOf(step);
  return (
    <div className="space-y-4">
      <Title back={back ? undefined : href("/salon")}>{walkIn ? "ลูกค้าเดินเข้า" : "จองคิว"}</Title>
      {back && (
        <Btn tone="plain" onClick={() => go(back)}>
          ‹ ย้อนกลับ
        </Btn>
      )}
      <div className="text-[19px] font-bold text-[#4b5563]">
        ขั้นที่ {steps.indexOf(step) + 1} จาก {steps.length}
      </div>

      {step === "customer" && (
        <>
          <h2 className="text-[24px] font-extrabold">ลูกค้าคือใคร?</h2>
          <CustomerPicker
            allowGuest={walkIn}
            onPick={(c) => {
              setCustomer(c);
              go(nextOf("customer"));
            }}
          />
        </>
      )}

      {step === "services" && (
        <>
          <h2 className="text-[24px] font-extrabold">ทำอะไรบ้าง? (เลือกได้หลายอย่าง)</h2>
          <ServicePicker services={boot.services} selected={serviceIds} onChange={setServiceIds} />
          <div className="sticky bottom-[84px] z-10 rounded-2xl bg-white p-3 shadow-lg">
            <div className="mb-2 text-center text-[20px] font-bold">
              {chosen.length ? `${chosen.length} อย่าง · ${baht(total)} ฿ · ประมาณ ${minutes} นาที` : "ยังไม่ได้เลือก"}
            </div>
            <Btn tone="green" disabled={!chosen.length} onClick={() => go(nextOf("services"))}>
              ต่อไป
            </Btn>
          </div>
        </>
      )}

      {step === "time" && (
        <>
          <h2 className="text-[24px] font-extrabold">มาวันไหน กี่โมง?</h2>
          <TimePicker
            today={boot.today}
            initialDay={sp.get("day") || undefined}
            query={`services=${serviceIds.join(",")}`}
            onPick={(day, time) => {
              setWhen({ day, time });
              go("confirm");
            }}
          />
        </>
      )}

      {step === "confirm" && (
        <>
          <h2 className="text-[24px] font-extrabold">ตรวจดูก่อนบันทึก</h2>
          <Card>
            <Row k="ลูกค้า" v={custName} />
            {customer?.kind === "new" && customer.phone && <Row k="เบอร์" v={customer.phone} />}
            <Row k="บริการ" v={chosen.map((s) => s.name).join(" + ")} />
            <Row k="ราคา" v={`${chosen.some((s) => s.price_from) ? "เริ่ม " : ""}${baht(total)} ฿`} />
            {when && <Row k="วันเวลา" v={`${thaiDay(when.day)} ${when.time} น.`} />}
            {deposit > 0 && <Row k="มัดจำ" v={`ควรเก็บ ${baht(deposit)} ฿`} />}
          </Card>
          {customer?.kind === "existing" && customer.customer.allergies && (
            <ErrorBox text={`⚠️ ลูกค้าแพ้: ${customer.customer.allergies}`} />
          )}
          <Field label="หมายเหตุ (ไม่ใส่ก็ได้)" value={note} onChange={setNote} />
          <ErrorBox text={error} />
          {walkIn ? (
            !now ? (
              <Loading />
            ) : now.free ? (
              <Btn big tone="green" disabled={saving} onClick={() => save(false, now.time)}>
                เริ่มทำเลย
              </Btn>
            ) : (
              <>
                <div className="rounded-2xl bg-[#fff4d6] p-4 text-[21px] font-bold text-[#7a5200]">
                  ตอนนี้ยังติดคิวอื่น {now.next ? `ว่างอีกทีเวลา ${now.next} น.` : "วันนี้เต็มแล้ว"}
                </div>
                {now.next && (
                  <Btn big tone="primary" disabled={saving} onClick={() => save(true, now.next!)}>
                    ให้รอคิว ({now.next} น.)
                  </Btn>
                )}
              </>
            )
          ) : (
            <Btn big tone="green" disabled={saving || !when} onClick={() => save()}>
              บันทึกการจอง
            </Btn>
          )}
        </>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3 border-b border-[#eceef1] py-2 last:border-0">
      <div className="w-24 shrink-0 text-[19px] text-[#4b5563]">{k}</div>
      <div className="text-[21px] font-bold">{v}</div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <NewVisit />
    </Suspense>
  );
}

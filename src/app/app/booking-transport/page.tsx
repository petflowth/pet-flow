"use client";

import { savedPopup } from "@/components/Toast";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiff } from "@/components/LiffProvider";
import { formatDateShort } from "@/lib/format-thai-date";
import { LoadingScreen } from "@/components/LoadingScreen";
import { BTN_PRIMARY, PageHeader } from "@/components/PageHeader";
import { EmptyState, SectionLabel } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { ReviewSheet } from "@/components/ReviewSheet";
import { useTr, useLocale } from "@/components/LocaleProvider";

type Bk = {
  id: string;
  catName: string;
  service: string;
  date?: string;
  time?: string;
  checkin?: string;
  checkout?: string;
  pickup: boolean;
  dropoff: boolean;
  /** บริการที่บ้าน — ช่างไปหา (ไม่ใช่รับ-ส่ง) */
  atHome?: boolean;
  pickupTime?: string;
  dropoffTime?: string;
  mapUrl?: string;
  address?: string;
  saved: boolean;
};

const field =
  "w-full min-w-0 rounded-xl border border-petflow-line bg-paper px-3 py-3 text-sm text-brown placeholder:text-brown-faint";

/** ลูกค้ากรอกจุดรับ-ส่งน้องก่อนวันนัด — วางลิงก์ Google Maps หรือกดใช้ตำแหน่งปัจจุบัน */
function BookingTransportContent() {
  const { locale } = useLocale();
  const tr = useTr();
  const sp = useSearchParams();
  const id = sp.get("id") || "";
  const kindHome = sp.get("kind") === "home";
  const { profile } = useLiff();

  const [bk, setBk] = useState<Bk | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapUrl, setMapUrl] = useState("");
  const [address, setAddress] = useState("");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // ป๊อปอัปสรุปให้เช็คก่อนส่งจริง
  const [reviewing, setReviewing] = useState(false);
  // บริการที่บ้าน: หน้าเดียวกัน แต่ถามเป็น "ที่อยู่บ้าน" แทน "จุดรับ-ส่ง"
  const home = bk ? !!bk.atHome : kindHome;
  const spot = home ? tr("ที่อยู่บ้าน", "home address") : tr("จุดรับ-ส่ง", "pick-up/drop-off point");

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const q = new URLSearchParams({ id });
    if (profile?.lineUserId) q.set("lineUserId", profile.lineUserId);
    fetch(`/api/bookings/transport?${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.found) return;
        setBk(d.booking);
        setMapUrl(d.booking.mapUrl || "");
        setAddress(d.booking.address || "");
      })
      .finally(() => setLoading(false));
  }, [id, profile?.lineUserId]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError(tr("เครื่องนี้ส่งตำแหน่งไม่ได้ — วางลิงก์ Google Maps แทนได้เลยค่ะ", "This device can't share its location. Paste a Google Maps link instead."));
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMapUrl(`https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`);
        setLocating(false);
      },
      () => {
        setError(tr("ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง — วางลิงก์ Google Maps แทนได้เลยค่ะ", "Location permission not given. Paste a Google Maps link instead."));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  /** กดส่ง → เช็คว่ามีอย่างน้อย 1 ช่อง แล้วโชว์สรุปก่อน */
  const review = () => {
    if (!mapUrl.trim() && !address.trim()) {
      setError(tr("ใส่ลิงก์ Google Maps หรือที่อยู่อย่างน้อย 1 ช่องนะคะ", "Please enter a Google Maps link or an address."));
      return;
    }
    setError("");
    setReviewing(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/bookings/transport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: id,
          mapUrl: mapUrl.trim(),
          address: address.trim(),
          lineUserId: profile?.lineUserId,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setReviewing(false);
        setDone(true);
        savedPopup(tr("ส่งตำแหน่งสำเร็จ", "Location sent"), [home ? tr("ร้านได้รับที่อยู่บ้านแล้วค่ะ", "The shop has your home address.") : tr("ร้านได้รับที่อยู่รับ-ส่งแล้วค่ะ", "The shop has your pick-up/drop-off address.")]);
      } else {
        setError(
          d.error === "bad_url"
            ? tr("ลิงก์ไม่ถูกต้อง — คัดลอกลิงก์จากปุ่มแชร์ใน Google Maps มาวางได้เลยค่ะ", "Invalid link. Copy the link from the Share button in Google Maps.")
            : tr("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง หรือส่งตำแหน่งในแชท LINE ได้เลยค่ะ", "Couldn't save. Try again, or send your location in the LINE chat.")
        );
      }
    } catch {
      setError(tr("เชื่อมต่อไม่สำเร็จ — เช็คสัญญาณอินเทอร์เน็ตแล้วลองใหม่นะคะ", "Connection failed. Check your internet and try again."));
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    try {
      const liff = (await import("@line/liff")).default;
      if (liff.isInClient()) liff.closeWindow();
    } catch {
      /* ไม่ได้เปิดใน LINE */
    }
  };

  if (done) {
    return (
      <div className="px-4 pb-6 pt-10">
        <div className="rounded-petflow border border-petflow-line bg-card p-6 text-center shadow-petflow">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/25 text-ok">
            <Icon name="check" size={28} strokeWidth={2.4} />
          </span>
          <h1 className="mt-4 text-lg font-extrabold text-petflow-chocolate">{tr(`ได้รับ${spot}แล้วค่ะ`, `We've received your ${spot}`)}</h1>
          <p className="mt-2 text-sm leading-relaxed text-brown-soft">
            {tr("พี่เลี้ยงจะติดต่อก่อนออกเดินทางนะคะ", "Our team will contact you before setting off.")}
            <br />
            {tr("กลับไปที่แชท LINE ได้เลยค่ะ", "You can go back to the LINE chat now.")}
          </p>
          <button type="button" onClick={finish} className={`mt-5 ${BTN_PRIMARY}`}>
            {tr("กลับไปที่แชท", "Back to chat")}
          </button>
        </div>
      </div>
    );
  }

  const isRoom = bk?.service === "room";
  const legs = bk
    ? [
        bk.pickup && {
          label: tr("รับน้อง", "Pick-up"),
          date: isRoom ? bk.checkin : bk.date,
          time: bk.pickupTime || (isRoom ? undefined : bk.time),
        },
        bk.dropoff && {
          label: tr("ส่งน้องกลับบ้าน", "Drop-off home"),
          date: isRoom ? bk.checkout : bk.date,
          time: bk.dropoffTime,
        },
        bk.atHome && {
          label: tr("ช่างไปบริการที่บ้าน", "Groomer visits your home"),
          date: bk.date,
          time: bk.time,
        },
      ].filter((x): x is { label: string; date: string | undefined; time: string | undefined } => !!x)
    : [];

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        eyebrow={home ? "Home service" : "Pick-up & drop-off"}
        title={home ? tr("ที่อยู่บ้านสำหรับบริการที่บ้าน", "Home address for at-home service") : tr("จุดรับ-ส่งน้อง", "Pick-up/drop-off point")}
        back="/app"
        backLabel={tr("กลับหน้าแรก", "Back to home")}
        showLang={false}
      />

      {loading ? (
        <LoadingScreen />
      ) : !bk ? (
        <div className="rounded-petflow border border-petflow-line bg-card shadow-petflow-sm">
          <EmptyState icon="calendar" title={tr("ไม่พบข้อมูลการจอง", "Booking not found")} />
        </div>
      ) : !bk.pickup && !bk.dropoff && !bk.atHome ? (
        <div className="rounded-petflow border border-petflow-line bg-card shadow-petflow-sm">
          <EmptyState icon="car" title={tr("นัดนี้ไม่ได้ใช้บริการรับ-ส่ง", "This booking has no pick-up/drop-off")} sub={tr("ถ้าต้องการรับ-ส่ง ทักแชท LINE ได้เลยค่ะ", "Need pick-up/drop-off? Message us on LINE.")} />
        </div>
      ) : (
        <>
          <div className="rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm">
            <p className="flex items-center gap-2 text-sm font-extrabold text-petflow-chocolate">
              <Icon name="paw" size={18} />
              {bk.catName}
            </p>
            <ul className="mt-3 space-y-2">
              {legs.map((l) => (
                <li key={l.label} className="flex items-center gap-2.5 rounded-xl bg-paper px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-honey/30 text-petflow-chocolate">
                    <Icon name={home ? "home" : "car"} size={16} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-bold text-brown">{l.label}</span>
                  <span className="shrink-0 text-xs text-brown-soft">
                    {l.date ? formatDateShort(l.date, locale) : "—"}
                    {l.time ? ` · ${l.time}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <section className="mt-5">
            <SectionLabel>Location · {spot}</SectionLabel>
            <div className="space-y-3 rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm">
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={locating}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-honey/40 px-3 text-sm font-extrabold text-petflow-chocolate disabled:opacity-50"
              >
                <Icon name="pin" size={18} />
                {locating ? tr("กำลังหาตำแหน่ง…", "Finding location…") : tr("ใช้ตำแหน่งที่อยู่ตอนนี้", "Use my current location")}
              </button>

              <div>
                <p className="mb-1.5 text-xs font-bold text-brown-soft">{tr("หรือวางลิงก์ Google Maps", "Or paste a Google Maps link")}</p>
                <input
                  value={mapUrl}
                  onChange={(e) => setMapUrl(e.target.value)}
                  placeholder="https://maps.app.goo.gl/…"
                  inputMode="url"
                  className={field}
                />
                <p className="mt-1 text-[11px] text-brown-faint">
                  {tr("เปิด Google Maps › ปักหมุด › แชร์ › คัดลอกลิงก์ แล้วนำมาวางที่นี่", "Open Google Maps › drop a pin › Share › Copy link, then paste it here")}
                </p>
                {mapUrl.trim() && /^https?:\/\//.test(mapUrl.trim()) && (
                  <a
                    href={mapUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-latte-deep underline-offset-2 hover:underline"
                  >
                    <Icon name="link" size={13} />
                    {tr("เปิดดูแผนที่ที่ใส่ไว้", "Open the map you entered")}
                  </a>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-xs font-bold text-brown-soft">{tr("ที่อยู่ / จุดสังเกต (ถ้ามี)", "Address / landmark (optional)")}</p>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  placeholder={tr("เช่น หมู่บ้าน… ซอย… บ้านรั้วสีขาว / คอนโดตึก B ฝากรปภ.ได้", "e.g. village, street, white gate / condo building B, leave with security")}
                  className={field}
                />
              </div>

              {error && (
                <p className="rounded-xl bg-wait/10 px-3 py-2 text-xs font-bold text-wait">{error}</p>
              )}

              <button type="button" disabled={saving} onClick={review} className={BTN_PRIMARY}>
                {saving ? tr("กำลังบันทึก…", "Saving…") : bk.saved ? tr("บันทึกการแก้ไข", "Save changes") : tr(`ส่ง${spot}`, `Send ${spot}`)}
              </button>
              <ReviewSheet
                open={reviewing}
                sections={[
                  {
                    title: `${spot}${bk.catName ? ` · ${bk.catName}` : ""}`,
                    icon: "car",
                    rows: [
                      ...legs.map((l) => ({
                        label: l.label,
                        value: [l.date ? formatDateShort(l.date, locale) : "", l.time || ""].filter(Boolean).join(" "),
                      })),
                      { label: tr("ลิงก์ Google Maps", "Google Maps link"), value: mapUrl.trim() },
                      { label: tr("ที่อยู่ / จุดสังเกต", "Address / landmark"), value: address.trim() },
                    ],
                  },
                ]}
                saving={saving}
                error={error}
                confirmLabel={bk.saved ? tr("ยืนยัน บันทึกการแก้ไข", "Confirm changes") : tr(`ยืนยัน ส่ง${spot}`, `Confirm and send ${spot}`)}
                onEdit={() => {
                  setReviewing(false);
                  setError("");
                }}
                onConfirm={save}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function BookingTransportPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <BookingTransportContent />
    </Suspense>
  );
}

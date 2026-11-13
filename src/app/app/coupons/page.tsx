"use client";

import { useEffect, useState } from "react";
import { useLiff } from "@/components/LiffProvider";
import { useConfig } from "@/components/ConfigProvider";
import { LoadingScreen } from "@/components/LoadingScreen";
import { BTN_PRIMARY, BTN_SECONDARY, PageHeader } from "@/components/PageHeader";
import { EmptyState, SectionLabel } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { isFeatureOn } from "@/lib/features";
import { referralReward } from "@/lib/referral";
import { copyText, lineShareUrl } from "@/lib/copy-text";
import { useTr, useLocale } from "@/components/LocaleProvider";

type Coupon = {
  id: string;
  code: string;
  amount: number;
  reason: string;
  status: "active" | "used" | "expired";
  expiresAt?: string;
};

function daysLeft(iso?: string) {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return d;
}

export default function CouponsPage() {
  const { locale } = useLocale();
  const tr = useTr();
  const { ready, profile, customer } = useLiff();
  const { config } = useConfig();
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [referralUrl, setReferralUrl] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [copied, setCopied] = useState(false);
  // คัดลอกไม่ได้ (เบราว์เซอร์ในแอปบางรุ่น) → โชว์ลิงก์ให้กดค้างคัดลอกเอง
  const [copyFailed, setCopyFailed] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [packages, setPackages] = useState<
    { id: string; name: string; totalUses: number; usedUses: number }[]
  >([]);
  const [voucher, setVoucher] = useState<Coupon | null>(null);

  useEffect(() => {
    if (!profile?.lineUserId) return;
    // คูปองผูกด้วย customerId (ตัวที่แอปรู้อยู่แล้ว) ถ้ามี — ตรงกันทุกอุปกรณ์ ไม่แตกตาม
    // LINE ID ที่สลับไปมา · no-store กัน webview เก็บผลเก่าไว้โชว์ค้าง
    const couponWho = customer?.id
      ? `customerId=${customer.id}`
      : `lineUserId=${profile.lineUserId}`;
    fetch(`/api/coupons?${couponWho}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setLoadError(d.error || tr("โหลดคูปองไม่สำเร็จ ลองเปิดหน้านี้ใหม่อีกครั้งนะคะ", "Couldn't load coupons. Please reopen this page."));
          return;
        }
        setLoadError("");
        if (!d.found) return;
        setCoupons(d.coupons || []);
        setReferralUrl(d.referralUrl || "");
        setReferralCode(d.referralCode || "");
      })
      .catch(() => setLoadError(tr("โหลดคูปองไม่สำเร็จ ลองเปิดหน้านี้ใหม่อีกครั้งนะคะ", "Couldn't load coupons. Please reopen this page.")))
      .finally(() => setLoading(false));
    // คอร์ส: API บังคับใช้ lineUserId (กันเดา id คนอื่น) — ยิงด้วย lineUserId ของตัวเอง
    fetch(`/api/packages?lineUserId=${profile.lineUserId}&active=1`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPackages(d.packages || []))
      .catch(() => {});
  }, [profile?.lineUserId, customer?.id]);

  // ร้านปิด "ชวนเพื่อนรับคูปอง" ในตั้งค่า — ไม่โชว์กล่องชวนเพื่อน
  const referralOn = isFeatureOn(config, "referral");
  const reward = referralReward(config).amount;
  const shareText = tr(`🐾 มาใช้บริการที่ ${config.business.name} กันนะ! สมัครผ่านลิงก์นี้ (หรือกรอกโค้ด ${referralCode} ตอนสมัคร) รับคูปองส่วนลด ${reward}฿ ทั้งคู่ทันที 🎁\n${referralUrl}`, `🐾 Come try ${config.business.name}! Sign up with this link (or enter code ${referralCode}) and we both get a ${reward}฿ coupon 🎁\n${referralUrl}`);

  const share = async () => {
    if (await copyText(shareText)) {
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setCopied(false);
      setCopyFailed(true);
    }
  };

  const active = coupons.filter((c) => c.status === "active");
  const past = coupons.filter((c) => c.status !== "active");

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        eyebrow="Wallet"
        title={tr("กระเป๋าคูปองของฉัน", "My coupon wallet")}
        back="/app"
        backLabel={tr("กลับหน้าแรก", "Back to home")}
        showLang={false}
      />

      {/* ── ชวนเพื่อน ── */}
      {referralOn && (
      <div className="rounded-petflow border border-honey/50 bg-gradient-to-br from-honey/25 via-card to-latte/15 p-4 shadow-petflow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-honey/40 text-petflow-chocolate">
            <Icon name="users" size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-petflow-chocolate">{tr(`ชวนเพื่อน รับคนละ ${reward}฿`, `Invite friends, you each get ${reward}฿`)}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-brown-soft">
              {locale === "en" ? (
                <>Send your link or code to a friend. When they <b className="text-latte-deep">sign up</b>, <b className="text-latte-deep">you both get a {reward}฿</b> coupon 🧡</>
              ) : (
                <>ส่งลิงก์หรือโค้ดให้เพื่อน <b className="text-latte-deep">สมัครเสร็จ</b> — ได้คูปองส่วนลด <b className="text-latte-deep">{reward}฿ ทั้งคุณและเพื่อน</b> ทันที 🧡</>
              )}
            </p>
          </div>
        </div>
        {referralCode && (
          <p className="mt-3 text-[11px] font-bold text-brown-soft">
            {tr("รหัสของคุณ", "Your code")}: <span className="rounded bg-paper px-2 py-0.5 font-extrabold text-petflow-chocolate">{referralCode}</span>
          </p>
        )}
        <button
          type="button"
          onClick={share}
          disabled={!referralUrl}
          className={`mt-3 ${BTN_PRIMARY}`}
        >
          <Icon name={copied ? "check" : "link"} size={18} />
          {copied ? tr("คัดลอกลิงก์แล้ว — เอาไปส่งเพื่อนได้เลย!", "Link copied. Send it to your friends!") : tr("คัดลอกลิงก์ชวนเพื่อน", "Copy invite link")}
        </button>
        {referralUrl && (
          <a
            href={lineShareUrl(shareText)}
            className="mt-2 flex items-center justify-center gap-1.5 text-xs font-extrabold text-latte-deep underline-offset-2 active:underline"
          >
            <Icon name="send" size={14} />
            {tr("หรือส่งให้เพื่อนในแชท LINE เลย", "Or send it to a friend in LINE")}
          </a>
        )}
        {copyFailed && referralUrl && (
          <div className="mt-2 rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2">
            <p className="text-[11px] font-bold text-brown-soft">{tr("เครื่องนี้คัดลอกอัตโนมัติไม่ได้ — กดค้างที่ลิงก์เพื่อคัดลอกนะคะ", "This device can't copy automatically. Long-press the link to copy it.")}</p>
            <p className="mt-1 select-all break-all text-xs font-bold text-petflow-chocolate">{referralUrl}</p>
          </div>
        )}
        {loadError && (
          <p className="mt-2 text-[11px] font-bold text-red-600">{loadError}</p>
        )}
      </div>
      )}
      {!referralOn && loadError && (
        <p className="text-[11px] font-bold text-red-600">{loadError}</p>
      )}

      {/* ── คอร์ส/แพ็กเกจ ── */}
      {packages.length > 0 && (
        <section className="mt-6">
          <SectionLabel>{tr("Packages · คอร์สของฉัน", "My packages")}</SectionLabel>
          <ul className="divide-y divide-petflow-line overflow-hidden rounded-petflow border border-petflow-line bg-card shadow-petflow-sm">
            {packages.map((p) => {
              const left = p.totalUses - p.usedUses;
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-sage/25 text-ok">
                    <span className="text-lg font-extrabold leading-none">{left}</span>
                    <span className="text-[9px] font-bold">{tr("เหลือ", "left")}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-petflow-chocolate">{p.name}</p>
                    <p className="text-[11px] text-brown-soft">
                      {tr(`ใช้ไป ${p.usedUses} จาก ${p.totalUses} ครั้ง`, `Used ${p.usedUses} of ${p.totalUses}`)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── คูปอง ── */}
      {!ready || loading ? (
        <LoadingScreen />
      ) : (
        <>
          <section className="mt-6">
            <SectionLabel>{tr(`Coupons · ใช้ได้ (${active.length})`, `Coupons · available (${active.length})`)}</SectionLabel>
            <div className="overflow-hidden rounded-petflow border border-petflow-line bg-card shadow-petflow-sm">
              {active.length === 0 ? (
                <EmptyState
                  icon="ticket"
                  title={tr("ยังไม่มีคูปอง", "No coupons yet")}
                  sub={referralOn ? tr(`ชวนเพื่อนสมัครด้วยโค้ดของคุณ รับ ${reward}฿ ทั้งคู่เลยนะคะ 🧡`, `Invite friends with your code and you both get ${reward}฿ 🧡`) : tr("มีคูปองเมื่อไหร่ จะขึ้นที่นี่นะคะ 🧡", "Your coupons will show up here 🧡")}
                />
              ) : (
                <ul className="divide-y divide-petflow-line">
                  {active.map((c) => {
                    const dl = daysLeft(c.expiresAt);
                    return (
                      <li key={c.id}>
                        {/* แตะทั้งแถว = เปิดคูปองให้พนักงานดู */}
                        <button
                          type="button"
                          onClick={() => setVoucher(c)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-paper"
                        >
                          <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-latte-deep text-card">
                            <span className="text-sm font-extrabold leading-none">฿{c.amount}</span>
                            <span className="text-[9px]">{tr("ส่วนลด", "off")}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-extrabold text-petflow-chocolate">{c.reason}</p>
                            <p className="text-[11px] text-brown-soft">
                              {tr("โค้ด", "Code")} {c.code}
                              {dl != null ? tr(` · หมดอายุใน ${dl} วัน`, ` · expires in ${dl} day(s)`) : ""}
                            </p>
                          </div>
                          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-honey/35 px-3 py-1.5 text-xs font-extrabold text-petflow-chocolate">
                            {tr("ใช้", "Use")}
                            <Icon name="chevron" size={14} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {past.length > 0 && (
            <section className="mt-6">
              <SectionLabel>{tr("History · ใช้แล้ว / หมดอายุ", "History · used / expired")}</SectionLabel>
              <ul className="divide-y divide-petflow-line overflow-hidden rounded-petflow border border-petflow-line bg-card/70">
                {past.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3 opacity-70">
                    <span className="w-12 shrink-0 text-center text-sm font-extrabold text-brown-faint">฿{c.amount}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-brown-soft">{c.reason}</span>
                    <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold text-brown-faint">
                      {c.status === "used" ? tr("ใช้แล้ว", "Used") : tr("หมดอายุ", "Expired")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* วอเชอร์ — แสดงให้พนักงานตอนคิดเงิน */}
      {voucher && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setVoucher(null)}
        >
          <div
            className="max-h-[90dvh] w-full max-w-xs overflow-y-auto rounded-petflow bg-card p-6 text-center shadow-petflow"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">Coupon</p>
            <p className="mt-1 text-5xl font-extrabold text-latte-deep">฿{voucher.amount}</p>
            <p className="mt-1 text-sm font-bold text-brown">{voucher.reason}</p>
            <div className="mt-4 rounded-petflow-sm border-2 border-dashed border-latte/50 bg-paper py-3">
              <p className="text-[10px] font-bold text-brown-soft">{tr("รหัสคูปอง", "Coupon code")}</p>
              <p className="text-2xl font-extrabold tracking-widest text-petflow-chocolate">
                {voucher.code}
              </p>
            </div>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold text-petflow-chocolate">
              <Icon name="eye" size={15} />
              {tr("แสดงหน้านี้ให้พนักงานตอนคิดเงิน", "Show this screen to staff when paying")}
            </p>
            <p className="mt-1 text-[11px] text-brown-faint">
              {tr("พนักงานจะกดใช้คูปองให้ตอนออกบิลค่ะ (คูปองจะถูกใช้เมื่อคิดเงินเท่านั้น)", "Staff will apply the coupon on your bill (it's only used at checkout).")}
            </p>
            <p className="mt-1 text-[11px] font-bold text-brown-faint">
              {tr("*ใช้ได้ 1 คูปอง / 1 บิลเท่านั้น", "*One coupon per bill")}
            </p>
            <button
              type="button"
              onClick={() => setVoucher(null)}
              className={`mt-5 ${BTN_SECONDARY}`}
            >
              {tr("ปิด", "Close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

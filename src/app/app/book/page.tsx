"use client";

import { savedPopup } from "@/components/Toast";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiff } from "@/components/LiffProvider";
import { useConfig } from "@/components/ConfigProvider";
import { configForBranch, knownBranchId, mainBranchId, roomsOfBranch, shopBranches } from "@/lib/branches";
import { EMPTY_HOME_CHOICE, HomeServiceChooser, homeChoiceReady, type HomeChoice } from "@/components/HomeServiceChooser";
import { homeMassageAllowed, homeServiceOn } from "@/lib/home-service";

/** จำสาขาที่ลูกค้าเลือกล่าสุด (ในเครื่องลูกค้า) */
const LAST_BRANCH_KEY = "pf-last-branch";
import { isFeatureOn } from "@/lib/features";
import { PageHeader } from "@/components/PageHeader";
import { isSelfBookableRoom } from "@/lib/self-bookable-rooms";
import {
  bathPrograms,
  programFitsSpecies,
  programsForSpecies,
  resolveGroomPrograms,
  resolveMassagePrograms,
} from "@/lib/grooming-prices";
import { extraCatChargePerNight } from "@/lib/business";
import { roomPricing } from "@/lib/room-board";
import {
  SEASON_LABEL,
  normalizeRoomSeasons,
  seasonalNightPrice,
  seasonsActive,
  splitStayBySeason,
} from "@/lib/room-seasons";
import { toJpegDataUrl } from "@/lib/image-convert";
import { PetPickList, type PetPickItem } from "@/components/PetPickList";
import { PetProgramSelect } from "@/components/GroomProgramPicker";
import { petWords, speciesOf } from "@/lib/pet-kind";
import { customerFetch } from "@/lib/customer-fetch";
import { useTr } from "@/components/LocaleProvider";

type Service = "groom" | "room";

type GroomSlot = { time: string; capacity: number; booked: number; remaining: number; endTime?: string };
type RoomAvail = { capacity: number; booked: number; remaining: number; closed: boolean } | null;
type DepositInfo = {
  amount: number;
  qr?: string;
  promptpay?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * พรีวิวฝั่งลูกค้า (ก๊อปจาก src/lib/availability.ts — คัดลอกมาเพื่อไม่ต้อง import โมดูลฝั่งเซิร์ฟเวอร์
 * เข้ามาในไคลเอนต์) แมวตัวแรกลงเวลาที่เลือก เต็มแล้วตัวถัดไปไหลไปสล็อตถัดไปอัตโนมัติ
 */
function assignGroomSlots(
  slots: { time: string; remaining: number }[],
  startTime: string,
  count: number
): string[] | null {
  const startIdx = slots.findIndex((s) => s.time === startTime);
  if (startIdx === -1 || count <= 0) return null;
  const assigned: string[] = [];
  for (let i = startIdx; i < slots.length && assigned.length < count; i++) {
    let avail = slots[i].remaining;
    while (avail > 0 && assigned.length < count) {
      assigned.push(slots[i].time);
      avail--;
    }
  }
  return assigned.length === count ? assigned : null;
}

export default function BookPage() {
  const tr = useTr();
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-brown-soft">{tr("กำลังโหลด…", "Loading…")}</p>}>
      <BookPageInner />
    </Suspense>
  );
}

function BookPageInner() {
  const tr = useTr();
  const params = useSearchParams();
  const { customer, profile, ready } = useLiff();
  const { config } = useConfig();
  const pw = petWords(config);
  // ร้านหลายสาขา: ลูกค้าเลือกสาขาก่อน แล้วเห็นคิวว่าง/ห้องของสาขานั้น · จำสาขาที่ใช้ล่าสุดไว้ในเครื่อง
  const branches = useMemo(() => shopBranches(config), [config]);
  const multiBranch = branches.length >= 2;
  const [branch, setBranch] = useState("");
  useEffect(() => {
    if (!multiBranch) return;
    let saved = "";
    try {
      saved = localStorage.getItem(LAST_BRANCH_KEY) || "";
    } catch {
      /* เปิดในโหมดที่ใช้ localStorage ไม่ได้ — เริ่มที่สาขาแรก */
    }
    setBranch((cur) => knownBranchId(config, cur) || knownBranchId(config, saved) || mainBranchId(config));
  }, [config, multiBranch]);
  const pickBranch = (id: string) => {
    setBranch(id);
    try {
      localStorage.setItem(LAST_BRANCH_KEY, id);
    } catch {
      /* จำไม่ได้ก็ไม่เป็นไร */
    }
  };
  // ชื่อ/รายการห้องดึงจากตั้งค่าของร้านนี้ ไม่ใช่ค่าเริ่มต้นของ CatCha —
  // ร้านที่เปลี่ยนชื่อห้องหรือลบห้องประเภทใดออกจะเห็นรายการที่ตรงกับร้านตัวเอง
  const roomTypes = useMemo(
    () =>
      roomsOfBranch(config, config.rooms, multiBranch ? branch : null)
        .filter((r) => isSelfBookableRoom(r))
        .map((r) => ({
          id: r.id,
          name: r.name,
          price: r.price,
          maxCats: r.maxCats,
          includedCats: r.includedCats,
          extraCatPrice: r.extraCatPrice,
          cats: r.cats,
          extra: r.extra,
        })),
    [config, multiBranch, branch]
  );
  // แท็บ นวด = จองคิวแบบ groom ที่เลือกโปรแกรมนวด (คิวแยกจากอาบน้ำ)
  const [tab, setTab] = useState<Service | "massage">(() => {
    const p = params.get("service");
    return p === "room" ? "room" : p === "massage" ? "massage" : "groom";
  });
  const service: Service = tab === "room" ? "room" : "groom";
  const massage = tab === "massage";
  // ร้านปิดบริการไหนไว้ในตั้งค่า ก็ไม่ให้เลือกบริการนั้น
  const groomOn = isFeatureOn(config, "grooming");
  const hotelOn = isFeatureOn(config, "hotel");
  const massageOn = isFeatureOn(config, "massage");
  useEffect(() => {
    const on = { groom: groomOn, room: hotelOn, massage: massageOn };
    if (on[tab]) return;
    const next = (["groom", "room", "massage"] as const).find((t) => on[t]);
    if (next) setTab(next);
  }, [tab, groomOn, hotelOn, massageOn]);
  // สาขาตั้งราคา/โปรแกรมเองได้ — โชว์ของสาขาที่ลูกค้าเลือก
  const branchCfg = configForBranch(config, multiBranch ? branch : null);
  const branchPrograms = branchCfg.groomPricePrograms;
  // บริการนอกสถานที่ (ช่างไปที่บ้าน) — ร้านเปิดฟีเจอร์ไว้ + นวดที่บ้านได้ถ้าร้านไม่ได้ปิด
  const homeAvailable = homeServiceOn(config) && (!massage || homeMassageAllowed(branchCfg));
  const [homeChoice, setHomeChoice] = useState<HomeChoice>(EMPTY_HOME_CHOICE);
  const atHome = homeAvailable && homeChoice.on;
  const allTabPrograms = massage
    ? resolveMassagePrograms(branchPrograms)
    : bathPrograms(resolveGroomPrograms(branchPrograms));
  // เลือกน้องได้หลายตัวทั้งอาบน้ำและเข้าพัก — เข้าพักบ้านเดียวกันอยู่ห้องเดียวกัน (เกินจุห้อง = เพิ่มห้อง)
  const [catNames, setCatNames] = useState<string[]>([]);
  const toggleCat = (name: string) => {
    setCatNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };
  // รูป + สายพันธุ์ของน้อง (customer.cats มีแค่ id/ชื่อ) — โหลดไม่ได้ก็ยังเลือกได้ แค่ไม่มีรูป
  const [catDetails, setCatDetails] = useState<PetPickItem[]>([]);
  const customerId = customer?.id;
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    customerFetch("/api/customers/cat-photo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { cats: [] }))
      .then((d) => {
        if (!cancelled) setCatDetails(d.cats || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [customerId]);
  const petItems: PetPickItem[] = useMemo(
    () =>
      (customer?.cats || []).map((c) => {
        const d = catDetails.find((x) => x.id === c.id);
        return {
          id: c.id,
          name: c.name,
          breed: d?.breed,
          species: d?.species,
          photoDataUrl: d?.photoDataUrl,
          weightKg: d?.weightKg,
        };
      }),
    [customer?.cats, catDetails]
  );

  // ร้านรับสัตว์หลายชนิด: โชว์เฉพาะโปรแกรมของชนิดสัตว์ตัวที่เลือก (โปรแกรมที่ไม่ระบุชนิด = เห็นทุกตัว)
  const speciesOfPet = (name: string) => speciesOf(petItems.find((p) => p.name === name), config);
  const tabPrograms = programsForSpecies(allTabPrograms, catNames.map(speciesOfPet));

  // groom state
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<GroomSlot[] | null>(null);
  const [groomClosed, setGroomClosed] = useState(false);
  // "together" = ร้านตั้งคิดเวลาตามจำนวนแมว: ทั้งบ้านเริ่มพร้อมกัน แล้วกันช่วงเวลาตามจำนวนตัว
  const [groomMode, setGroomMode] = useState<"together" | "per_cat">("per_cat");
  const [time, setTime] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [groomProgram, setGroomProgram] = useState("");
  // จองหลายตัว: แต่ละตัวเลือกโปรแกรมของตัวเองได้ (ทับโปรแกรมที่เลือกให้ทุกตัว)
  const [petPrograms, setPetPrograms] = useState<Record<string, string>>({});
  // เปลี่ยนน้อง/สาขาแล้วโปรแกรมที่เลือกไว้ใช้กับชนิดนั้นไม่ได้ = ล้างออก ให้เลือกใหม่
  const fitKey = tabPrograms.map((p) => p.id).join("|");
  useEffect(() => {
    const ids = new Set(fitKey.split("|"));
    setGroomProgram((cur) => (cur && !ids.has(cur) ? "" : cur));
    setPetPrograms((cur) => {
      const next = Object.fromEntries(
        Object.entries(cur).filter(([n, pid]) => {
          const prog = allTabPrograms.find((p) => p.id === pid);
          return !pid || (prog && programFitsSpecies(prog, speciesOfPet(n)));
        })
      );
      return Object.keys(next).length === Object.keys(cur).length ? cur : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // room state
  const [roomType, setRoomType] = useState("");
  const [checkin, setCheckin] = useState(todayISO());
  const [checkout, setCheckout] = useState(addDaysISO(todayISO(), 1));
  const [roomAvail, setRoomAvail] = useState<RoomAvail>(null);
  const [roomAvailErr, setRoomAvailErr] = useState("");
  const [loadingRoom, setLoadingRoom] = useState(false);

  // บ้านเดียวกันอยู่ห้องเดียวกัน — เกินจุห้องค่อยเพิ่มห้อง · ค่าตัวที่เกินโควตาห้องคิดตามตั้งค่าห้อง
  const selectedRoom = roomTypes.find((r) => r.id === roomType);
  const roomsNeeded = selectedRoom
    ? Math.max(1, Math.ceil(catNames.length / Math.max(1, selectedRoom.maxCats || 1)))
    : 1;
  const seasons = useMemo(() => normalizeRoomSeasons(config.roomSeasons), [config.roomSeasons]);
  const roomPrice = useMemo(() => {
    if (!selectedRoom || !catNames.length || checkout <= checkin) return null;
    const nights = Math.round(
      (Date.parse(checkout + "T00:00:00Z") - Date.parse(checkin + "T00:00:00Z")) / 86400000
    );
    const extra = extraCatChargePerNight(selectedRoom, catNames.length);
    // ร้านที่คิดราคาตาม Low/High season — ประมาณราคาตามฤดูของแต่ละคืน (และน้ำหนักน้องถ้าร้านคิดตามน้ำหนัก)
    const seasonParts = seasonsActive(seasons)
      ? splitStayBySeason(checkin, checkout, seasons).map((p) => {
          const pricing = roomPricing(selectedRoom);
          const cap = Math.max(1, selectedRoom.maxCats || 1);
          const weights = catNames.map((n) => petItems.find((x) => x.name === n)?.weightKg);
          let perNight = 0;
          for (let i = 0; i < weights.length; i += cap) {
            perNight += seasonalNightPrice({
              cfg: seasons,
              season: p.season,
              roomPrice: selectedRoom.price,
              pricing,
              weights: weights.slice(i, i + cap),
            });
          }
          return { season: p.season, nights: p.nights, perNight };
        })
      : null;
    return {
      nights,
      rooms: extra.rooms,
      roomPerNight: selectedRoom.price,
      extraCats: extra.extraCats,
      extraCatPrice: roomPricing(selectedRoom).extraPrice,
      included: roomPricing(selectedRoom).base,
      seasonParts,
      total: seasonParts
        ? seasonParts.reduce((s, p) => s + p.perNight * p.nights, 0)
        : (selectedRoom.price * extra.rooms + extra.perNight) * nights,
    };
  }, [selectedRoom, catNames, checkin, checkout, seasons, petItems]);

  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [done, setDone] = useState<
    null | {
      service: Service;
      massage?: boolean;
      schedule?: { catName: string; time: string }[];
      ids: string[];
      depositAmount: number;
      slipSent: boolean;
    }
  >(null);

  // มัดจำ — ร้านเปิดไว้ในตั้งค่า › การชำระเงิน · ยอดคิดฝั่งเซิร์ฟเวอร์ (หน้านี้แค่แสดง)
  const [deposit, setDeposit] = useState<DepositInfo | null>(null);
  const [slip, setSlip] = useState("");
  const [slipBusy, setSlipBusy] = useState(false);
  const [slipErr, setSlipErr] = useState("");
  const [lateSending, setLateSending] = useState(false);
  const pickSlip = async (file: File) => {
    setSlipBusy(true);
    setSlipErr("");
    try {
      setSlip(await toJpegDataUrl(file, 1400));
    } catch (e) {
      setSlipErr(e instanceof Error ? e.message : tr("แนบรูปไม่สำเร็จ ลองใหม่อีกครั้ง", "Couldn't attach the photo. Please try again."));
    } finally {
      setSlipBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;
    setDeposit(null);
    fetch(`/api/bookings/deposit?service=${service}`)
      .then((r) => (r.ok ? r.json() : { amount: 0 }))
      .then((d: DepositInfo) => alive && setDeposit(d.amount > 0 ? d : null))
      .catch(() => alive && setDeposit(null));
    return () => {
      alive = false;
    };
  }, [service]);

  useEffect(() => {
    if (customer?.cats?.length && !catNames.length) setCatNames([customer.cats[0].name]);
  }, [customer, catNames]);

  useEffect(() => {
    // roomType เริ่มว่างเพราะรอโหลด config ก่อน — เลือกห้องแรกที่ร้านนี้เปิดให้จองเองได้
    // และสลับให้อัตโนมัติถ้าห้องที่เลือกไว้ถูกลบ/เปลี่ยนชื่อจนไม่อยู่ในลิสต์แล้ว
    if (roomTypes.length && !roomTypes.some((r) => r.id === roomType)) {
      setRoomType(roomTypes[0].id);
    }
  }, [roomTypes, roomType]);

  useEffect(() => {
    if (service !== "groom") return;
    let alive = true;
    setLoadingSlots(true);
    // ส่งจำนวนน้องไปด้วย — โหมดคิดเวลา รอบที่ว่างขึ้นกับว่ามากี่ตัว (ใช้เวลานานแค่ไหน)
    fetch(
      `/api/bookings/availability?service=${massage ? "massage" : "groom"}&date=${date}&cats=${Math.max(1, catNames.length)}${
        multiBranch && branch ? `&branch=${encodeURIComponent(branch)}` : ""
      }${atHome ? "&home=1" : ""}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setSlots(d.slots || []);
        setGroomClosed(Boolean(d.closed));
        setGroomMode(d.mode === "together" ? "together" : "per_cat");
      })
      .catch(() => alive && setSlots([]))
      .finally(() => alive && setLoadingSlots(false));
    return () => {
      alive = false;
    };
  }, [service, massage, date, catNames.length, multiBranch, branch, atHome]);

  // เปลี่ยนวัน/สลับที่ร้าน-ที่บ้าน = รอบเดิมอาจไม่มี/เต็มแล้ว ให้เลือกใหม่
  useEffect(() => {
    setTime("");
  }, [service, massage, date, atHome]);

  useEffect(() => {
    if (service !== "room") return;
    if (!roomType) return;
    if (checkout <= checkin) return;
    let alive = true;
    setLoadingRoom(true);
    setRoomAvailErr("");
    fetch(
      `/api/bookings/availability?service=room&roomType=${roomType}&checkin=${checkin}&checkout=${checkout}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) {
          setRoomAvail(null);
          setRoomAvailErr(
            d.error === "not_self_bookable"
              ? tr("ห้องประเภทนี้ยังจองเองไม่ได้ — ทักแชทร้านแทนนะคะ", "This room type can't be booked online yet. Please message the shop.")
              : tr("เช็คความว่างไม่สำเร็จ", "Couldn't check availability")
          );
        } else {
          setRoomAvail(d);
        }
      })
      .catch(() => alive && setRoomAvailErr(tr("เช็คความว่างไม่สำเร็จ", "Couldn't check availability")))
      .finally(() => alive && setLoadingRoom(false));
    return () => {
      alive = false;
    };
  }, [service, roomType, checkin, checkout]);

  // แมวตัวแรกลงเวลาที่เลือก ตัวที่เหลือไหลไปสล็อตถัดไปอัตโนมัติถ้าสล็อตนั้นเต็ม
  const assignedPreview = useMemo(() => {
    if (!slots || !time || !catNames.length) return null;
    if (groomMode === "together") {
      const s = slots.find((x) => x.time === time);
      return s && s.remaining > 0 ? catNames.map(() => time) : null;
    }
    return assignGroomSlots(slots, time, catNames.length);
  }, [slots, time, catNames, groomMode]);
  const pickedSlot = slots?.find((x) => x.time === time);

  const canSubmit = useMemo(() => {
    if (!catNames.length) return false;
    if (service === "groom") {
      if (!time) return false;
      if (atHome && !homeChoiceReady(branchCfg, homeChoice)) return false;
      return Boolean(assignedPreview);
    }
    return Boolean(
      roomType && roomAvail && roomAvail.remaining >= roomsNeeded && checkout > checkin
    );
  }, [catNames, service, time, assignedPreview, roomType, roomAvail, checkin, checkout, roomsNeeded, atHome, branchCfg, homeChoice]);

  const submit = async (withSlip = true) => {
    if (!profile?.lineUserId || !canSubmit) return;
    setSubmitting(true);
    setSubmitErr("");
    try {
      const body =
        service === "groom"
          ? {
              lineUserId: profile.lineUserId,
              catNames,
              service: massage ? "massage" : service,
              date,
              time,
              branchId: multiBranch ? branch || undefined : undefined,
              home: atHome
                ? {
                    zoneId: homeChoice.zoneId || undefined,
                    address: homeChoice.address.trim(),
                    mapUrl: homeChoice.mapUrl.trim(),
                  }
                : undefined,
              groomProgram: groomProgram || undefined,
              petPrograms: Object.fromEntries(
                catNames.map((n) => [n, (petPrograms[n] ?? groomProgram) || ""])
              ),
              depositSlip: (withSlip && slip) || undefined,
            }
          : {
              lineUserId: profile.lineUserId,
              catNames,
              service,
              checkin,
              checkout,
              room: roomType,
              depositSlip: (withSlip && slip) || undefined,
            };
      const res = await fetch("/api/bookings/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        const schedule =
          service === "groom" && Array.isArray(d.bookings)
            ? d.bookings.map((b: { catName: string; time: string }) => ({
                catName: b.catName,
                time: b.time,
              }))
            : undefined;
        const created: { id: string; depositStatus?: string; depositAmount?: number }[] =
          Array.isArray(d.bookings) ? d.bookings : d.booking ? [d.booking] : [];
        setDone({
          service,
          massage,
          schedule,
          ids: created.map((b) => b.id),
          depositAmount: Number(created[0]?.depositAmount) || 0,
          slipSent: created[0]?.depositStatus === "pending_review",
        });
        setSlip("");
        savedPopup(service === "groom" ? tr("จองคิวอาบน้ำสำเร็จ", "Grooming booked") : tr("จองห้องพักสำเร็จ", "Stay booked"), [
          tr("ร้านจะยืนยันกลับทาง LINE นะคะ", "The shop will confirm via LINE."),
        ]);
      } else if (d.error === "slot_full" || d.error === "room_full") {
        setSubmitErr(
          service === "groom"
            ? tr("คิววันนี้ไม่พอสำหรับน้องที่เลือกไว้ทั้งหมด ลองเลือกวัน/เวลาอื่นนะคะ", "Not enough slots left today for all selected pets. Please try another day or time.")
            : tr("ช่วงนี้เต็มไปแล้วพอดี ลองเลือกวัน/เวลาอื่นนะคะ", "That slot just filled up. Please choose another day or time.")
        );
      } else if (d.error === "address_required" || d.error === "bad_url") {
        setSubmitErr(tr("ใส่ที่อยู่ หรือลิงก์ Google Maps ที่ถูกต้องก่อนนะคะ", "Please enter a valid address or Google Maps link."));
      } else if (d.error === "zone_required") {
        setSubmitErr(tr("เลือกโซนที่บ้านอยู่ก่อนนะคะ", "Please choose your home zone."));
      } else if (d.error === "shop_closed") {
        setSubmitErr(tr("ร้านปิดวันที่เลือกไว้พอดี ลองเลือกวันอื่นนะคะ", "The shop is closed on that day. Please choose another day."));
      } else if (d.error === "duplicate_booking") {
        setSubmitErr(tr("น้องตัวนี้มีคิว/การจองช่วงนี้อยู่แล้วค่ะ — ดูได้ที่เมนู “คิวของฉัน” นะคะ", "This pet already has a booking around then. See “My bookings”."));
      } else if (d.error === "past_date") {
        setSubmitErr(tr("วันที่เลือกผ่านมาแล้วค่ะ ลองเลือกวันใหม่นะคะ", "That date has passed. Please choose a new date."));
      } else {
        setSubmitErr(tr("จองไม่สำเร็จ — ลองใหม่อีกครั้ง", "Booking failed. Please try again."));
      }
    } catch {
      setSubmitErr(tr("เชื่อมต่อไม่สำเร็จ — ลองใหม่อีกครั้ง", "Connection failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return <p className="py-10 text-center text-sm text-brown-soft">{tr("กำลังโหลด…", "Loading…")}</p>;
  }

  if (done) {
    return (
      <div className="px-4 pb-6 pt-5">
        <PageHeader title={tr("✅ ส่งคำขอจองแล้ว", "✅ Booking request sent")} />
        <div className="rounded-petflow border border-petflow-line bg-card p-5 text-center shadow-petflow-sm">
          <p className="text-4xl">🐾</p>
          <p className="mt-2 text-sm font-bold text-brown">
            {tr(`ส่งคำขอ${done.service === "room" ? "จองห้องพัก" : done.massage ? "จองคิวนวด" : "จองคิวอาบน้ำ"}เรียบร้อยแล้วค่ะ`, `Your ${done.service === "room" ? "stay" : done.massage ? "massage" : "grooming"} request has been sent.`)}
          </p>
          {done.schedule && done.schedule.length > 1 && (
            <div className="mt-3 space-y-1 rounded-petflow-sm bg-paper px-3 py-2.5 text-left text-xs">
              <p className="mb-1 text-center font-bold text-brown-soft">
                {tr("🕒 คิวที่ได้ (แยกตามความว่างของแต่ละช่วง)", "🕒 Your times (based on each slot's availability)")}
              </p>
              {done.schedule.map((s, i) => (
                <p key={i} className="flex items-center justify-between text-brown">
                  <span>{pw.emoji} {s.catName}</span>
                  <span className="font-extrabold text-latte-deep">{s.time}</span>
                </p>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-brown-soft">
            {tr("รอร้านกดยืนยันอีกนิดนะคะ — เช็คสถานะได้ที่เมนู “คิวของฉัน” ด้านล่าง", "Please wait for the shop to confirm. Check the status in “My bookings” below.")}
          </p>
          {done.depositAmount > 0 &&
            (done.slipSent ? (
              <p className="mt-3 rounded-petflow-sm bg-sage/15 px-3 py-2 text-xs font-bold text-ok">
                {tr(`📎 ส่งสลิปมัดจำ ${done.depositAmount.toLocaleString()} บาทแล้ว — รอร้านตรวจสลิปนะคะ`, `📎 Deposit slip for ${done.depositAmount.toLocaleString()} THB sent. Waiting for the shop to check it.`)}
              </p>
            ) : (
              <div className="mt-3 text-left">
                <DepositCard
                  deposit={deposit || { amount: done.depositAmount }}
                  amountOverride={done.depositAmount}
                  slip={slip}
                  busy={slipBusy}
                  error={slipErr}
                  onPick={pickSlip}
                  onClear={() => setSlip("")}
                />
                <button
                  type="button"
                  disabled={!slip || lateSending || !done.ids.length}
                  onClick={async () => {
                    setLateSending(true);
                    setSlipErr("");
                    try {
                      const res = await fetch("/api/bookings/deposit", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ids: done.ids, slip }),
                      });
                      if (res.ok) {
                        setDone({ ...done, slipSent: true });
                        setSlip("");
                        savedPopup(tr("ส่งสลิปสำเร็จ", "Slip sent"), [tr("ร้านจะตรวจสอบแล้วยืนยันให้นะคะ", "The shop will check it and confirm.")]);
                      } else {
                        setSlipErr(tr("ส่งสลิปไม่สำเร็จ — ลองใหม่อีกครั้ง หรือส่งสลิปในแชทร้านแทนนะคะ", "Couldn't send the slip. Try again, or send it in the shop's chat."));
                      }
                    } catch {
                      setSlipErr(tr("เชื่อมต่อไม่สำเร็จ — ลองใหม่อีกครั้ง", "Connection failed. Please try again."));
                    } finally {
                      setLateSending(false);
                    }
                  }}
                  className="mt-2 w-full rounded-petflow-sm bg-gradient-to-r from-honey to-honey-deep py-3 text-sm font-extrabold text-petflow-chocolate shadow-petflow-sm disabled:opacity-50"
                >
                  {lateSending ? tr("กำลังส่งสลิป…", "Sending slip…") : tr("📎 ส่งสลิปมัดจำ", "📎 Send deposit slip")}
                </button>
                <p className="mt-1.5 text-center text-[11px] text-brown-faint">
                  {tr("ยังไม่สะดวกโอนตอนนี้ก็ได้ค่ะ — ร้านจะติดต่อเรื่องมัดจำอีกครั้ง", "No problem if you can't transfer now. The shop will contact you about the deposit.")}
                </p>
              </div>
            ))}
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setSlip("");
              setSlipErr("");
              setTime("");
              setGroomProgram("");
              setPetPrograms({});
            }}
            className="mt-4 rounded-full bg-honey/30 px-4 py-2 text-xs font-bold text-latte-deep"
          >
            {tr("จองอีกรายการ", "Book another")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader title={tr("📅 จองคิวเอง", "📅 Book online")} subtitle={tr("เลือกวัน-เวลาที่ว่างได้เลย ไม่ต้องคุยกับพนักงาน", "Pick an available day and time yourself.")} />

      {[groomOn, massageOn, hotelOn].filter(Boolean).length > 1 && (
      <div className="mb-4 flex overflow-hidden rounded-full border border-petflow-line text-xs font-bold">
        {(
          [
            groomOn && { id: "groom", label: tr("🛁 อาบน้ำ", "🛁 Grooming") },
            massageOn && { id: "massage", label: tr("💆 นวด", "💆 Massage") },
            hotelOn && { id: "room", label: tr("🏠 เข้าพักโรงแรม", "🏠 Hotel stay") },
          ].filter(Boolean) as { id: Service | "massage"; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setGroomProgram("");
              setPetPrograms({});
            }}
            className={`flex-1 py-2.5 transition ${
              tab === t.id ? "bg-latte-deep text-white" : "bg-card text-brown-soft"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      )}

      {multiBranch && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-bold text-brown-soft">{tr("📍 เลือกสาขา", "📍 Choose branch")}</p>
          <div className="grid gap-2">
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => pickBranch(b.id)}
                className={`rounded-petflow-sm border px-3 py-2.5 text-left transition ${
                  branch === b.id
                    ? "border-latte-deep bg-latte-deep/10"
                    : "border-petflow-line bg-card"
                }`}
              >
                <span className="block text-sm font-extrabold text-petflow-chocolate">
                  {branch === b.id ? "✓ " : ""}
                  {b.name}
                </span>
                {b.address ? <span className="block text-[11px] text-brown-soft">{b.address}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {!customer?.cats?.length ? (
        <p className="rounded-petflow-sm bg-wait/10 px-3 py-2.5 text-xs font-bold text-wait">
          {tr(`ยังไม่มีข้อมูลน้อง${pw.th}ในระบบ — กรุณาลงทะเบียนก่อนจองนะคะ`, `No ${pw.en} on file yet. Please sign up before booking.`)}
        </p>
      ) : (
        <>
          <div className="rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm">
            <div className="mb-4">
              <PetPickList pets={petItems} selected={catNames} onToggle={toggleCat} />
            </div>

            {service === "groom" ? (
              <>
                <label className="mb-3 block text-xs font-bold text-brown-soft">
                  {massage
                    ? `💆 ${catNames.length > 1 ? tr("โปรแกรมนวด — ทุกตัว", "Massage program (all pets)") : tr("โปรแกรมนวด", "Massage program")}`
                    : `🧴 ${catNames.length > 1 ? tr("โปรแกรมอาบน้ำ — ทุกตัว (ไม่บังคับ)", "Grooming program, all pets (optional)") : tr("โปรแกรมอาบน้ำ (ไม่บังคับ)", "Grooming program (optional)")}`}
                  <select
                    value={groomProgram}
                    onChange={(e) => {
                      setGroomProgram(e.target.value);
                      setPetPrograms({});
                    }}
                    className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
                  >
                    {!massage && <option value="">{tr("ยังไม่เลือก — ให้ทางร้านแนะนำหน้างาน", "Not chosen. Let the shop recommend on the day")}</option>}
                    {tabPrograms.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const tags = tabPrograms.find((p) => p.id === groomProgram)?.includes;
                    return tags?.length ? (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {tags.map((t) => (
                          <span key={t} className="rounded-full bg-sage/25 px-2 py-0.5 text-[10px] font-bold text-brown">
                            ✓ {t}
                          </span>
                        ))}
                      </span>
                    ) : null;
                  })()}
                </label>
                {catNames.length > 1 && (
                  <div className="mb-3 space-y-1.5">
                    <p className="text-[11px] text-brown-faint">
                      {massage ? tr("แต่ละตัวนวดไม่เหมือนกัน", "Different massage per pet?") : tr("แต่ละตัวอาบไม่เหมือนกัน", "Different program per pet?")} {tr("เปลี่ยนรายตัวได้เลย", "Change each one here.")}
                    </p>
                    {catNames.map((n) => (
                      <div
                        key={n}
                        className="flex flex-wrap items-center gap-2 rounded-petflow-sm bg-paper px-3 py-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-brown">{n}</span>
                        <PetProgramSelect
                          cat={n}
                          value={petPrograms[n] ?? groomProgram}
                          onChange={(v) => setPetPrograms((p) => ({ ...p, [n]: v }))}
                          programs={allTabPrograms.filter((p) => programFitsSpecies(p, speciesOfPet(n)))}
                          emptyLabel={tr("ยังไม่เลือก — ให้ทางร้านแนะนำ", "Not chosen. Let the shop recommend")}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {homeAvailable && (
                  <HomeServiceChooser
                    config={branchCfg}
                    value={homeChoice}
                    onChange={setHomeChoice}
                    lineUserId={profile?.lineUserId}
                  />
                )}
                <label className="mb-3 block text-xs font-bold text-brown-soft">
                  {tr("📅 วันที่", "📅 Date")}
                  <input
                    type="date"
                    value={date}
                    min={todayISO()}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
                  />
                </label>
                <p className="mb-2 text-xs font-bold text-brown-soft">{tr("🕒 เลือกเวลา", "🕒 Choose a time")}</p>
                {loadingSlots ? (
                  <p className="text-xs text-brown-faint">{tr("กำลังเช็คความว่าง…", "Checking availability…")}</p>
                ) : groomClosed ? (
                  <p className="rounded-petflow-sm bg-wait/10 px-3 py-2.5 text-xs font-bold text-wait">
                    {tr("ร้านปิดวันนี้ค่ะ — ลองเลือกวันอื่นนะคะ", "The shop is closed this day. Please choose another day.")}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {(slots || []).map((s) => {
                      // สล็อตเลือกเป็นจุดเริ่มได้ตราบใดที่ยังไม่เต็มสนิท — ถ้าน้องที่เลือกไว้มีมากกว่า
                      // ที่สล็อตนี้รับไหว ตัวที่เหลือจะไหลไปสล็อตถัดไปที่ว่างให้อัตโนมัติ (ดูตัวอย่างด้านล่าง)
                      const full = s.remaining <= 0;
                      const active = time === s.time;
                      return (
                        <button
                          key={s.time}
                          type="button"
                          disabled={full}
                          onClick={() => setTime(s.time)}
                          className={`rounded-petflow-sm border py-2 text-center text-xs font-bold transition ${
                            full
                              ? "cursor-not-allowed border-petflow-line bg-paper text-brown-faint line-through"
                              : active
                                ? "border-latte-deep bg-latte-deep text-white"
                                : "border-petflow-line bg-card text-brown"
                          }`}
                        >
                          {s.time}
                          <span className="block text-[9px] font-normal opacity-80">
                            {full
                              ? tr("เต็มแล้ว", "Full")
                              : groomMode === "together" && s.endTime
                                ? tr(`ถึง ${s.endTime}`, `to ${s.endTime}`)
                                : tr(`ว่าง ${s.remaining}`, `${s.remaining} free`)}
                          </span>
                        </button>
                      );
                    })}
                    {slots && slots.length === 0 && (
                      <p className="col-span-3 text-xs text-brown-faint">
                        {tr("ร้านยังไม่ได้ตั้งรอบเวลาไว้ — ทักแชทร้านแทนนะคะ", "The shop hasn't set time slots yet. Please message the shop.")}
                      </p>
                    )}
                  </div>
                )}

                {/* พรีวิวคิวที่จะได้ — ถ้าน้องเกินที่สล็อตนี้รับไหว จะไหลไปสล็อตถัดไปให้เห็นก่อนกดจอง */}
                {time && groomMode === "together" && pickedSlot?.endTime && (
                  <p className="mt-2 rounded-petflow-sm bg-paper px-3 py-2 text-[11px] font-bold text-brown">
                    🕒 {catNames.length > 1 ? tr(`น้องทั้ง ${catNames.length} ตัว`, `All ${catNames.length} pets`) : catNames[0]} {tr("เริ่ม", "start")}{" "}
                    <span className="text-latte-deep">{time}</span> {tr("เสร็จประมาณ", "finish around")}{" "}
                    <span className="text-latte-deep">{pickedSlot.endTime}</span>
                  </p>
                )}
                {time && groomMode !== "together" && catNames.length > 1 && (
                  <div className="mt-2 rounded-petflow-sm bg-paper px-3 py-2 text-[11px]">
                    {assignedPreview ? (
                      <>
                        <p className="mb-1 font-bold text-brown-soft">{tr("🕒 คิวที่จะได้:", "🕒 Your times:")}</p>
                        {catNames.map((name, i) => (
                          <p key={i} className="flex items-center justify-between text-brown">
                            <span>{pw.emoji} {name}</span>
                            <span className="font-extrabold text-latte-deep">
                              {assignedPreview[i]}
                            </span>
                          </p>
                        ))}
                      </>
                    ) : (
                      <p className="font-bold text-wait">
                        {tr(`คิวที่เหลือในวันนี้ไม่พอสำหรับน้องทั้ง ${catNames.length} ตัว — ลองเลือกวันอื่นนะคะ`, `Not enough slots left today for all ${catNames.length} pets. Please try another day.`)}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : roomTypes.length === 0 ? (
              <p className="rounded-petflow-sm bg-wait/10 px-3 py-2.5 text-xs font-bold text-wait">
                {tr("ยังจองห้องพักเองไม่ได้ตอนนี้ — ทักแชทร้านแทนนะคะ", "Stays can't be booked online yet. Please message the shop.")}
              </p>
            ) : (
              <>
                <label className="mb-3 block text-xs font-bold text-brown-soft">
                  {tr("🏠 ประเภทห้อง", "🏠 Room type")}
                  <select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
                  >
                    {roomTypes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <label className="block text-xs font-bold text-brown-soft">
                    {tr("วันเข้าพัก", "Check-in")}
                    <input
                      type="date"
                      value={checkin}
                      min={todayISO()}
                      onChange={(e) => {
                        setCheckin(e.target.value);
                        if (checkout <= e.target.value) setCheckout(addDaysISO(e.target.value, 1));
                      }}
                      className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs font-bold text-brown-soft">
                    {tr("วันออก", "Check-out")}
                    <input
                      type="date"
                      value={checkout}
                      min={addDaysISO(checkin, 1)}
                      onChange={(e) => setCheckout(e.target.value)}
                      className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                {loadingRoom ? (
                  <p className="text-xs text-brown-faint">{tr("กำลังเช็คความว่าง…", "Checking availability…")}</p>
                ) : roomAvailErr ? (
                  <p className="rounded-petflow-sm bg-wait/10 px-3 py-2 text-xs font-bold text-wait">
                    {roomAvailErr}
                  </p>
                ) : roomAvail ? (
                  <p
                    className={`rounded-petflow-sm px-3 py-2 text-xs font-bold ${
                      roomAvail.remaining > 0 ? "bg-sage/15 text-ok" : "bg-wait/10 text-wait"
                    }`}
                  >
                    {roomAvail.remaining >= roomsNeeded
                      ? tr(`✅ ว่าง ${roomAvail.remaining} ห้อง`, `✅ ${roomAvail.remaining} room(s) available`)
                      : roomAvail.remaining > 0
                        ? tr(`ว่างแค่ ${roomAvail.remaining} ห้อง แต่น้อง ${catNames.length} ตัวต้องใช้ ${roomsNeeded} ห้อง`, `Only ${roomAvail.remaining} room(s) left, but ${catNames.length} pets need ${roomsNeeded} rooms`)
                      : roomAvail.closed
                        ? tr("ร้านปิดวันเช็คอิน/เช็คเอาท์ที่เลือกไว้ — ลองเปลี่ยนวันดูนะคะ", "The shop is closed on your check-in/check-out day. Please change the dates.")
                        : tr("เต็มแล้วช่วงนี้ — ลองเปลี่ยนวันดูนะคะ", "Fully booked for these dates. Please try other dates.")}
                  </p>
                ) : null}
                {roomPrice && (
                  <div className="mt-2 rounded-petflow-sm bg-paper px-3 py-2 text-xs text-brown">
                    <p className="font-bold">
                      💰 {tr("ประมาณ", "About")} ฿{roomPrice.total.toLocaleString()} ({roomPrice.nights} {tr("คืน", "night(s)")})
                    </p>
                    {roomPrice.seasonParts ? (
                      roomPrice.seasonParts.map((p, i) => (
                        <p key={i} className="text-brown-soft">
                          {SEASON_LABEL[p.season]} ฿{p.perNight.toLocaleString()} × {p.nights} {tr("คืน", "night(s)")}
                        </p>
                      ))
                    ) : (
                      <p className="text-brown-soft">
                        {tr("ห้อง", "Room")} ฿{roomPrice.roomPerNight.toLocaleString()} × {roomPrice.rooms} {tr("ห้อง", "room(s)")}
                        {roomPrice.extraCats > 0 &&
                          tr(` + น้องตัวที่ ${roomPrice.included + 1} ขึ้นไป ${roomPrice.extraCats} ตัว × ฿${roomPrice.extraCatPrice}`, ` + ${roomPrice.extraCats} extra pet(s) × ฿${roomPrice.extraCatPrice}`)}{" "}
                        {tr("ต่อคืน", "per night")}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {deposit && canSubmit && (
            <DepositCard
              deposit={deposit}
              slip={slip}
              busy={slipBusy}
              error={slipErr}
              onPick={pickSlip}
              onClear={() => setSlip("")}
            />
          )}

          {submitErr && (
            <p className="mt-3 text-center text-xs font-bold text-wait">{submitErr}</p>
          )}
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={() => submit(true)}
            className="mt-4 w-full rounded-petflow-sm bg-gradient-to-r from-honey to-honey-deep py-3.5 text-sm font-extrabold text-petflow-chocolate shadow-petflow-sm disabled:opacity-50"
          >
            {submitting
              ? tr("กำลังส่งคำขอ…", "Sending request…")
              : deposit && slip
                ? tr("🐾 ยืนยันจอง + ส่งสลิปมัดจำ", "🐾 Book + send deposit slip")
                : tr("🐾 ยืนยันจองคิว", "🐾 Confirm booking")}
          </button>
          {deposit && canSubmit && slip && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => submit(false)}
              className="mt-2 w-full rounded-petflow-sm bg-card py-2.5 text-xs font-bold text-brown-soft ring-1 ring-petflow-line disabled:opacity-50"
            >
              {tr("จองก่อน โอนทีหลัง", "Book now, pay later")}
            </button>
          )}
          {deposit && canSubmit && !slip && (
            <p className="mt-2 text-center text-[11px] text-brown-faint">
              {tr("ยังไม่ได้แนบสลิป — กดจองได้เลย (โอนทีหลัง) แล้วค่อยแนบสลิปหลังจองได้ค่ะ", "No slip yet. You can book now and attach the slip later.")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** ขั้นมัดจำ: ยอด + QR พร้อมเพย์ตามยอด + แนบสลิป (ไม่บังคับ — โอนทีหลังได้) */
function DepositCard({
  deposit,
  amountOverride,
  slip,
  busy,
  error,
  onPick,
  onClear,
}: {
  deposit: DepositInfo;
  amountOverride?: number;
  slip: string;
  busy: boolean;
  error: string;
  onPick: (f: File) => void;
  onClear: () => void;
}) {
  const tr = useTr();
  const amount = amountOverride || deposit.amount;
  // QR ผูกยอดไว้ — ถ้ายอดของนัดไม่ตรงกับยอดปัจจุบันในตั้งค่า (ร้านเพิ่งแก้) อย่าโชว์ QR ยอดผิด
  const showQr = !!deposit.qr && (!amountOverride || amountOverride === deposit.amount);
  return (
    <div className="mt-4 rounded-petflow border border-honey-deep/40 bg-honey/10 p-4 shadow-petflow-sm">
      <p className="text-xs font-bold text-brown-soft">{tr("💰 มัดจำเพื่อยืนยันคิว", "💰 Deposit to confirm")}</p>
      <p className="mt-0.5 text-2xl font-extrabold text-petflow-chocolate">
        {amount.toLocaleString()} <span className="text-sm">{tr("บาท", "THB")}</span>
      </p>
      {showQr ? (
        <div className="mt-3 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={deposit.qr}
            alt={`PromptPay QR ${amount}`}
            className="h-52 w-52 rounded-petflow-sm bg-white p-2"
          />
          <p className="mt-1.5 text-center text-[11px] text-brown-soft">
            {tr("สแกนด้วยแอปธนาคาร — ยอดขึ้นให้อัตโนมัติ", "Scan with your banking app. The amount fills in automatically.")}
            {deposit.promptpay ? ` · ${tr("พร้อมเพย์", "PromptPay")} ${deposit.promptpay}` : ""}
            {deposit.accountName ? ` · ${deposit.accountName}` : ""}
          </p>
          <a
            href={deposit.qr}
            download="deposit-qr.png"
            className="mt-1.5 rounded-full bg-card px-3 py-1 text-[11px] font-bold text-latte-deep ring-1 ring-petflow-line"
          >
            {tr("บันทึกรูป QR", "Save QR image")}
          </a>
        </div>
      ) : deposit.accountNumber ? (
        <p className="mt-2 rounded-petflow-sm bg-card px-3 py-2 text-xs text-brown">
          {tr("โอนเข้า", "Transfer to")} {deposit.bankName} <b>{deposit.accountNumber}</b>
          {deposit.accountName ? ` (${deposit.accountName})` : ""}
        </p>
      ) : null}

      <label className="mt-3 flex min-h-[56px] cursor-pointer items-center gap-3 rounded-petflow-sm border border-dashed border-petflow-line bg-paper px-3 py-3">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />
        {slip ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slip} alt={tr("สลิปโอนมัดจำ", "Deposit slip")} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-lg">
            🧾
          </span>
        )}
        <span className="text-xs font-bold text-brown-soft">
          {busy ? tr("กำลังแนบสลิป…", "Attaching slip…") : slip ? tr("แนบสลิปแล้ว — แตะเพื่อเปลี่ยนรูป", "Slip attached. Tap to change") : tr("โอนแล้ว แตะเพื่อแนบสลิป", "Paid? Tap to attach the slip")}
        </span>
      </label>
      {slip && (
        <button
          type="button"
          onClick={onClear}
          className="mt-1.5 text-[11px] font-bold text-brown-faint underline"
        >
          {tr("เอาสลิปออก", "Remove slip")}
        </button>
      )}
      {error && <p className="mt-1.5 text-[11px] font-bold text-wait">{error}</p>}
    </div>
  );
}

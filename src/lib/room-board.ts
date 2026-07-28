/**
 * แผนผังห้องพัก — แปลง "นัดเข้าพัก" เป็นภาพว่าห้องไหนมีใครอยู่ ห้องไหนว่างจริง
 *
 * ห้องในระบบเก็บเป็น "ประเภท" (MiNi Meow, Mid Cozy, Catflix) พร้อมจำนวนยูนิต
 * ส่วนการจองเก็บแค่ประเภท — เลขห้องจริงเป็นตัวเลือก (roomUnit) จะปักไว้ก็ได้
 * ไม่ปักก็ได้ ระบบจะไล่ลงห้องว่างให้เองแบบเดิมทุกครั้ง (เรียงตาม id) เพื่อให้
 * ผังไม่สลับไปมาระหว่างรีเฟรช
 */

export type BoardRoomType = { id: string; name: string; count: number };

export type BoardBooking = {
  id: string;
  catName: string;
  customerName: string;
  service: string;
  room?: string;
  roomUnit?: number;
  checkin?: string;
  checkout?: string;
  status?: string;
  arrivalTime?: string;
  pickupTime?: string;
};

export type UnitState = {
  typeId: string;
  typeName: string;
  unit: number;
  /** คนที่นอนอยู่ในคืนของวันนี้ */
  staying?: BoardBooking;
  /** คนที่เช็คเอาท์ออกวันนี้ (ห้องจะว่างหลังเขาออก) */
  leaving?: BoardBooking;
  /** เข้าใหม่วันนี้ */
  arriving: boolean;
  /** วันนี้มีทั้งคนออกและคนเข้าในห้องเดียวกัน — ต้องเคลียร์ห้องให้ทัน */
  turnover: boolean;
};

export type RoomBoard = {
  units: UnitState[];
  byType: {
    typeId: string;
    typeName: string;
    total: number;
    occupied: number;
    free: number;
    units: UnitState[];
  }[];
  totalUnits: number;
  occupied: number;
  free: number;
  isFull: boolean;
  turnovers: UnitState[];
  /** จองเกินจำนวนห้องที่มี — ต้องเห็นทันที ไม่ใช่ปล่อยให้ห้องหาย */
  overflow: BoardBooking[];
};

const isLive = (b: BoardBooking) => b.status !== "cancelled" && b.status !== "no_show";

/** นอนอยู่ในคืนของวันนี้ไหม (วันเช็คเอาท์ไม่นับ — เขาออกเช้าวันนั้น) */
export function isStayingOn(b: BoardBooking, date: string): boolean {
  const ci = b.checkin || "";
  const co = b.checkout || "";
  if (!ci) return false;
  return ci <= date && (co ? date < co : date === ci);
}

export function isLeavingOn(b: BoardBooking, date: string): boolean {
  return !!b.checkout && b.checkout === date;
}

/**
 * สร้างผังห้องของวันหนึ่ง
 * @param rooms ประเภทห้อง + จำนวนยูนิต (จาก config)
 * @param bookings นัดทั้งหมด (กรอง service/ยกเลิก ให้เองข้างใน)
 */
export function buildRoomBoard(
  rooms: BoardRoomType[],
  bookings: BoardBooking[],
  date: string
): RoomBoard {
  const stays = bookings.filter(
    (b) => b.service === "room" && isLive(b) && (isStayingOn(b, date) || isLeavingOn(b, date))
  );

  const units: UnitState[] = [];
  const byType: RoomBoard["byType"] = [];
  const overflow: BoardBooking[] = [];

  for (const type of rooms) {
    const count = Math.max(0, type.count || 0);
    const typeUnits: UnitState[] = Array.from({ length: count }, (_, i) => ({
      typeId: type.id,
      typeName: type.name,
      unit: i + 1,
      arriving: false,
      turnover: false,
    }));

    // จองของห้องประเภทนี้ — เทียบทั้ง id และชื่อ เพราะข้อมูลเก่าบางแถวเก็บเป็นชื่อ
    const mine = stays
      .filter((b) => {
        const r = (b.room || "").trim();
        return r === type.id || r === type.name;
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    const place = (b: BoardBooking, slot: UnitState) => {
      if (isLeavingOn(b, date)) slot.leaving = b;
      else {
        slot.staying = b;
        if (b.checkin === date) slot.arriving = true;
      }
    };

    // ปักหมุดห้องที่ระบุเลขไว้ก่อน — คนที่เลือกห้องเจาะจงต้องได้ห้องนั้นจริง
    const unpinned: BoardBooking[] = [];
    for (const b of mine) {
      const u = b.roomUnit;
      const slot = u && u >= 1 && u <= count ? typeUnits[u - 1] : undefined;
      // ห้องนั้นมีคนจับจองในบทบาทเดียวกันแล้ว → ตกไปหาห้องว่างแทน (ชนกัน)
      const taken = slot && (isLeavingOn(b, date) ? slot.leaving : slot.staying);
      if (slot && !taken) place(b, slot);
      else unpinned.push(b);
    }

    for (const b of unpinned) {
      const leaving = isLeavingOn(b, date);
      const slot = typeUnits.find((s) => (leaving ? !s.leaving : !s.staying));
      if (slot) place(b, slot);
      else overflow.push(b);
    }

    for (const s of typeUnits) s.turnover = !!s.leaving && !!s.staying;

    const occupied = typeUnits.filter((s) => s.staying).length;
    byType.push({
      typeId: type.id,
      typeName: type.name,
      total: count,
      occupied,
      free: count - occupied,
      units: typeUnits,
    });
    units.push(...typeUnits);
  }

  const totalUnits = units.length;
  const occupied = units.filter((s) => s.staying).length;
  return {
    units,
    byType,
    totalUnits,
    occupied,
    free: totalUnits - occupied,
    isFull: totalUnits > 0 && occupied >= totalUnits,
    turnovers: units.filter((s) => s.turnover),
    overflow,
  };
}

/**
 * ห้องประเภทนี้ว่างพอสำหรับช่วงวันที่ขอไหม — เช็คทุกคืนตั้งแต่เข้าถึงก่อนออก
 * คืนคืนที่แน่นที่สุดกลับไปด้วย จะได้บอกได้ว่าติดวันไหน
 */
export function typeAvailability(
  rooms: BoardRoomType[],
  bookings: BoardBooking[],
  typeId: string,
  checkin: string,
  checkout: string,
  ignoreBookingId?: string
): { free: number; total: number; tightestDate: string } {
  const type = rooms.find((r) => r.id === typeId);
  const total = type?.count || 0;
  const pool = ignoreBookingId ? bookings.filter((b) => b.id !== ignoreBookingId) : bookings;
  let free = total;
  let tightestDate = checkin;
  for (const d of nightsBetween(checkin, checkout)) {
    const board = buildRoomBoard(rooms, pool, d);
    const t = board.byType.find((x) => x.typeId === typeId);
    const f = t ? t.free : 0;
    if (f < free) {
      free = f;
      tightestDate = d;
    }
  }
  return { free, total, tightestDate };
}

/** คืนที่ต้องใช้ห้องจริง — วันเช็คเอาท์ไม่นับ (พัก 27→29 = ใช้ห้องคืน 27 กับ 28) */
export function nightsBetween(checkin: string, checkout: string): string[] {
  if (!checkin) return [];
  if (!checkout || checkout <= checkin) return [checkin];
  const out: string[] = [];
  const d = new Date(`${checkin}T12:00:00`);
  const end = new Date(`${checkout}T12:00:00`);
  while (d < end) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`
    );
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * แผนผังห้องพัก — แปลง "นัดเข้าพัก" เป็นภาพว่าห้องไหนมีใครอยู่ ห้องไหนว่างจริง
 *
 * ห้องในระบบเก็บเป็น "ประเภท" (MiNi Meow, Mid Cozy, Catflix) พร้อมจำนวนยูนิต
 * ส่วนการจองเก็บเป็นรายตัวแมว — แมวหลายตัวนอนห้องเดียวกันได้ ระบบจึงจับแมวของ
 * "บ้านเดียวกัน ช่วงวันเดียวกัน" ลงห้องเดียวกันให้ก่อนจนเต็มความจุ แล้วค่อยขึ้นห้องใหม่
 * (เช่น มา 3 ตัว ห้องจุ 2 → ห้องแรก 2 ตัว ห้องถัดไป 1 ตัว)
 *
 * ถ้าอยากจัดเอง ใส่เลขห้องที่ roomUnit ของนัดนั้น ระบบจะยึดตามที่ระบุ
 */

export type BoardRoomType = {
  id: string;
  name: string;
  /** จำนวนห้องจริง — ห้องเชื่อมเป็น 0 เพราะไม่ใช่ห้องของตัวเอง */
  count: number;
  /** จุแมวได้กี่ตัวต่อห้อง (ไม่ระบุ = 1) */
  maxCats?: number;
  /** ห้องเชื่อมประกอบจากห้องจริงอะไรบ้าง — ตั้งได้ต่อร้านในหน้าตั้งค่า */
  composedOf?: { typeId: string; units: number }[];
};

/**
 * ห้องเชื่อม = เอาห้องจริงที่อยู่ติดกันมาเปิดทะลุถึงกัน ไม่ใช่ห้องเพิ่ม
 * จองห้องเชื่อม 1 ห้อง = กินห้องจริงไปหลายห้อง ต้องคิดที่ว่างจากห้องจริงเสมอ
 * ไม่งั้นจะขายเกินจำนวนห้องที่มี หรือซ่อนห้องที่ยังรับลูกค้าได้
 *
 * แต่ละร้านตั้งเองว่าห้องเชื่อมของตัวเองประกอบจากห้องไหนบ้าง (ตั้งค่า > ห้องพัก)
 */
export function compositionOf(
  typeId: string,
  rooms: BoardRoomType[]
): { typeId: string; units: number }[] | undefined {
  const parts = rooms.find((r) => r.id === typeId)?.composedOf;
  return parts && parts.length > 0 ? parts : undefined;
}

export type BoardBooking = {
  id: string;
  catName: string;
  customerName: string;
  customerId?: string;
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
  capacity: number;
  /** แมวที่นอนอยู่ในคืนของวันนี้ (ห้องเดียวอาจมีหลายตัวถ้าเป็นบ้านเดียวกัน) */
  staying: BoardBooking[];
  /** แมวที่เช็คเอาท์ออกวันนี้ — ห้องจะว่างหลังเขาออก */
  leaving: BoardBooking[];
  /** มีตัวที่เพิ่งเข้าวันนี้ */
  arriving: boolean;
  /** วันนี้มีทั้งคนออกและคนเข้าในห้องเดียวกัน — ต้องเคลียร์ห้องให้ทัน */
  turnover: boolean;
  /** ใส่แมวเกินความจุห้อง (ปักหมุดเอง) — เตือนไว้ ไม่บล็อก */
  overCapacity: boolean;
  /** ห้องนี้ถูกใช้เป็นส่วนหนึ่งของห้องเชื่อม (เช่น Mini Duo) — ชื่อห้องเชื่อมที่ยึดอยู่ */
  partOf?: string;
};

export type RoomBoard = {
  units: UnitState[];
  byType: {
    typeId: string;
    typeName: string;
    total: number;
    /** ห้องที่มีแมวอยู่ (นับเป็นห้อง ไม่ใช่จำนวนตัว) */
    occupied: number;
    free: number;
    cats: number;
    units: UnitState[];
  }[];
  totalUnits: number;
  occupied: number;
  free: number;
  /** จำนวนแมวที่พักอยู่ทั้งหมดในวันนั้น */
  cats: number;
  isFull: boolean;
  turnovers: UnitState[];
  /** จองเกินจำนวนห้องที่มี — ต้องเห็นทันที ไม่ใช่ปล่อยให้ห้องหาย */
  overflow: BoardBooking[];
};

const isLive = (b: BoardBooking) => b.status !== "cancelled" && b.status !== "no_show";

/**
 * ห้องนี้จุแมวได้กี่ตัว — ใช้ค่าที่ร้านตั้งไว้เท่านั้น ไม่ระบุ = 1
 * ไม่เดาจากข้อความโฆษณา เพราะแต่ละร้านเขียนคนละแบบ เดาต่ำไปจะรับลูกค้าได้น้อยกว่าที่ทำได้จริง
 */
export function roomCapacity(type: { maxCats?: number }): number {
  return type.maxCats && type.maxCats > 0 ? Math.floor(type.maxCats) : 1;
}

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

/** บ้านเดียวกัน ช่วงวันเดียวกัน = นอนห้องเดียวกันได้ */
const householdKey = (b: BoardBooking) =>
  [b.customerId || b.customerName, b.checkin || "", b.checkout || ""].join("|");

/**
 * สร้างผังห้องของวันหนึ่ง
 * @param rooms ประเภทห้อง + จำนวนยูนิต + ความจุ (จาก config)
 * @param bookings นัดทั้งหมด (กรอง service/ยกเลิก ให้เองข้างใน)
 */
export function buildRoomBoard(
  rooms: BoardRoomType[],
  bookings: BoardBooking[],
  date: string
): RoomBoard {
  const relevant = bookings.filter(
    (b) => b.service === "room" && isLive(b) && (isStayingOn(b, date) || isLeavingOn(b, date))
  );

  const units: UnitState[] = [];
  const byType: RoomBoard["byType"] = [];
  const overflow: BoardBooking[] = [];

  // ห้องเชื่อมไม่มีห้องของตัวเอง — โผล่ในผังโดยกินห้องจริงที่เป็นส่วนประกอบ
  const physical = rooms.filter((r) => (r.count || 0) > 0);
  const unitsByType = new Map<string, UnitState[]>();

  for (const type of physical) {
    const count = Math.max(0, type.count || 0);
    const capacity = Math.max(1, type.maxCats || 1);
    const typeUnits: UnitState[] = Array.from({ length: count }, (_, i) => ({
      typeId: type.id,
      typeName: type.name,
      unit: i + 1,
      capacity,
      staying: [],
      leaving: [],
      arriving: false,
      turnover: false,
      overCapacity: false,
    }));

    unitsByType.set(type.id, typeUnits);

    // จองของห้องประเภทนี้ — เทียบทั้ง id และชื่อ เพราะข้อมูลเก่าบางแถวเก็บเป็นชื่อ
    const mine = relevant
      .filter((b) => {
        const r = (b.room || "").trim();
        return r === type.id || r === type.name;
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    const put = (b: BoardBooking, slot: UnitState) => {
      if (isLeavingOn(b, date)) slot.leaving.push(b);
      else {
        slot.staying.push(b);
        if (b.checkin === date) slot.arriving = true;
      }
    };

    // 1) ปักหมุดห้องที่ระบุเลขไว้ก่อน — คนที่จัดห้องเองต้องได้ห้องนั้นจริง
    const unpinned: BoardBooking[] = [];
    for (const b of mine) {
      const u = b.roomUnit;
      const slot = u && u >= 1 && u <= count ? typeUnits[u - 1] : undefined;
      if (slot) put(b, slot);
      else unpinned.push(b);
    }

    // 2) ที่เหลือ จัดเป็นบ้านๆ — แมวบ้านเดียวกันอยู่ห้องเดียวกันจนเต็มความจุ
    const households = new Map<string, BoardBooking[]>();
    for (const b of unpinned) {
      const k = householdKey(b);
      const list = households.get(k);
      if (list) list.push(b);
      else households.set(k, [b]);
    }

    for (const group of households.values()) {
      for (const b of group) {
        const leaving = isLeavingOn(b, date);
        const roomFor = (s: UnitState) => {
          const here = leaving ? s.leaving : s.staying;
          if (here.length >= s.capacity) return false;
          // ห้องที่มีคนอื่นอยู่แล้ว ห้ามเอาแมวคนละบ้านไปยัดรวม
          return here.length === 0 || householdKey(here[0]) === householdKey(b);
        };
        const slot = typeUnits.find(roomFor);
        if (slot) put(b, slot);
        else overflow.push(b);
      }
    }

    units.push(...typeUnits);
  }

  // ── ห้องเชื่อม — กินห้องจริงตามส่วนประกอบ (Mini Duo = MiNi Meow 2 ห้องติดกัน) ──
  // เลือกห้องที่ติดกันก่อนเสมอ เพราะเปิดทะลุถึงกันได้จริงเฉพาะห้องที่อยู่ติดกัน
  for (const type of rooms) {
    const parts = compositionOf(type.id, rooms);
    if (!parts) continue;
    const mine = relevant
      .filter((b) => {
        const r = (b.room || "").trim();
        return r === type.id || r === type.name;
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    if (mine.length === 0) continue;

    // แมวบ้านเดียวกันช่วงเดียวกัน = อยู่ห้องเชื่อมชุดเดียวกัน ไม่ต้องกินห้องเพิ่ม
    const households = new Map<string, BoardBooking[]>();
    for (const b of mine) {
      const k = householdKey(b);
      const list = households.get(k);
      if (list) list.push(b);
      else households.set(k, [b]);
    }

    for (const group of households.values()) {
      const claimed: UnitState[] = [];
      let ok = true;
      for (const part of parts) {
        const pool = unitsByType.get(part.typeId) || [];
        const freeUnits = pool.filter(
          (s) => s.staying.length === 0 && s.leaving.length === 0 && !s.partOf
        );
        // หาชุดที่เลขห้องติดกันก่อน ถ้าไม่มีค่อยเอาห้องว่างเท่าที่มี
        let pick = freeUnits.slice(0, part.units);
        if (part.units > 1) {
          const adjacent: UnitState[] = [];
          for (let i = 0; i + part.units - 1 < freeUnits.length; i++) {
            const window = freeUnits.slice(i, i + part.units);
            const contiguous = window.every(
              (s, j) => j === 0 || s.unit === window[j - 1].unit + 1
            );
            if (contiguous) {
              adjacent.push(...window);
              break;
            }
          }
          if (adjacent.length === part.units) pick = adjacent;
        }
        if (pick.length < part.units) {
          ok = false;
          break;
        }
        claimed.push(...pick);
      }

      if (!ok) {
        overflow.push(...group);
        continue;
      }
      // ห้องแรกของชุดเก็บรายชื่อแมว ที่เหลือทำเครื่องหมายว่าถูกยึดโดยห้องเชื่อมนี้
      for (const s of claimed) s.partOf = type.name;
      const host = claimed[0];
      for (const b of group) {
        if (isLeavingOn(b, date)) host.leaving.push(b);
        else {
          host.staying.push(b);
          if (b.checkin === date) host.arriving = true;
        }
      }
    }
  }

  for (const type of physical) {
    const typeUnits = unitsByType.get(type.id) || [];
    for (const s of typeUnits) {
      s.turnover = s.leaving.length > 0 && s.staying.length > 0;
      s.overCapacity = s.staying.length > s.capacity || s.leaving.length > s.capacity;
    }
    // ห้องที่ถูกห้องเชื่อมยึดไว้ ถือว่าไม่ว่าง แม้แถวนั้นจะไม่มีชื่อแมว
    const occupied = typeUnits.filter((s) => s.staying.length > 0 || s.partOf).length;
    byType.push({
      typeId: type.id,
      typeName: type.name,
      total: type.count || 0,
      occupied,
      free: (type.count || 0) - occupied,
      cats: typeUnits.reduce((n, s) => n + s.staying.length, 0),
      units: typeUnits,
    });
  }

  const totalUnits = units.length;
  const occupied = units.filter((s) => s.staying.length > 0 || s.partOf).length;
  return {
    units,
    byType,
    totalUnits,
    occupied,
    free: totalUnits - occupied,
    cats: units.reduce((n, s) => n + s.staying.length, 0),
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
  const parts = compositionOf(typeId, rooms);
  const pool = ignoreBookingId ? bookings.filter((b) => b.id !== ignoreBookingId) : bookings;

  // ห้องเชื่อมขายได้กี่ชุด = ห้องจริงที่ว่างหารด้วยจำนวนห้องที่ต้องใช้ (ส่วนประกอบที่ตึงที่สุด)
  const totalFor = (board: RoomBoard | null) => {
    if (!parts) return type?.count || 0;
    return Math.min(
      ...parts.map((p) => {
        const t = board
          ? board.byType.find((x) => x.typeId === p.typeId)
          : undefined;
        const avail = board
          ? t?.free ?? 0
          : rooms.find((r) => r.id === p.typeId)?.count || 0;
        return Math.floor(avail / p.units);
      })
    );
  };

  const total = totalFor(null);
  let free = total;
  let tightestDate = checkin;
  for (const d of nightsBetween(checkin, checkout)) {
    const board = buildRoomBoard(rooms, pool, d);
    const f = parts
      ? totalFor(board)
      : board.byType.find((x) => x.typeId === typeId)?.free ?? 0;
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

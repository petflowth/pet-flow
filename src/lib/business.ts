export const BUSINESS = {
  name: "CatCha Hotel",
  tagline: { th: "โรงแรมแมว · อาบน้ำ & กรูมมิ่ง", en: "Cat Hotel · Grooming & Spa" },
  lineOa: "@catchahotel",
  phones: ["080-549-8969", "095-324-6989"],
  maps: "https://maps.app.goo.gl/u38pzVGa9LiEsLEK8",
  facebook: "catcha hotel",
  location: {
    th: "บางนา เมกะ เทพารักษ์ สมุทรปราการ",
    en: "Bang Na, Mega Bangna, Samut Prakan",
  },
  pointsRate: 100, // บาท = 1 แต้ม
} as const;

/** ห้องจริงทั้งหมด 13 ยูนิต */
export const ROOM_INVENTORY = {
  total: 13,
  miniMeow: 6, // S
  midCozy: 6, // M
  catflix: 1, // Netflix / Window with View
} as const;

export type RoomSize = "S" | "M" | "S+S" | "M+M" | "S+M";

export type RoomType = {
  id: string;
  name: string;
  subtitle?: { th: string; en: string };
  size: RoomSize;
  /** จำนวนยูนิต (เฉพาะห้องเดี่ยว) */
  count?: number;
  price: number;
  cats: { th: string; en: string };
  extra: { th: string; en: string };
  dimensions?: { th: string; en: string };
  /** ห้องเชื่อม — อธิบายการจัด */
  config?: { th: string; en: string };
  note?: { th: string; en: string };
};

/** ประเภทห้องที่จองได้ (รวมห้องเชื่อม) */
export const ROOMS: RoomType[] = [
  {
    id: "mini-meow",
    name: "MiNi Meow",
    size: "S",
    count: 6,
    price: 350,
    cats: { th: "1 แมว", en: "1 cat" },
    extra: { th: "แมวที่ 2 +50", en: "2nd cat +50" },
    dimensions: { th: "90×100×110 ซม.", en: "90×100×110 cm" },
    note: {
      th: "กล้อง CCTV +100/ครั้ง · พัก 7 วันขึ้นไป ฟรี",
      en: "CCTV +100/stay · free for 7+ nights",
    },
  },
  {
    id: "mid-cozy",
    name: "Mid Cozy Room",
    size: "M",
    count: 6,
    price: 450,
    cats: { th: "1–2 แมว", en: "1–2 cats" },
    extra: { th: "แมวที่ 3 +50", en: "3rd cat +50" },
    dimensions: { th: "90×100×150 ซม.", en: "90×100×150 cm" },
    note: {
      th: "กล้อง CCTV +100/ครั้ง · พัก 7 วันขึ้นไป ฟรี",
      en: "CCTV +100/stay · free for 7+ nights",
    },
  },
  {
    id: "catflix",
    name: "Catflix & Chill",
    subtitle: { th: "Window with View", en: "Window with View" },
    size: "M",
    count: 1,
    price: 750,
    cats: { th: "1–3 แมว", en: "1–3 cats" },
    extra: { th: "แมวที่ 4 +50", en: "4th cat +50" },
    dimensions: { th: "100×160×260 ซม.", en: "100×160×260 cm" },
    note: {
      th: "ฟรีกล้อง CCTV 24 ชม. · ฟรีน้ำพุแมวไร้สาย",
      en: "Free 24h CCTV · free wireless cat fountain",
    },
  },
  {
    id: "mini-duo",
    name: "Mini Duo",
    size: "S+S",
    price: 600,
    cats: { th: "1–3 แมว", en: "1–3 cats" },
    extra: { th: "แมวที่ 4 +50", en: "4th cat +50" },
    config: {
      th: "2 ห้อง S · ประตูเชื่อม",
      en: "2 S rooms · connecting door",
    },
    note: {
      th: "กล้อง CCTV +100/ครั้ง · น้ำพุเช่า +50/ครั้ง",
      en: "CCTV +100/stay · fountain rental +50",
    },
  },
  {
    id: "cozy-duo",
    name: "Cozy Duo",
    size: "M+M",
    price: 750,
    cats: { th: "1–4 แมว", en: "1–4 cats" },
    extra: { th: "แมวที่ 5 +50", en: "5th cat +50" },
    config: {
      th: "2 ห้อง M · ประตูเชื่อม",
      en: "2 M rooms · connecting door",
    },
    note: {
      th: "ฟรีกล้อง CCTV 24 ชม. · ฟรีน้ำพุแมวไร้สาย",
      en: "Free 24h CCTV · free wireless cat fountain",
    },
  },
  {
    id: "cat-tower",
    name: "Cat Tower Suite",
    size: "S+M",
    price: 700,
    cats: { th: "1–4 แมว", en: "1–4 cats" },
    extra: { th: "แมวที่ 5 +50", en: "5th cat +50" },
    config: {
      th: "ห้อง S + M · ประตูเชื่อม",
      en: "S + M rooms · connecting door",
    },
    note: {
      th: "กล้อง CCTV +100/ครั้ง · พัก 7 วันขึ้นไป ฟรี",
      en: "CCTV +100/stay · free for 7+ nights",
    },
  },
];

export const ROOM_AMENITIES = {
  th: [
    "พี่เลี้ยงทำความสะอาดห้องทุกวัน",
    "บริการถาดน้ำ อาหาร กระบะทราย",
    "จุดปลั๊กไฟ (เอาน้ำพุแมวมาใช้ได้ฟรี)",
    "พี่เลี้ยงพาเล่น/เดินเล่น วันละ 2 รอบ",
  ],
  en: [
    "Daily room cleaning",
    "Water, food & litter service",
    "Power outlet (bring your own fountain free)",
    "Playtime twice daily",
  ],
} as const;

/** บริการรับส่งน้องแมว */
export const TRANSPORT = {
  th: [
    "≤ 1 กม. ฟรีรับ-ส่ง",
    "≤ 5 กม. 100 บาท",
    "≤ 10 กม. 150 บาท",
    "> 10 กม. 150 บาท + 10 บาท/กม.",
  ],
  en: [
    "≤ 1 km free",
    "≤ 5 km 100 THB",
    "≤ 10 km 150 THB",
    "> 10 km 150 THB + 10 THB/km",
  ],
} as const;

/** แลกแต้ม — 100 บาท = 1 แต้ม */
export const POINTS_REWARDS = [
  { points: 5, reward: { th: "ทรีทเหลวพรีเมียม 1 ซอง หรือของเล่นแมว", en: "Premium treat or cat toy" } },
  { points: 10, reward: { th: "คูปองส่วนลด 50 บาท", en: "50 THB coupon" } },
  { points: 20, reward: { th: "คูปองส่วนลด 100 บาท", en: "100 THB coupon" } },
  { points: 30, reward: { th: "คูปองส่วนลด 200 บาท", en: "200 THB coupon" } },
  { points: 40, reward: { th: "คูปองส่วนลด 500 บาท", en: "500 THB coupon" } },
] as const;

export const GROOM_SLOTS = ["09:30", "12:30", "15:30"] as const;

export type Locale = "th" | "en";

export type BookingStatus = "pending" | "confirmed";

export type Booking = {
  id: string;
  customerName: string;
  catName: string;
  service: "groom" | "room";
  date: string;
  time?: string;
  checkout?: string;
  roomType?: string;
  status: BookingStatus;
  checkinTime?: string;
};

export type CustomerProfile = {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  points: number;
};

export const DEMO_BOOKINGS: Booking[] = [
  {
    id: "B001",
    customerName: "คุณมาย",
    catName: "น้องส้ม",
    service: "groom",
    date: "2026-07-23",
    time: "12:30",
    status: "pending",
  },
];

export const DEMO_PROMOS = [
  {
    id: "P1",
    title: { th: "สมาชิกใหม่ รับแต้ม x2", en: "New member double points" },
    body: {
      th: "จองครั้งแรกรับแต้มสะสม 2 เท่า 🧡",
      en: "First booking earns 2x loyalty points 🧡",
    },
    until: "2026-08-31",
  },
  {
    id: "P2",
    title: { th: "พัก 7 คืนขึ้นไป ฟรีกล้อง CCTV", en: "7+ nights free CCTV" },
    body: {
      th: "ห้อง MiNi Meow / Mid Cozy / Cat Tower รับฟรีกล้องวงจรปิด",
      en: "MiNi Meow, Mid Cozy & Cat Tower — free CCTV for 7+ nights",
    },
    until: "2026-12-31",
  },
];

export function getRoomById(id: string) {
  return ROOMS.find((r) => r.id === id);
}

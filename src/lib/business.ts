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

export const ROOMS = [
  {
    id: "catflix",
    name: "Catflix & Chill",
    subtitle: { th: "Window with View", en: "Window with View" },
    price: 750,
    cats: { th: "1–3 แมว", en: "1–3 cats" },
    extra: { th: "ตัวที่ 4 +50", en: "4th cat +50" },
  },
  {
    id: "midcozy",
    name: "Mid Cozy Room",
    price: 450,
    cats: { th: "1–2 แมว", en: "1–2 cats" },
    extra: { th: "ตัวที่ 3 +50", en: "3rd cat +50" },
  },
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

// ตัวอย่าง — จะต่อ Supabase ทีหลัง
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
      th: "ห้อง Mid Cozy รับฟรีกล้องวงจรปิดตลอดการเข้าพัก",
      en: "Mid Cozy stays 7+ nights include free CCTV",
    },
    until: "2026-12-31",
  },
];

import type { Locale } from "./business";

const messages = {
  th: {
    nav: { home: "หน้าแรก", bookings: "คิวของฉัน", points: "แต้มสะสม", promos: "โปรโมชั่น" },
    home: {
      greeting: "สวัสดี",
      subtitle: "ยินดีต้อนรับสู่ CatCha Hotel 🐱",
      services: "บริการของเรา",
      groom: "อาบน้ำ / กรูมมิ่ง",
      room: "ห้องพักแมว",
      contact: "ติดต่อเรา",
      call: "โทร",
      map: "ดูแผนที่",
      slots: "รอบเวลา",
      perNight: "บาท/คืน",
      roomsTotal: "ทั้งหมด 13 ห้อง",
      roomUnits: "ห้อง",
      suite: "ห้องเชื่อม",
    },
    bookings: {
      title: "คิวของฉัน",
      empty: "ยังไม่มีนัดค่ะ — ทัก LINE @catchahotel เพื่อจอง",
      pending: "รอยืนยัน",
      confirmed: "ยืนยันแล้ว",
      confirm: "ยืนยันนัด",
      checkin: "เลือกเวลาเช็คอิน",
      groom: "อาบน้ำ",
      room: "ห้องพัก",
    },
    points: {
      title: "แต้มสะสม",
      balance: "แต้มของคุณ",
      rate: "ทุก 100 บาท = 1 แต้ม",
      history: "ประวัติแต้ม",
      empty: "ยังไม่มีประวัติ",
    },
    promos: {
      title: "โปรโมชั่น",
      until: "ถึง",
    },
    admin: {
      login: "เข้าสู่ระบบเจ้าของ",
      code: "รหัสผ่าน",
      enter: "เข้าใช้งาน",
      dashboard: "แดชบอร์ด",
      newBooking: "บันทึกจอง",
      today: "วันนี้",
      week: "สัปดาห์นี้",
      sendCard: "ส่งการ์ด",
      customers: "ลูกค้า",
      logout: "ออกจากระบบ",
    },
    common: { lang: "EN", loading: "กำลังโหลด...", save: "บันทึก" },
  },
  en: {
    nav: { home: "Home", bookings: "My bookings", points: "Points", promos: "Promos" },
    home: {
      greeting: "Hello",
      subtitle: "Welcome to CatCha Hotel 🐱",
      services: "Our services",
      groom: "Grooming & Spa",
      room: "Cat boarding",
      contact: "Contact",
      call: "Call",
      map: "Directions",
      slots: "Time slots",
      perNight: "THB/night",
      roomsTotal: "13 rooms total",
      roomUnits: "units",
      suite: "Connected suite",
    },
    bookings: {
      title: "My bookings",
      empty: "No bookings yet — chat us on LINE @catchahotel",
      pending: "Pending",
      confirmed: "Confirmed",
      confirm: "Confirm",
      checkin: "Pick check-in time",
      groom: "Grooming",
      room: "Boarding",
    },
    points: {
      title: "Loyalty points",
      balance: "Your points",
      rate: "100 THB = 1 point",
      history: "History",
      empty: "No history yet",
    },
    promos: {
      title: "Promotions",
      until: "Until",
    },
    admin: {
      login: "Staff login",
      code: "Access code",
      enter: "Sign in",
      dashboard: "Dashboard",
      newBooking: "New booking",
      today: "Today",
      week: "This week",
      sendCard: "Send card",
      customers: "Customers",
      logout: "Log out",
    },
    common: { lang: "ไทย", loading: "Loading...", save: "Save" },
  },
} as const;

export type Messages = (typeof messages)["th"];

export function t(locale: Locale) {
  return messages[locale];
}

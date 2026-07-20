# 🔗 PetFlow — สรุปลิงก์ทั้งระบบ

**Base URL (production):** `https://petflow-demo-1.vercel.app`

> ถ้าผูก custom domain ในอนาคต ให้แทนที่ `https://petflow-demo-1.vercel.app` ด้วยโดเมนใหม่ — เส้นทาง (path) หลังจากนั้นเหมือนเดิมทุกอัน

---

## 3 ประตูหลักที่ต้องจำ
| ใคร | เข้าที่ |
|---|---|
| 🧑 ลูกค้า (ผ่าน LINE) | `…/app` |
| 🛠️ เจ้าของร้าน (หลังบ้าน) | `…/admin/login` |
| 🏢 เจ้าของระบบ SaaS (ดูทุกร้าน) | `…/platform/login` |

---

## 🌐 หน้าสาธารณะ / การตลาด
| หน้า | ลิงก์ |
|---|---|
| หน้าแรก = หน้าขาย PetFlow | `/` |
| หน้าขาย PetFlow (ตรงๆ) | `/petflow.html` |
| หน้า SEO โรงแรมแมว (demo) | `/cat-hotel` |
| หน้า SEO อาบน้ำแมว | `/cat-bath` |
| บทความ / บล็อก | `/blog` |
| บทความรายตัว | `/blog/[slug]` |

## 👤 ฝั่งลูกค้า (เปิดผ่าน LINE / LIFF)
| หน้า | ลิงก์ |
|---|---|
| หน้าหลักลูกค้า | `/app` |
| ลงทะเบียน | `/app/register` |
| จองคิว | `/app/bookings` |
| เลือกเวลา | `/app/booking-time` |
| ห้องพัก | `/app/rooms` · `/app/rooms/[id]` |
| บริการ | `/app/services` |
| อาบน้ำ/ตัดขน | `/app/grooming` · `/app/groom-info` |
| แต้มสะสม | `/app/points` |
| คูปอง | `/app/coupons` · `/app/claim-coupon` |
| โปรโมชัน | `/app/promos` |
| โปรไฟล์ | `/app/profile` |
| ยินยอม (consent) | `/app/consent` |
| เชื่อมบัญชี LINE | `/app/link` |
| จ่ายเงิน | `/app/pay/[id]` |

## 🛠️ หลังบ้านร้าน (Admin / เจ้าของร้าน)
| หน้า | ลิงก์ |
|---|---|
| เข้าสู่ระบบหลังบ้าน | `/admin/login` |
| แดชบอร์ด | `/admin` |
| คิดเงิน / บิล | `/admin/billing` |
| การเงิน / สรุป | `/admin/finance` |
| สถิติ / insights | `/admin/insights` |
| ลูกค้า | `/admin/customers` |
| จองใหม่ | `/admin/bookings/new` |
| ตารางงาน | `/admin/schedule` |
| พนักงาน | `/admin/staff` |
| แพ็กเกจ | `/admin/packages` |
| คูปอง | `/admin/coupons` |
| โปรโมชัน | `/admin/promos` |
| การ์ด/สมาชิก | `/admin/cards` |
| บทความ | `/admin/articles` |
| ถังขยะ (กู้คืน) | `/admin/trash` |
| ตั้งค่า | `/admin/settings` |
| ติดตั้งระบบ (ครั้งแรก) | `/admin/setup` |

## 🏢 Super Admin (เจ้าของ SaaS — ดูทุกร้าน)
| หน้า | ลิงก์ |
|---|---|
| เข้าสู่ระบบ platform | `/platform/login` |
| แดชบอร์ด platform | `/platform` |

---

## 📦 Repo & Deploy
| รายการ | ค่า |
|---|---|
| GitHub repo | `github.com/petflowth/pet-flow` |
| Vercel production | `https://petflow-demo-1.vercel.app` |
| Deploy trigger | `git push origin main` → Vercel auto-build |
| Region | `sin1` (สิงคโปร์) |

_อัปเดตล่าสุด: 2026-07-20_

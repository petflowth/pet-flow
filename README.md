# PetFlow Web v2

เว็บใหม่แยก — หน้าลูกค้า (LINE LIFF) + หลังบ้านเจ้าของ

## รัน dev

```bash
cd web
npm install
npm run dev
```

- **ลูกค้า:** http://localhost:3000/app
- **หลังบ้าน:** http://localhost:3000/admin/login (รหัสเริ่มต้น `petflow2026`)

## Deploy (Vercel) — เจ้าของทำครั้งเดียว

1. Push repo ไป GitHub
2. เข้า [vercel.com](https://vercel.com) → Import project → เลือกโฟลเดอร์ `webapp`
3. ใส่ Environment Variables:

| ตัวแปร | ค่า |
|--------|-----|
| `NEXT_PUBLIC_LIFF_ID` | LIFF ID จาก LINE Developers |
| `NEXT_PUBLIC_ADMIN_CODE` | รหัสหลังบ้านที่ต้องการ |

4. Deploy → ได้ URL เช่น `https://petflow.vercel.app`
5. ตั้ง LIFF Endpoint = `https://your-url.app/app`
6. ใส่ลิงก์ใน Rich Menu LINE OA @petflow

## โครงสร้าง

```
/app          หน้าลูกค้า (LIFF)
/admin        หลังบ้านเจ้าของ
```

## ถัดไป (จะต่อให้)

- Supabase ฐานข้อมูลจริง
- Google Calendar API
- LINE Messaging API ส่งการ์ด + cron เที่ยง
- ชำระเงินออนไลน์

ดู `DESIGN_BRIEF.md` สำหรับสเปคเต็ม

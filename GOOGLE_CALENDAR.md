# Google Calendar — PetFlow

ตอนจองใหม่ ระบบจะ **สร้าง event ในปฏิทิน PetFlow อัตโนมัติ**  
เมื่อลูกค้ายืนยัน → เปลี่ยนสี + ใส่ ✅ ในชื่อ event

---

## สิ่งที่ต้องมี

| Env (Vercel) | ค่า |
|--------------|-----|
| `GOOGLE_CALENDAR_ID` | ID ปฏิทิน เช่น `xxx@group.calendar.google.com` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `petflow-calendar@....iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | Private key ทั้งก้อน (รวม `-----BEGIN...`) |

ถ้ายังไม่ใส่ → ระบบยังจองได้ แต่ได้แค่ลิงก์ Google Calendar + ไฟล์ iCal

---

## ตั้งค่า (ครั้งเดียว ~10 นาที)

### 1. สร้าง Service Account
1. [Google Cloud Console](https://console.cloud.google.com/) → สร้างโปรเจกต์ (หรือใช้ของเดิม)
2. **APIs & Services** → **Library** → เปิด **Google Calendar API**
3. **Credentials** → **Create credentials** → **Service account**
4. สร้าง key แบบ **JSON** → เก็บไฟล์ไว้

จากไฟล์ JSON:
- `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` → `GOOGLE_PRIVATE_KEY` (วางใน Vercel ทั้งก้อน, `\n` ได้)

### 2. แชร์ปฏิทิน PetFlow
1. เปิด [Google Calendar](https://calendar.google.com/)
2. ปฏิทิน **PetFlow** → **Settings and sharing**
3. **Share with specific people** → เพิ่ม **service account email**
4. สิทธิ์: **Make changes to events**
5. ก็อป **Calendar ID** (Integrate calendar) → `GOOGLE_CALENDAR_ID`

### 3. ใส่ Vercel + Redeploy

### 4. ทดสอบ
1. Admin → **จองใหม่** → บันทึก
2. เปิด Google Calendar → ปฏิทิน **PetFlow** → ต้องเห็นนัด 🏠 หรือ 🛁

---

## สีใน Calendar

| ประเภท | สี |
|--------|-----|
| ห้องพัก | น้ำเงิน |
| อาบน้ำ | เหลือง |
| ยืนยันแล้ว ✅ | เขียว |

---

## ถ้าไม่ขึ้น

- Service account ต้องมีสิทธิ์ **Make changes** บนปฏิทินนั้น
- `GOOGLE_PRIVATE_KEY` ใน Vercel ต้องมีบรรทัดใหม่จริง (หรือใช้ `\n`)
- `GOOGLE_CALENDAR_ID` ต้องเป็น ID ของปฏิทิน **PetFlow** ไม่ใช่ปฏิทินส่วนตัว
- เจ้าของ 2 คนต้อง **ติ๊กเปิดแสดง** ปฏิทิน PetFlow ใน Google Calendar มือถือ/คอม

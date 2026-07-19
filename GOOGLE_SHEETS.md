# Google Sheets Export — PetFlow

ส่งออก **ข้อมูลลูกค้า** และ **รายรับ-รายจ่าย** ไป Google Spreadsheet เดียว (2 แท็บ)

---

## ปุ่มส่งออกอยู่ที่ไหน

- Admin → **ลูกค้า** → 📊 ส่งออก Google Sheets
- Admin → **การเงิน** → 📊 ส่งออก Google Sheets
- Admin → **ตั้งค่า** → ขั้นสูง

---

## แท็บใน Spreadsheet

| แท็บ | ข้อมูล |
|------|--------|
| **ลูกค้า** | ชื่อ, เบอร์, LINE, สมาชิก, เครดิต, แมว, โน้ตพนักงาน |
| **รายรับรายจ่าย** | วันที่, ประเภท, จำนวน, หมวด, รายละเอียด |

ทุกครั้งที่กดส่งออก → **เขียนทับข้อมูลเดิม** ในแท็บนั้น (ข้อมูลล่าสุดจาก Supabase)

---

## ตั้งค่า (ใช้ Service Account เดียวกับ Calendar)

### 1. เปิด Google Sheets API
ใน [Google Cloud Console](https://console.cloud.google.com/) → APIs → เปิด **Google Sheets API**  
(ใช้ service account ชุดเดียวกับ Calendar ได้)

### 2. สร้าง Spreadsheet
1. [sheets.google.com](https://sheets.google.com) → สร้างชีตใหม่ เช่น **PetFlow — Data**
2. ก็อป **Spreadsheet ID** จาก URL  
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`

### 3. แชร์ให้ Service Account
1. กด **Share** บนชีต
2. เพิ่ม email ของ service account (`...@....iam.gserviceaccount.com`)
3. สิทธิ์: **Editor**

### 4. ใส่ Vercel

| Env | ค่า |
|-----|-----|
| `GOOGLE_SPREADSHEET_ID` | ID จาก URL ชีต |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | (เหมือน Calendar) |
| `GOOGLE_PRIVATE_KEY` | (เหมือน Calendar) |

Redeploy แล้วกด **📊 ส่งออก Google Sheets**

---

## หมายเหตุ

- รูปแมว (base64) **ไม่ส่งออก** — มีแค่ชื่อแมว + โน้ต
- ถ้ายังไม่ตั้ง env → ปุ่มจะแจ้ง error ภาษาไทย
- แท็บจะถูกสร้างอัตโนมัติถ้ายังไม่มี

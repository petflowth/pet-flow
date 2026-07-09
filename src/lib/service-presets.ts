/**
 * รายการบริการสำเร็จรูปสำหรับหน้าคิดเงิน (เลือกแล้วราคาเด้งเอง)
 * ราคาปรับได้หลังเลือก · ห้องพักดึงจาก config.rooms อัตโนมัติ
 * TODO(config-driven): ย้ายไปแก้ในหน้าตั้งค่าได้ (ดู memory: prefer-config-driven-no-code-edits)
 */
export type ServicePreset = { label: string; amount: number };

export const SERVICE_PRESETS: ServicePreset[] = [
  { label: "อาบน้ำ – เป่าขน", amount: 350 },
  { label: "อาบน้ำ + ขจัดคราบมัน", amount: 450 },
  { label: "ตัดขน / กรูมมิ่ง", amount: 600 },
  { label: "ตัดเล็บ", amount: 100 },
  { label: "แปรงฟัน", amount: 150 },
  { label: "หยดยาป้องกันปรสิต (NexGard Combo)", amount: 360 },
  { label: "รับ-ส่ง", amount: 100 },
];

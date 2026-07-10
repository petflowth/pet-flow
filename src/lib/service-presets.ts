/**
 * รายการบริการสำเร็จรูปสำหรับหน้าคิดเงิน (เลือกแล้วราคาเด้งเอง)
 * ราคาปรับได้หลังเลือก · ห้องพักดึงจาก config.rooms อัตโนมัติ
 * TODO(config-driven): ย้ายไปแก้ในหน้าตั้งค่าได้ (ดู memory: prefer-config-driven-no-code-edits)
 */
export type ServicePreset = { label: string; amount: number };

export const SERVICE_PRESETS: ServicePreset[] = [
  { label: "ตัดเล็บ", amount: 100 },
  { label: "แปรงฟัน", amount: 150 },
  { label: "แก้สางขนพันแน่น", amount: 100 },
  { label: "ขจัดคราบเหลืองฝังแน่น (เฉพาะจุด)", amount: 200 },
  { label: "หยดยาป้องกันปรสิต (NexGard Combo)", amount: 360 },
  { label: "รับ-ส่ง", amount: 100 },
  { label: "น้ำพุแมว", amount: 80 },
  { label: "กล้องวงจรปิด (ต่อครั้ง)", amount: 100 },
];

/** แปลงรูปเป็น JPEG เสมอ — กันเคสรูป HEIC จาก iPhone ที่เบราว์เซอร์ส่วนใหญ่ (Android/คอม) เปิดไม่ได้ */
export async function toJpegDataUrl(file: File, maxSize = 1000): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(new Error("เปิดไฟล์รูปนี้ไม่ได้ — ลองเลือกรูปอื่น (jpg/png) ดูนะคะ"));
      el.src = objectUrl;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("แปลงรูปไม่สำเร็จ");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

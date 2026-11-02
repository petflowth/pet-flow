/**
 * เขียนคอลัมน์ที่เพิ่มมาทีหลัง แบบไม่ให้ข้อมูลหายเงียบ ๆ
 *
 * supabase-js ไม่ throw ตอนเขียนพลาด (คืน { error } แทน) — โค้ดเดิมที่ห่อด้วย try/catch
 * หรือ .then(() => {}, () => {}) เลยกลืน error หมด: ร้านกรอกแล้วขึ้นว่าบันทึกแล้ว แต่ข้อมูลไม่ลงฐาน
 * ตัวนี้: เขียน → ถ้าพลาด รัน migration ของคอลัมน์นั้นให้เอง (+ reload schema) → เขียนใหม่
 * คืน true ถ้าบันทึกสำเร็จ
 */
type WriteResult = { error: { message: string } | null };

export async function healWrite(
  table: string,
  cols: string[],
  write: () => PromiseLike<WriteResult>
): Promise<boolean> {
  try {
    const { error } = await write();
    if (!error) return true;
    const { ensureColumns } = await import("./migrations");
    if (await ensureColumns(table, cols)) {
      const res = await write();
      if (!res.error) return true;
      console.error(`[healWrite] ${table}.${cols.join(",")} still failing:`, res.error.message);
    } else {
      console.error(`[healWrite] ${table}.${cols.join(",")} failed:`, error.message);
    }
  } catch (e) {
    console.error(`[healWrite] ${table}.${cols.join(",")} threw:`, e);
  }
  return false;
}

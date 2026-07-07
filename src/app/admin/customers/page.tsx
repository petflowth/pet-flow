export default function CustomersPage() {
  const customers = [
    { name: "คุณมาย", cat: "น้องส้ม", visits: 5, points: 42, note: "อาบง่าย ไม่ดุ" },
    { name: "คุณฟ้า", cat: "น้องเหมียว", visits: 2, points: 18, note: "ลูกค้าใหม่ — ขนายาว" },
  ];

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-catcha-chocolate">
        👤 ประวัติลูกค้า
      </h1>
      <ul className="space-y-3">
        {customers.map((c) => (
          <li
            key={c.name}
            className="rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-brown">
                  {c.cat} <span className="text-brown-soft">· {c.name}</span>
                </p>
                <p className="mt-1 text-xs text-brown-soft">{c.note}</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-bold text-latte-deep">{c.points} แต้ม</p>
                <p className="text-brown-faint">{c.visits} ครั้ง</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-center text-xs text-brown-faint">
        🐱 ประวัติรูปน้องแมว — เพิ่มในเฟสถัดไป
      </p>
    </div>
  );
}

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-2xl border border-petflow-line bg-[#fbf3e0] shadow-petflow-sm"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
      aria-label="PetFlow"
    >
      🐾
    </div>
  );
}

import { ROOMS } from "@/lib/business";
import RoomDetailClient from "./RoomDetailClient";

export function generateStaticParams() {
  return ROOMS.map((room) => ({ id: room.id }));
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const room = ROOMS.find((r) => r.id === id);
  if (!room) return null;
  return <RoomDetailClient room={room} />;
}

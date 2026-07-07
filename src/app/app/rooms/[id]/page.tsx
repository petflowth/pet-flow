import RoomDetailClient from "./RoomDetailClient";

export const dynamic = "force-dynamic";

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RoomDetailClient roomId={id} />;
}

import { Suspense } from "react";
import { RoomClient } from "@/components/room/room-client";

export default function RoomPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-grid" />}>
      <RoomClient />
    </Suspense>
  );
}

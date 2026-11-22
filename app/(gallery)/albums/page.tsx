import { Suspense } from "react";
import { AlbumsView } from "@/components/pages/albums-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AlbumsView />
    </Suspense>
  );
}

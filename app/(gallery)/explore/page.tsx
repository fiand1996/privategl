import { Suspense } from "react";
import { ExplorePage } from "@/components/pages/explore-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ExplorePage />
    </Suspense>
  );
}

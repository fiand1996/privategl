import { Suspense } from "react";
import { FolderView } from "@/components/pages/folder-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FolderView />
    </Suspense>
  );
}

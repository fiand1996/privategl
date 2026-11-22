import { AppShell } from "@/components/layout/app-shell";

export default function GalleryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}

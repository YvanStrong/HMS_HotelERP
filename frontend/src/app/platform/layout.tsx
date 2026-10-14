import type { Metadata } from "next";
import { PlatformStaffShell } from "@/components/PlatformStaffShell";
import { privatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...privatePageMetadata,
  title: "Platform",
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <PlatformStaffShell>{children}</PlatformStaffShell>;
}

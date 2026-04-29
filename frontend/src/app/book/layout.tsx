import { GuestShell } from "@/components/GuestShell";

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <GuestShell>{children}</GuestShell>;
}

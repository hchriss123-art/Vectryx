import type { ReactNode } from "react";
import TickerTape from "@/components/TickerTape";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <div style={{ paddingBottom: 56 }}>{children}</div>
      <TickerTape speedSeconds={20} />
    </div>
  );
}

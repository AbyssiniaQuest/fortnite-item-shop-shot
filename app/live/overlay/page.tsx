import type { Metadata } from "next";
import { LiveOverlayClient } from "@/components/live/LiveOverlayClient";

export const metadata: Metadata = {
  title: "Fortnite Item Shop Live Overlay",
  description: "Presentation-only Fortnite item shop livestream overlay."
};

export default function LiveOverlayPage() {
  return <LiveOverlayClient />;
}

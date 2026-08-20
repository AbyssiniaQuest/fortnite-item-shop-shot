import type { Metadata } from "next";
import { LiveOverlayBuilder } from "@/components/live/LiveOverlayBuilder";

export const metadata: Metadata = {
  title: "Fortnite Item Shop Live Overlay | Abyssinia Quest",
  description: "Configure a continuously scrolling Fortnite item shop overlay for livestream browser sources."
};

export default function LivePage() {
  return <LiveOverlayBuilder />;
}

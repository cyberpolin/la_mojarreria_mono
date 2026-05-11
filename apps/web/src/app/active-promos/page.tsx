import type { Metadata } from "next";
import { ActivePromosClient } from "@/components/promos/active-promos-client";

export const metadata: Metadata = {
  title: "Active Promotions | MOJARRERIA",
  description: "Recent active WhatsApp promotions for MOJARRERIA",
};

export default function ActivePromosPage() {
  return <ActivePromosClient contacts={[]} />;
}

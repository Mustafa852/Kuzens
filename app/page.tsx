import type { Metadata } from "next";
import { requireChatGPTUser } from "./chatgpt-auth";
import { KuzensApp } from "./KuzensApp";

export const metadata: Metadata = {
  title: "Kuzens — birlikte kal.",
  description:
    "Topluluğun için mesajlaşma, sesli odalar ve ekran paylaşımı.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireChatGPTUser("/");
  return <KuzensApp />;
}

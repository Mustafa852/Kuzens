import type { Metadata } from "next";
import { KuzensAuthGate } from "./KuzensAuthGate";
import { KuzensApp } from "./KuzensApp";

export const metadata: Metadata = {
  title: "Kuzens — birlikte kal.",
  description:
    "Topluluğun için mesajlaşma, sesli odalar ve ekran paylaşımı.",
};

export default function Home() {
  return (
    <KuzensAuthGate>
      <KuzensApp />
    </KuzensAuthGate>
  );
}

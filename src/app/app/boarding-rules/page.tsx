"use client";

import Image from "next/image";
import { useLocale } from "@/components/LocaleProvider";
import { useConfig } from "@/components/ConfigProvider";
import { PageHeader } from "@/components/PageHeader";

export default function BoardingRulesPage() {
  const { locale } = useLocale();
  const { config } = useConfig();
  const blocks = config.boardingRules || [];

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        title={`📜 ${locale === "th" ? "กฎระเบียบการฝาก" : "Boarding rules"}`}
        back="/app/services"
        backLabel={locale === "th" ? "บริการทั้งหมด" : "All services"}
      />
      {blocks.length === 0 ? (
        <p className="mt-6 rounded-petflow-sm bg-paper px-4 py-3 text-sm text-brown-soft">
          {locale === "th" ? "ยังไม่มีข้อมูล" : "No content yet"}
        </p>
      ) : (
        <div className="space-y-4">
          {blocks.map((b) => (
            <div
              key={b.id}
              className="rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm"
            >
              {b.image && (
                <Image
                  src={b.image}
                  alt=""
                  width={600}
                  height={400}
                  className="mb-3 h-auto w-full rounded-petflow-sm object-cover"
                  unoptimized
                />
              )}
              {b.text && (
                <p className="whitespace-pre-line text-sm leading-relaxed text-brown">
                  {b.text}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

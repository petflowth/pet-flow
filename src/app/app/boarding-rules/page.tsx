"use client";

import { useLocale } from "@/components/LocaleProvider";
import { useConfig } from "@/components/ConfigProvider";
import { PageHeader } from "@/components/PageHeader";
import { ContentBlocks } from "@/components/ContentBlocks";

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
        <ContentBlocks blocks={blocks} />
      )}
    </div>
  );
}

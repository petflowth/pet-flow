import { LocaleProvider } from "@/components/LocaleProvider";
import { LiffProvider } from "@/components/LiffProvider";
import { CustomerNav } from "@/components/CustomerNav";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocaleProvider>
      <LiffProvider>
        <div className="bg-catcha-gradient min-h-screen pb-24">
          <div className="mx-auto max-w-lg">{children}</div>
          <CustomerNav />
        </div>
      </LiffProvider>
    </LocaleProvider>
  );
}

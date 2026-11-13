"use client";

import { useTr } from "@/components/LocaleProvider";
import type { TaxInvoiceForm, TaxInvoiceKind } from "@/lib/tax-invoice";
import { useConfig } from "@/components/ConfigProvider";
import { isFeatureOn } from "@/lib/features";

const label = "mb-1 block text-xs font-bold text-brown";
const hint = "font-normal text-brown-faint";
const chip = (on: boolean) =>
  `min-h-[40px] flex-1 rounded-full border px-3 text-xs font-extrabold ${
    on ? "border-petflow-chocolate bg-petflow-chocolate text-card" : "border-petflow-line bg-paper text-brown"
  }`;

type Prefill = { name?: string; phone?: string; address?: string };

/** ช่องกรอกข้อมูลออกบิล (ชื่อ เลขภาษี สาขา ที่อยู่ เบอร์) — ไม่มีช่องติ๊ก */
function TaxInvoiceDetail({
  value,
  onChange,
  fieldClass,
  kinds,
  prefill,
  phoneRequired,
  requireAll,
}: {
  value: TaxInvoiceForm;
  onChange: (next: TaxInvoiceForm) => void;
  fieldClass: string;
  /** ประเภทที่เลือกได้ — มีอย่างเดียวจะไม่โชว์ปุ่มเลือก */
  kinds: TaxInvoiceKind[];
  prefill?: Prefill;
  phoneRequired?: boolean;
  /** หน้าสมัครสมาชิก: ต้องกรอกครบทุกช่อง (รวมเบอร์บริษัท) */
  requireAll?: boolean;
}) {
  const tr = useTr();
  const set = (patch: Partial<TaxInvoiceForm>) => onChange({ ...value, ...patch });
  const pickKind = (kind: TaxInvoiceKind) => {
    if (kind === value.kind) return;
    // เปลี่ยนประเภท: ล้างชื่อ/เลขภาษีของอีกแบบ เติมข้อมูลผู้ปกครองให้ถ้าเป็นบุคคลธรรมดา
    set({
      kind,
      name: kind === "person" ? prefill?.name?.trim() || "" : "",
      taxId: "",
      phone: value.phone || (kind === "person" ? prefill?.phone || "" : ""),
      address: value.address || (kind === "person" ? prefill?.address || "" : ""),
    });
  };
  const person = value.kind === "person";

  return (
    <>
      {kinds.length > 1 && (
        <div className="flex gap-2">
          <button type="button" onClick={() => pickKind("company")} className={chip(!person)}>
            {tr("นิติบุคคล", "Company")}
          </button>
          <button type="button" onClick={() => pickKind("person")} className={chip(person)}>
            {tr("บุคคลธรรมดา", "Individual")}
          </button>
        </div>
      )}

      <label className="block">
        <span className={label}>{person ? tr("ชื่อ-นามสกุล", "Full name") : tr("ชื่อบริษัท / นิติบุคคล", "Company name")}</span>
        <input
          required={requireAll}
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={person ? tr("เช่น สมชาย ใจดี", "e.g. Somchai Jaidee") : tr("เช่น บริษัท ตัวอย่าง จำกัด", "e.g. Example Co., Ltd.")}
          className={fieldClass}
        />
      </label>

      <label className="block">
        <span className={label}>
          {tr("เลขประจำตัวผู้เสียภาษี", "Tax ID")}{" "}
          <span className={hint}>{person ? tr("(เลขบัตรประชาชน 13 หลัก)", "(13-digit ID card number)") : tr("(13 หลัก)", "(13 digits)")}</span>
        </span>
        <input
          required={requireAll}
          value={value.taxId}
          inputMode="numeric"
          onChange={(e) => set({ taxId: e.target.value.replace(/\D/g, "").slice(0, 13) })}
          placeholder="x-xxxx-xxxxx-xx-x"
          className={fieldClass}
        />
      </label>

      {!person && (
        <div>
          <span className={label}>{tr("สำนักงาน", "Office")}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => set({ headOffice: true })} className={chip(value.headOffice)}>
              {tr("สำนักงานใหญ่", "Head office")}
            </button>
            <button type="button" onClick={() => set({ headOffice: false })} className={chip(!value.headOffice)}>
              {tr("สาขา", "Branch")}
            </button>
          </div>
          {!value.headOffice && (
            <input
              required={requireAll}
              value={value.branchNo}
              inputMode="numeric"
              onChange={(e) => set({ branchNo: e.target.value.replace(/\D/g, "").slice(0, 5) })}
              placeholder={tr("เลขสาขา 5 หลัก เช่น 00001", "5-digit branch no. e.g. 00001")}
              className={`${fieldClass} mt-2`}
            />
          )}
        </div>
      )}

      <label className="block">
        <span className={label}>{person ? tr("ที่อยู่", "Address") : tr("ที่อยู่ตามทะเบียน", "Registered address")}</span>
        <textarea
          required={requireAll}
          value={value.address}
          onChange={(e) => set({ address: e.target.value })}
          rows={3}
          placeholder={tr("บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์", "House no., street, sub-district, district, province, postcode")}
          className={fieldClass}
        />
      </label>

      <label className="block">
        <span className={label}>
          {tr("เบอร์โทร", "Phone")} {!person && !phoneRequired && !requireAll && <span className={hint}>{tr("(ไม่บังคับ)", "(optional)")}</span>}
        </span>
        <input
          required={requireAll}
          type="tel"
          value={value.phone}
          onChange={(e) => set({ phone: e.target.value })}
          placeholder="08x-xxx-xxxx"
          className={fieldClass}
        />
      </label>
    </>
  );
}

/**
 * ช่องติ๊ก "ขอใบกำกับภาษี" + ช่องกรอกที่โผล่เฉพาะตอนติ๊ก
 * ใช้ในหน้าสมัครสมาชิก หน้าแก้ไขข้อมูลลูกค้า และหลังบ้าน
 */
export function TaxInvoiceFields({
  value,
  onChange,
  fieldClass,
  prefill,
  kinds = ["company", "person"],
  requireAll,
}: {
  value: TaxInvoiceForm;
  onChange: (next: TaxInvoiceForm) => void;
  fieldClass: string;
  /** ข้อมูลผู้ปกครองที่กรอกไว้แล้ว — เติมให้ตอนเลือก "บุคคลธรรมดา" ถ้าช่องยังว่าง */
  prefill?: Prefill;
  kinds?: TaxInvoiceKind[];
  /** หน้าสมัครสมาชิก: ติ๊กแล้วต้องกรอกครบทุกช่อง */
  requireAll?: boolean;
}) {
  const tr = useTr();
  const { config } = useConfig();
  const personOnly = kinds.length === 1 && kinds[0] === "person";
  const toggle = (on: boolean) => {
    if (!on) return onChange({ ...value, on });
    // บุคคลธรรมดาอย่างเดียว: เติมชื่อ/เบอร์ที่กรอกไว้ให้เลยตอนติ๊ก
    const kind = kinds.includes(value.kind) ? value.kind : kinds[0];
    onChange({
      ...value,
      on,
      kind,
      ...(kind === "person"
        ? {
            name: value.name || prefill?.name?.trim() || "",
            phone: value.phone || prefill?.phone || "",
            address: value.address || prefill?.address || "",
          }
        : {}),
    });
  };
  // ร้านปิด "ใบกำกับภาษี" ในตั้งค่า › เปิด/ปิดฟีเจอร์ — ไม่ถาม (ข้อมูลเดิมที่เคยกรอกไว้ยังอยู่)
  if (!isFeatureOn(config, "taxInvoice")) return null;

  return (
    <div className="space-y-3">
      <label className="flex min-h-[44px] cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={value.on}
          onChange={(e) => toggle(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-latte-deep"
        />
        <span className="text-sm font-bold text-brown">
          {personOnly ? tr("ต้องการใบกำกับภาษี (ในนามบุคคลธรรมดา)", "I need a tax invoice (as an individual)") : tr("ต้องการใบกำกับภาษี / ออกบิลในนามนิติบุคคล", "I need a tax invoice / bill in a company name")}
          <span className="block text-[11px] font-normal text-brown-faint">
            {tr("ไม่ต้องการก็ไม่ต้องติ๊ก — ติ๊กแล้วร้านจะใช้ข้อมูลนี้ออกบิลให้อัตโนมัติ", "Leave unticked if not needed — if ticked, the shop uses these details on your bills")}
          </span>
        </span>
      </label>

      {value.on && (
        <div className="space-y-3 rounded-petflow-sm border border-dashed border-latte bg-paper/60 p-3">
          <TaxInvoiceDetail value={value} onChange={onChange} fieldClass={fieldClass} kinds={kinds} prefill={prefill} requireAll={requireAll} />
        </div>
      )}
    </div>
  );
}

/**
 * "สมัครในนาม" บุคคลธรรมดา / นิติบุคคล — ใช้ในหน้าสมัครสมาชิกและหน้าเพิ่มลูกค้าเองในหลังบ้าน
 * เลือกนิติบุคคล: กรอกข้อมูลบริษัท แล้วถามว่าผู้ติดต่อใช้ข้อมูลเดียวกับบริษัทเลยไหม
 * (ไม่ใช่ → หน้าที่เรียกใช้โชว์ช่องชื่อ/เบอร์ผู้ติดต่อของตัวเองต่อ)
 */
export function AccountTypeFields({
  isCompany,
  onIsCompany,
  company,
  onCompany,
  sameContact,
  onSameContact,
  fieldClass,
  requireAll,
}: {
  isCompany: boolean;
  onIsCompany: (v: boolean) => void;
  company: TaxInvoiceForm;
  onCompany: (next: TaxInvoiceForm) => void;
  sameContact: boolean;
  onSameContact: (v: boolean) => void;
  fieldClass: string;
  /** หน้าสมัครสมาชิก: ข้อมูลบริษัทต้องกรอกครบทุกช่อง (รวมเบอร์) */
  requireAll?: boolean;
}) {
  const tr = useTr();
  const { config } = useConfig();
  // ร้านปิด "ใบกำกับภาษี / สมัครในนามบริษัท" — สมัครแบบบุคคลธรรมดาอย่างเดียว
  if (!isFeatureOn(config, "taxInvoice") && !isCompany) return null;
  return (
    <div className="space-y-3">
      <div>
        <span className={label}>{tr("สมัครในนาม", "Sign up as")}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => onIsCompany(false)} className={chip(!isCompany)}>
            {tr("บุคคลธรรมดา", "Individual")}
          </button>
          <button type="button" onClick={() => onIsCompany(true)} className={chip(isCompany)}>
            {tr("นิติบุคคล (บริษัท)", "Company")}
          </button>
        </div>
      </div>

      {isCompany && (
        <>
          <div className="space-y-3 rounded-petflow-sm border border-dashed border-latte bg-paper/60 p-3">
            <p className="text-xs font-extrabold text-petflow-chocolate">{tr("ข้อมูลบริษัท (ใช้ออกบิล/ใบกำกับภาษี)", "Company details (for bills/tax invoices)")}</p>
            <TaxInvoiceDetail
              value={company}
              onChange={onCompany}
              fieldClass={fieldClass}
              kinds={["company"]}
              phoneRequired={sameContact}
              requireAll={requireAll}
            />
          </div>
          <label className="flex min-h-[44px] cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={sameContact}
              onChange={(e) => onSameContact(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-latte-deep"
            />
            <span className="text-sm font-bold text-brown">
              {tr("ข้อมูลผู้ติดต่อใช้ข้อมูลเดียวกับบริษัท", "Contact details are the same as the company")}
              <span className="block text-[11px] font-normal text-brown-faint">
                {tr("ชื่อ เบอร์โทร และที่อยู่เดียวกับด้านบน — ถ้ามีคนติดต่อแยก เอาติ๊กออกแล้วกรอกเพิ่ม", "Same name, phone and address as above — untick to add a separate contact person")}
              </span>
            </span>
          </label>
        </>
      )}
    </div>
  );
}

/** ข้อความเตือนสำหรับโหมดนิติบุคคล (นอกจากที่ taxInvoiceProblem ตรวจ) */
export function companyContactProblem(company: TaxInvoiceForm, sameContact: boolean, locale: "th" | "en" = "th"): string {
  if (sameContact && company.phone.replace(/\D/g, "").length < 9)
    return locale === "en" ? "Please enter the company's phone number" : "กรอกเบอร์โทรของบริษัทด้วยนะคะ";
  return "";
}

import { getSeoSoftwarePage } from "@/lib/seo-software-pages";
import { SoftwareLanding, softwareMetadata } from "../SoftwareLanding";

const page = getSeoSoftwarePage("pet-shop-crm");

export const metadata = softwareMetadata(page);

export default function Page() {
  return <SoftwareLanding page={page} />;
}

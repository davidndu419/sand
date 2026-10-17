import { FulfilmentManager } from "@/components/admin/fulfilment-manager";
import { requireAdmin } from "@/lib/auth";
import { getFulfilmentQueue } from "@/lib/data";

export const metadata = { title: "Fulfilment Management" };

export default async function FulfilmentPage() {
  await requireAdmin("manage_fulfilment");
  return <><header className="admin-page-head"><div><h1>Allocation &amp; fulfilment</h1><p>Document actual allocation, purchase or service, private evidence, and authorised completion.</p></div></header><FulfilmentManager donations={await getFulfilmentQueue()} /></>;
}

import { requireAdminPage } from "@/lib/admin-guard";
import { RagExportForm } from "./RagExportForm";

export default async function RagExportPage() {
  await requireAdminPage("/admin/rag-export");

  return <RagExportForm />;
}

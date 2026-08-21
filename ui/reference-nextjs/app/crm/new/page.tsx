import { redirect } from "next/navigation";
import { currentUser, isLeader } from "@/lib/crm/session";
import { crmConfigured, getCrmData } from "@/lib/crm/api";
import NewDealForm from "@/components/crm/NewDealForm";

export const dynamic = "force-dynamic";

export default async function NewDealPage() {
  const user = await currentUser();
  if (!user) redirect("/crm/login");
  if (!crmConfigured()) redirect("/crm");
  const { settings, roster } = await getCrmData();
  return (
    <NewDealForm
      khuVucList={settings.khuVuc}
      salesList={isLeader(user) ? roster.map((r) => r.name) : []}
      defaultRegion={user.region}
    />
  );
}

export const maxDuration = 30;

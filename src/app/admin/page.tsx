import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/admin-console";
import { getAdminSession } from "@/lib/admin/auth";
import { getAdminDashboard } from "@/lib/admin/data";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function AdminPage(){const session=await getAdminSession();if(!session)redirect("/auth?next=/admin");const data=await getAdminDashboard();return <AdminConsole active="overview" role={session.role} data={data}/>;}

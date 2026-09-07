import { notFound, redirect } from "next/navigation";
import { AdminConsole } from "@/components/admin-console";
import { getAdminSession } from "@/lib/admin/auth";
import { getAdminDashboard } from "@/lib/admin/data";
const sections = new Set(["users","growth","usage","billing","subscriptions","finops","operations","audit","system"]);
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function AdminSectionPage({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!sections.has(section))notFound();const session=await getAdminSession();if(!session)redirect(`/auth?next=/admin/${section}`);const data=await getAdminDashboard();return <AdminConsole active={section} role={session.role} data={data}/>;}

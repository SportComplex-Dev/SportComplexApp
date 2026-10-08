import { requirePageRoles } from "@/lib/api-auth";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePageRoles(["Administrador"]);
  return children;
}

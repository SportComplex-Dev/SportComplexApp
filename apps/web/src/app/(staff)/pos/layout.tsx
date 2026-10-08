import { requirePageRoles } from "@/lib/api-auth";

export default async function PosLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePageRoles(["Administrador", "Empleado_Vendedor"]);
  return children;
}

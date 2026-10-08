import { requirePageRoles } from "@/lib/api-auth";

export default async function ScannerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePageRoles(["Administrador", "Empleado_Lector"]);
  return children;
}

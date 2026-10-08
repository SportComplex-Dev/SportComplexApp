import { requirePageRoles } from "@/lib/api-auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requirePageRoles(["Cliente"]);
  return (
    <>
      <nav aria-label="Portal cliente">
        <a href="/portal">Reservas</a> · <a href="/portal/history">Historial</a> ·{" "}
        <a href="/portal/membership">Membresía</a>
      </nav>
      {children}
    </>
  );
}

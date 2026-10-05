import { redirect } from "next/navigation";

// Redirección interna por defecto al dashboard principal administrativo
export default function AdminPage() {
  redirect("/admin/dashboard");
}

import { auth } from "@/auth";
import { TopBar } from "@/components/top-bar";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="club-app min-h-screen flex flex-col">
      <TopBar
        customer={{
          name: session?.user?.name ?? "",
          email: session?.user?.email ?? "",
        }}
      />
      <div className="flex-1">{children}</div>
    </div>
  );
}

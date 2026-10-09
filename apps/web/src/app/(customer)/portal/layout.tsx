import { PortalNav } from "./portal-nav";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PortalNav />
      {children}
    </>
  );
}

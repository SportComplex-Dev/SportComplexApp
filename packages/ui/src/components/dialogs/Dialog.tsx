import React from "react";

export function Dialog({ children }: { children: React.ReactNode }) {
  return <div role="dialog">{children}</div>;
}

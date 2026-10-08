import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    estado?: string;
  }

  interface Session {
    user: {
      id?: string;
      role?: string;
      estado?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    estado?: string;
  }
}

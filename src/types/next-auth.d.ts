/* eslint-disable @typescript-eslint/no-unused-vars */
import NextAuth, { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
    interface User {
        id: string;
        role: string;
        matricule: string;
        fonction: string;
        image?: string | null;
    }

    interface Session {
        user: {
            id: string;
            role: string;
            matricule: string;
            fonction: string;
        } & DefaultSession["user"];
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role?: string;
        matricule?: string;
        fonction?: string;
        userId?: string;
    }
}

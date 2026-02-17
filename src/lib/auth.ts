import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma"; // Import the singleton instance directly

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Mot de passe", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const user = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { email: credentials.email as string },
                            { matricule: credentials.email as string },
                        ],
                        active: true,
                    },
                });

                if (!user) return null;

                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                );

                if (!isValid) return null;

                return {
                    id: user.id,
                    email: user.email,
                    name: `${user.prenom} ${user.nom}`,
                    role: user.role,
                    matricule: user.matricule,
                    fonction: user.fonction,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                const u = user as unknown as Record<string, unknown>;
                token.role = u.role;
                token.matricule = u.matricule;
                token.fonction = u.fonction;
                token.userId = user.id;
                token.picture = u.image as string | null | undefined;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                const u = session.user as unknown as Record<string, unknown>;
                u.role = token.role;
                u.matricule = token.matricule;
                u.fonction = token.fonction;
                u.id = token.userId;
                session.user.image = token.picture as string | null;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.NEXTAUTH_SECRET,
});

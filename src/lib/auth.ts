import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

const loginSchema = z.object({
    email: z.string().min(1, "Email ou matricule requis"),
    password: z.string().min(1, "Mot de passe requis"),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Mot de passe", type: "password" },
            },
            async authorize(credentials) {
                const parsed = loginSchema.safeParse(credentials);
                if (!parsed.success) return null;

                const { email, password } = parsed.data;

                const user = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { email },
                            { matricule: email },
                        ],
                        active: true,
                    },
                });

                if (!user) return null;

                const isValid = await bcrypt.compare(password, user.password);
                if (!isValid) return null;

                return {
                    id: user.id,
                    email: user.email,
                    name: `${user.prenom} ${user.nom}`,
                    image: null, // Ne PAS stocker l'image base64 dans le JWT (cause HTTP 431)
                    role: user.role,
                    matricule: user.matricule,
                    fonction: user.fonction,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user, trigger }) {
            if (user) {
                token.role = user.role;
                token.matricule = user.matricule;
                token.fonction = user.fonction;
                token.userId = user.id;
                // Ne PAS stocker token.picture (image base64 trop volumineuse pour le cookie)
            }
            // Rafraîchir le token depuis la BD quand update() est appelé
            if (trigger === "update" && token.userId) {
                const freshUser = await prisma.user.findUnique({
                    where: { id: token.userId as string },
                    select: { nom: true, prenom: true, email: true, role: true, fonction: true, matricule: true },
                });
                if (freshUser) {
                    token.name = `${freshUser.prenom} ${freshUser.nom}`;
                    token.email = freshUser.email;
                    token.role = freshUser.role;
                    token.fonction = freshUser.fonction;
                    token.matricule = freshUser.matricule;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.userId as string;
                session.user.role = token.role as string;
                session.user.matricule = token.matricule as string;
                session.user.fonction = token.fonction as string;
                // image chargée séparément via /api/profile (pas dans le JWT)
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

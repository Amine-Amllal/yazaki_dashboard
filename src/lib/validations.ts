import { z } from "zod";

// ─── DFC Validation ───
export const createDFCSchema = z.object({
    projectId: z.string().min(1, "Projet requis"),
    familyId: z.string().min(1, "Famille requise"),
    phaseId: z.string().min(1, "Phase requise"),
    description: z.string().min(1, "Description requise").max(1000),
    dateReception: z.string().min(1, "Date de réception requise"),
    faisabilite: z.enum(["OUI", "NON", "EN_COURS", "A_CLARIFIER"]).default("EN_COURS"),
    typeDFC: z.enum(["T1", "T2", "T3", "MISTAKED"]).default("T1"),
    dateReponse: z.string().optional().nullable(),
    delaiReponse: z.union([z.string(), z.number()]).optional().nullable(),
    numeroDerogation: z.string().optional().nullable(),
    dateReceptionDerogation: z.string().optional().nullable(),
    dateApplicationEstimee: z.string().optional().nullable(),
    dateApplicationDerogation: z.string().optional().nullable(),
    commentaire: z.string().max(2000).optional().nullable(),
});

export const updateDFCSchema = createDFCSchema.partial();

// ─── User Validation ───
export const createUserSchema = z.object({
    matricule: z.string().min(1, "Matricule requis").max(50),
    nom: z.string().min(1, "Nom requis").max(100),
    prenom: z.string().min(1, "Prénom requis").max(100),
    email: z.string().email("Email invalide"),
    password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
    fonction: z.enum(["PP_RESPONSIBLE", "PP_TECHNICIAN", "PP_COORDINATOR"]).default("PP_RESPONSIBLE"),
    role: z.enum(["USER", "ADMIN"]).default("USER"),
});

export const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
    password: z.string().min(6).optional(),
    active: z.boolean().optional(),
});

// ─── Profile Validation ───
export const updateProfileSchema = z.object({
    nom: z.string().min(1).max(100),
    prenom: z.string().min(1).max(100),
    email: z.string().email("Email invalide"),
    image: z.string().max(500000).optional().nullable(), // Limit base64 size ~375KB
});

// ─── Reference Validation ───
export const createReferenceSchema = z.object({
    type: z.enum(["project", "family", "phase"]),
    name: z.string().min(1, "Nom requis").max(200),
});

export const updateReferenceSchema = z.object({
    type: z.enum(["project", "family", "phase"]),
    id: z.string().min(1),
    name: z.string().min(1, "Nom requis").max(200),
});

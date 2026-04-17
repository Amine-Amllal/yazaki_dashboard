import { z } from "zod";

export const MAX_FEASIBILITY_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export const ALLOWED_FEASIBILITY_FILE_EXTENSIONS = [
    "pdf",
    "xlsx",
    "csv",
    "doc",
    "docx",
    "png",
    "jpg",
    "jpeg",
] as const;

export const ALLOWED_FEASIBILITY_FILE_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
] as const;

// ─── DFC Validation ───
export const createDFCSchema = z.object({
    projectId: z.string().min(1, "Project is required"),
    familyId: z.string().min(1, "Family is required"),
    phaseId: z.string().min(1, "Phase is required"),
    description: z.string().min(1, "Description is required").max(1000),
    dateReception: z.string().min(1, "Received date is required"),
    faisabilite: z.enum(["OUI", "NON", "EN_COURS", "A_CLARIFIER"]).default("EN_COURS"),
    typeDFC: z.enum(["T1", "T2", "T3", "MISTAKED"]).default("T1"),
    dateReponse: z.string().optional().nullable(),
    delaiReponse: z.union([z.string(), z.number()]).optional().nullable(),
    numeroDerogation: z.string().optional().nullable(),
    dateReceptionDerogation: z.string().optional().nullable(),
    dateApplicationEstimee: z.string().optional().nullable(),
    dateApplicationDerogation: z.string().optional().nullable(),
    commentaire: z.string().max(2000).optional().nullable(),
    assignedToId: z.string().optional().nullable(),
});

export const updateDFCSchema = createDFCSchema.partial();

// ─── User Validation ───
export const createUserSchema = z.object({
    matricule: z.string().min(1, "Employee ID is required").max(50),
    nom: z.string().min(1, "Last name is required").max(100),
    prenom: z.string().min(1, "First name is required").max(100),
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
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
    email: z.string().email("Invalid email"),
    image: z.string().max(2000000).optional().nullable(), // base64 limit ~1.5MB
});

// ─── Reference Validation ───
export const createReferenceSchema = z.object({
    type: z.enum(["project", "family", "phase"]),
    name: z.string().min(1, "Name is required").max(200),
});

export const updateReferenceSchema = z.object({
    type: z.enum(["project", "family", "phase"]),
    id: z.string().min(1),
    name: z.string().min(1, "Name is required").max(200),
});

export const feasibilityFileMetadataSchema = z.object({
    dfcId: z.string().min(1),
    originalName: z.string().min(1).max(255),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().positive().max(MAX_FEASIBILITY_FILE_SIZE_BYTES),
});

export const createDerogationSchema = z.object({
    numero: z.string().max(120).optional().nullable(),
    dateReception: z.string().optional().nullable(),
    dateApplicationEstimee: z.string().optional().nullable(),
    dateApplicationEffective: z.string().optional().nullable(),
    commentaire: z.string().max(2000).optional().nullable(),
});

export const updateDerogationSchema = createDerogationSchema.partial();

export const upsertEcoSchema = z.object({
    code: z.string().min(1, "ECO code is required").max(120),
    status: z.string().min(1).max(40).default("DRAFT"),
    issuedAt: z.string().optional().nullable(),
    commentaire: z.string().max(2000).optional().nullable(),
});

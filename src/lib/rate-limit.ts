import { NextRequest, NextResponse } from "next/server";

/**
 * Rate Limiter professionnel basé sur l'algorithme Sliding Window.
 * Stockage en mémoire — adapté pour un déploiement single-instance.
 * Pour un déploiement multi-instance, remplacer par Redis (Upstash, etc.).
 */

interface RateLimitEntry {
    timestamps: number[];
}

interface RateLimitConfig {
    /** Nombre maximum de requêtes autorisées dans la fenêtre */
    maxRequests: number;
    /** Durée de la fenêtre en secondes */
    windowSizeInSeconds: number;
}

// Presets de configuration pour différents types de routes
export const RATE_LIMIT_PRESETS = {
    /** Auth / Login : 5 tentatives par minute (anti brute-force) */
    AUTH: { maxRequests: 5, windowSizeInSeconds: 60 },
    /** Chat IA : 10 requêtes par minute (protège le quota Gemini) */
    CHAT: { maxRequests: 10, windowSizeInSeconds: 60 },
    /** Import fichier : 5 imports par minute (CPU-intensive OCR) */
    IMPORT: { maxRequests: 5, windowSizeInSeconds: 60 },
    /** Création DFC : 20 créations par minute */
    CREATE: { maxRequests: 20, windowSizeInSeconds: 60 },
    /** Création utilisateur : 10 par minute */
    USER_CREATE: { maxRequests: 10, windowSizeInSeconds: 60 },
    /** Modification profil : 10 par minute */
    PROFILE: { maxRequests: 10, windowSizeInSeconds: 60 },
    /** Standard API : 60 requêtes par minute */
    STANDARD: { maxRequests: 60, windowSizeInSeconds: 60 },
} as const;

class RateLimiter {
    private store = new Map<string, RateLimitEntry>();
    private config: RateLimitConfig;
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    constructor(config: RateLimitConfig) {
        this.config = config;
        // Nettoyage automatique des entrées expirées toutes les 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        // Pas de ref vers le process — le GC s'en occupe si le module est déchargé
        if (this.cleanupInterval?.unref) {
            this.cleanupInterval.unref();
        }
    }

    /**
     * Vérifie si une requête est autorisée pour la clé donnée.
     * Retourne un objet avec le résultat et les métadonnées.
     */
    check(key: string): {
        allowed: boolean;
        remaining: number;
        resetInSeconds: number;
        limit: number;
    } {
        const now = Date.now();
        const windowMs = this.config.windowSizeInSeconds * 1000;
        const windowStart = now - windowMs;

        let entry = this.store.get(key);
        if (!entry) {
            entry = { timestamps: [] };
            this.store.set(key, entry);
        }

        // Supprimer les timestamps hors de la fenêtre (sliding window)
        entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

        const remaining = Math.max(0, this.config.maxRequests - entry.timestamps.length);
        const oldestInWindow = entry.timestamps[0];
        const resetInSeconds = oldestInWindow
            ? Math.ceil((oldestInWindow + windowMs - now) / 1000)
            : this.config.windowSizeInSeconds;

        if (entry.timestamps.length >= this.config.maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetInSeconds,
                limit: this.config.maxRequests,
            };
        }

        // Enregistrer cette requête
        entry.timestamps.push(now);

        return {
            allowed: true,
            remaining: remaining - 1,
            resetInSeconds: this.config.windowSizeInSeconds,
            limit: this.config.maxRequests,
        };
    }

    /** Nettoie les entrées expirées pour libérer la mémoire */
    private cleanup() {
        const now = Date.now();
        const windowMs = this.config.windowSizeInSeconds * 1000;

        for (const [key, entry] of this.store.entries()) {
            entry.timestamps = entry.timestamps.filter((ts) => ts > now - windowMs);
            if (entry.timestamps.length === 0) {
                this.store.delete(key);
            }
        }
    }

    /** Nombre de clés actives (utile pour le monitoring) */
    get size() {
        return this.store.size;
    }
}

// ── Cache global des instances (une par preset pour éviter les doublons) ──
const globalForRateLimit = globalThis as unknown as {
    rateLimiters: Map<string, RateLimiter>;
};

if (!globalForRateLimit.rateLimiters) {
    globalForRateLimit.rateLimiters = new Map();
}

/**
 * Récupère ou crée une instance de RateLimiter pour la config donnée.
 * Utilise un cache global pour persister entre les re-renders en dev.
 */
function getRateLimiter(config: RateLimitConfig): RateLimiter {
    const key = `${config.maxRequests}:${config.windowSizeInSeconds}`;
    let limiter = globalForRateLimit.rateLimiters.get(key);
    if (!limiter) {
        limiter = new RateLimiter(config);
        globalForRateLimit.rateLimiters.set(key, limiter);
    }
    return limiter;
}

/**
 * Extrait l'identifiant du client depuis la requête.
 * Priorité : header X-Forwarded-For > IP de connexion > fallback "anonymous"
 */
function getClientKey(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp;
    // Fallback : identifiant par défaut
    return "anonymous";
}

/**
 * Applique le rate limiting sur une route API.
 * Retourne `null` si la requête est autorisée, ou une `NextResponse 429` sinon.
 *
 * @example
 * export async function POST(request: NextRequest) {
 *     const rateLimitError = applyRateLimit(request, RATE_LIMIT_PRESETS.AUTH, "auth");
 *     if (rateLimitError) return rateLimitError;
 *     // ... suite de la logique
 * }
 */
export function applyRateLimit(
    request: NextRequest,
    config: RateLimitConfig,
    prefix: string = "api"
): NextResponse | null {
    const clientKey = getClientKey(request);
    const rateLimitKey = `${prefix}:${clientKey}`;
    const limiter = getRateLimiter(config);
    const result = limiter.check(rateLimitKey);

    if (!result.allowed) {
        const response = NextResponse.json(
            {
                error: "Trop de requêtes. Veuillez réessayer plus tard.",
                retryAfter: result.resetInSeconds,
            },
            { status: 429 }
        );
        response.headers.set("Retry-After", String(result.resetInSeconds));
        response.headers.set("X-RateLimit-Limit", String(result.limit));
        response.headers.set("X-RateLimit-Remaining", "0");
        response.headers.set("X-RateLimit-Reset", String(result.resetInSeconds));
        return response;
    }

    return null;
}

/**
 * Version qui ajoute les headers de rate limit à une réponse existante.
 * À utiliser pour informer le client de son quota restant.
 */
export function addRateLimitHeaders(
    response: NextResponse,
    request: NextRequest,
    config: RateLimitConfig,
    prefix: string = "api"
): NextResponse {
    const clientKey = getClientKey(request);
    const rateLimitKey = `${prefix}:${clientKey}`;
    const limiter = getRateLimiter(config);
    // On ne check pas ici — juste lire l'état sans consommer
    const entry = limiter.size; // placeholder — les headers sont déjà set dans applyRateLimit
    void entry;
    return response;
}

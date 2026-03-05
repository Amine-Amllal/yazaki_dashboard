"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError("Email/Matricule ou mot de passe incorrect");
            } else {
                router.push("/dashboard");
                router.refresh();
            }
        } catch {
            setError("Erreur de connexion. Veuillez réessayer.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card animate-in">
                <div className="login-logo" style={{ flexDirection: 'column', alignItems: 'center' }}>
                    <img
                        src="/yazaki-logo.svg"
                        alt="Yazaki"
                        style={{ height: 48, width: 'auto', marginBottom: 8 }}
                    />
                    <div className="login-logo-text" style={{ textAlign: 'center' }}>
                        <h2>YECMS</h2>
                        <p>Engineering Change Management System</p>
                    </div>
                </div>

                <h1>Connexion</h1>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="email">
                            Email ou Matricule
                        </label>
                        <input
                            id="email"
                            type="text"
                            className="form-input"
                            placeholder="admin@yazaki.com ou ADMIN001"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="password">
                            Mot de passe
                        </label>
                        <input
                            id="password"
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary login-btn"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <span className="loading-spinner" /> Connexion...
                            </>
                        ) : (
                            "Se connecter"
                        )}
                    </button>
                </form>

                <p
                    style={{
                        textAlign: "center",
                        marginTop: "20px",
                        fontSize: "13px",
                        color: "var(--text-muted)",
                        lineHeight: "1.5",
                    }}
                >
                    Vous n&apos;avez pas de compte ?{" "}
                    <a href="mailto:admin@yazaki.com" style={{ color: "#E60012" }}>Contactez votre administrateur : admin@yazaki.com</a>
                </p>
                <p
                    style={{
                        textAlign: "center",
                        marginTop: "12px",
                        fontSize: "12px",
                        color: "var(--text-muted)",
                    }}
                >
                    Yazaki Morocco Meknès © 2026
                </p>
            </div>
        </div>
    );
}

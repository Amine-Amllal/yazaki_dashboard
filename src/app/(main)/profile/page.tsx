"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { FiSave, FiUpload, FiUser } from "react-icons/fi";

interface UserProfile {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    fonction: string;
    image: string | null;
}

export default function ProfilePage() {
    const { update: updateSession } = useSession();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        nom: "",
        prenom: "",
        email: "",
        image: "",
    });

    useEffect(() => {
        fetch("/api/profile")
            .then((res) => res.json())
            .then((data) => {
                if (data.error) {
                    alert(data.error);
                } else {
                    setUser(data);
                    setFormData({
                        nom: data.nom,
                        prenom: data.prenom,
                        email: data.email,
                        image: data.image || "",
                    });
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, image: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                // Rafraîchir la session NextAuth pour mettre à jour le header
                await updateSession();
                alert("Profil mis à jour avec succès !");
                window.location.reload();
            } else {
                const err = await res.json();
                alert(err.error || "Erreur lors de la mise à jour");
            }
        } catch {
            alert("Erreur de connexion");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="page-content">Chargement...</div>;

    return (
        <>
            <Header title="Mon Profil" subtitle="Gérer vos informations personnelles" />
            <div className="page-content animate-in">
                <div className="form-card" style={{ maxWidth: 600, margin: "0 auto" }}>
                    <div className="form-card-title">Informations Personnelles</div>

                    <form onSubmit={handleSubmit}>
                        {/* Image Upload */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
                            <div style={{
                                width: 100, height: 100, borderRadius: "50%",
                                background: formData.image ? `url(${formData.image}) center/cover` : "var(--primary-100)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 32, color: "var(--primary)",
                                marginBottom: 12, border: "2px solid var(--border)"
                            }}>
                                {!formData.image && <FiUser />}
                            </div>
                            <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
                                <FiUpload /> Changer la photo
                                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />
                            </label>
                        </div>

                        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                            <div className="form-group">
                                <label className="form-label">Nom</label>
                                <input
                                    name="nom"
                                    type="text"
                                    className="form-input"
                                    value={formData.nom}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Prénom</label>
                                <input
                                    name="prenom"
                                    type="text"
                                    className="form-input"
                                    value={formData.prenom}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                name="email"
                                type="email"
                                className="form-input"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Fonction (Lecture seule)</label>
                            <input
                                type="text"
                                className="form-input"
                                value={user?.fonction || ""}
                                disabled
                                style={{ background: "var(--bg)", color: "var(--text-muted)" }}
                            />
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? "Enregistrement..." : <><FiSave /> Enregistrer</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

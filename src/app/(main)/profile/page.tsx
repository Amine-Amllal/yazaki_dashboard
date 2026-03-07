"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/Header";
import { useFeedback } from "@/components/ui/feedback-provider";
import { FiSave, FiTrash2, FiUpload, FiUser } from "react-icons/fi";

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
    const { notify, confirm } = useFeedback();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        nom: "",
        prenom: "",
        email: "",
        image: null as string | null,
    });

    useEffect(() => {
        fetch("/api/profile")
            .then((res) => res.json())
            .then((data) => {
                if (data.error) {
                    notify.error(data.error);
                } else {
                    setUser(data);
                    setFormData({
                        nom: data.nom,
                        prenom: data.prenom,
                        email: data.email,
                        image: data.image || null,
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
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
                const MAX_DIM = 300;
                let { width, height } = img;
                if (width > height) {
                    if (width > MAX_DIM) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
                } else {
                    if (height > MAX_DIM) { width = Math.round(width * MAX_DIM / height); height = MAX_DIM; }
                }
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, width, height);
                const compressed = canvas.toDataURL("image/jpeg", 0.75);
                setFormData((prev) => ({ ...prev, image: compressed }));
            };
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = async () => {
        const accepted = await confirm({
            title: "Supprimer la photo",
            message: "Voulez-vous vraiment supprimer la photo de profil ?",
            confirmText: "Supprimer",
            cancelText: "Annuler",
            danger: true,
        });
        if (!accepted) return;

        setSaving(true);
        try {
            const res = await fetch("/api/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, image: null }),
            });

            if (!res.ok) {
                const err = await res.json();
                notify.error(err.error || "Erreur lors de la suppression de l'image");
                return;
            }

            setFormData((prev) => ({ ...prev, image: null }));
            setUser((prev) => (prev ? { ...prev, image: null } : prev));
            await updateSession();
            notify.success("Photo supprimée avec succès");
        } catch {
            notify.error("Erreur de connexion");
        } finally {
            setSaving(false);
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
                notify.success("Profil mis à jour avec succès");
            } else {
                const err = await res.json();
                notify.error(err.error || "Erreur lors de la mise à jour");
            }
        } catch {
            notify.error("Erreur de connexion");
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
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                                <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
                                    <FiUpload /> Changer la photo
                                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />
                                </label>
                                {formData.image && (
                                    <button
                                        type="button"
                                        className="btn btn-danger btn-sm"
                                        onClick={handleRemoveImage}
                                        disabled={saving}
                                    >
                                        <FiTrash2 /> Supprimer la photo
                                    </button>
                                )}
                            </div>
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

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import FileImportUploader from "@/components/FileImportUploader";
import { FiSave, FiX } from "react-icons/fi";

interface RefData {
    projects: { id: string; name: string }[];
    families: { id: string; name: string }[];
    phases: { id: string; name: string }[];
}

export default function NewDFCPage() {
    const router = useRouter();
    const [refData, setRefData] = useState<RefData>({ projects: [], families: [], phases: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [importSuccess, setImportSuccess] = useState(false);

    const [form, setForm] = useState({
        projectId: "",
        familyId: "",
        phaseId: "",
        description: "",
        dateReception: new Date().toISOString().split("T")[0],
        faisabilite: "EN_COURS",
        dateReponse: "",
        typeDFC: "T1",
        delaiReponse: "",
        dateReceptionDerogation: "",
        numeroDerogation: "",
        dateApplicationEstimee: "",
        dateApplicationDerogation: "",
        commentaire: "",
    });

    useEffect(() => {
        fetch("/api/reference")
            .then((r) => r.json())
            .then(setRefData);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleExtracted = useCallback((data: Record<string, string>) => {
        setForm((prev) => {
            const updated = { ...prev };
            for (const key of Object.keys(updated)) {
                if (data[key] && data[key].trim() !== "") {
                    (updated as Record<string, string>)[key] = data[key];
                }
            }
            return updated;
        });
        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 8000);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (!form.projectId || !form.familyId || !form.phaseId || !form.description) {
            setError("Veuillez remplir tous les champs obligatoires");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/dfc", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            if (!res.ok) throw new Error("Erreur");
            router.push("/dfc");
        } catch {
            setError("Erreur lors de la création du DFC");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Header title="Nouveau DFC" subtitle="Créer une nouvelle demande de faisabilité" />
            <div className="page-content animate-in">
                {/* ─── Import Section ─── */}
                <FileImportUploader onExtracted={handleExtracted} />

                {importSuccess && (
                    <div className="import-success-banner">
                        ✅ Formulaire pré-rempli avec succès. Vérifiez les données ci-dessous avant de valider.
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {error && <div className="login-error" style={{ marginBottom: 20 }}>{error}</div>}

                    <div className="form-card" style={{ marginBottom: 20 }}>
                        <h3 className="form-card-title">Informations générales</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Projet *</label>
                                <select name="projectId" className="form-select" value={form.projectId} onChange={handleChange} required>
                                    <option value="">Sélectionner un projet</option>
                                    {refData.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Famille *</label>
                                <select name="familyId" className="form-select" value={form.familyId} onChange={handleChange} required>
                                    <option value="">Sélectionner une famille</option>
                                    {refData.families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phase *</label>
                                <select name="phaseId" className="form-select" value={form.phaseId} onChange={handleChange} required>
                                    <option value="">Sélectionner une phase</option>
                                    {refData.phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Type DFC</label>
                                <select name="typeDFC" className="form-select" value={form.typeDFC} onChange={handleChange}>
                                    <option value="T1">T1</option>
                                    <option value="T2">T2</option>
                                    <option value="T3">T3</option>
                                    <option value="MISTAKED">Mistaked</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description *</label>
                            <textarea
                                name="description"
                                className="form-textarea"
                                placeholder="Description détaillée de la DFC..."
                                value={form.description}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-card" style={{ marginBottom: 20 }}>
                        <h3 className="form-card-title">Dates et faisabilité</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Date de réception *</label>
                                <input type="date" name="dateReception" className="form-input" value={form.dateReception} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Faisabilité</label>
                                <div className="form-radio-group">
                                    {[
                                        { value: "OUI", label: "Oui" },
                                        { value: "NON", label: "Non" },
                                        { value: "EN_COURS", label: "En cours (OG)" },
                                        { value: "A_CLARIFIER", label: "À clarifier (NC)" },
                                    ].map((opt) => (
                                        <label className="form-radio-label" key={opt.value}>
                                            <input
                                                type="radio"
                                                name="faisabilite"
                                                value={opt.value}
                                                checked={form.faisabilite === opt.value}
                                                onChange={handleChange}
                                            />
                                            <span>{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date de réponse</label>
                                <input type="date" name="dateReponse" className="form-input" value={form.dateReponse} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Délai de réponse (jours)</label>
                                <input type="number" name="delaiReponse" className="form-input" placeholder="Nombre de jours" value={form.delaiReponse} onChange={handleChange} />
                            </div>
                        </div>
                    </div>

                    <div className="form-card" style={{ marginBottom: 20 }}>
                        <h3 className="form-card-title">Dérogation</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">N° Dérogation</label>
                                <input type="text" name="numeroDerogation" className="form-input" placeholder="Ex: DRG1111111-1" value={form.numeroDerogation} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date de réception dérogation</label>
                                <input type="date" name="dateReceptionDerogation" className="form-input" value={form.dateReceptionDerogation} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date d&apos;application estimée</label>
                                <input type="date" name="dateApplicationEstimee" className="form-input" value={form.dateApplicationEstimee} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date d&apos;application effective</label>
                                <input type="date" name="dateApplicationDerogation" className="form-input" value={form.dateApplicationDerogation} onChange={handleChange} />
                            </div>
                        </div>
                    </div>

                    <div className="form-card">
                        <h3 className="form-card-title">Commentaires</h3>
                        <div className="form-group">
                            <textarea
                                name="commentaire"
                                className="form-textarea"
                                placeholder="Commentaires et remarques..."
                                value={form.commentaire}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
                                <FiX /> Annuler
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? <><span className="loading-spinner" /> Enregistrement...</> : <><FiSave /> Enregistrer</>}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </>
    );
}

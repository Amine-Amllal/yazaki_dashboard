"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Link from "next/link";
import { FiEdit, FiArrowLeft, FiSave, FiX, FiClock } from "react-icons/fi";

interface DFCDetail {
    id: string;
    numero: number;
    description: string;
    faisabilite: string;
    typeDFC: string;
    dateReception: string;
    dateReponse: string | null;
    delaiReponse: number | null;
    numeroDerogation: string | null;
    dateReceptionDerogation: string | null;
    dateApplicationEstimee: string | null;
    dateApplicationDerogation: string | null;
    commentaire: string | null;
    createdAt: string;
    updatedAt: string;
    project: { id: string; name: string };
    family: { id: string; name: string };
    phase: { id: string; name: string };
    createdBy: { nom: string; prenom: string; matricule: string };
    histories: {
        id: string;
        field: string;
        oldValue: string | null;
        newValue: string | null;
        changedAt: string;
        user: { nom: string; prenom: string };
    }[];
}

interface RefData {
    projects: { id: string; name: string }[];
    families: { id: string; name: string }[];
    phases: { id: string; name: string }[];
}

export default function DFCDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [dfc, setDfc] = useState<DFCDetail | null>(null);
    const [editing, setEditing] = useState(searchParams.get("edit") === "true");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refData, setRefData] = useState<RefData>({ projects: [], families: [], phases: [] });
    const [form, setForm] = useState<Record<string, string>>({});

    useEffect(() => {
        Promise.all([
            fetch(`/api/dfc/${id}`).then((r) => r.json()),
            fetch("/api/reference").then((r) => r.json()),
        ]).then(([dfcData, ref]) => {
            setDfc(dfcData);
            setRefData(ref);
            setForm({
                projectId: dfcData.project.id,
                familyId: dfcData.family.id,
                phaseId: dfcData.phase.id,
                description: dfcData.description,
                faisabilite: dfcData.faisabilite,
                typeDFC: dfcData.typeDFC,
                dateReception: dfcData.dateReception?.split("T")[0] || "",
                dateReponse: dfcData.dateReponse?.split("T")[0] || "",
                delaiReponse: dfcData.delaiReponse?.toString() || "",
                numeroDerogation: dfcData.numeroDerogation || "",
                dateReceptionDerogation: dfcData.dateReceptionDerogation?.split("T")[0] || "",
                dateApplicationEstimee: dfcData.dateApplicationEstimee?.split("T")[0] || "",
                dateApplicationDerogation: dfcData.dateApplicationDerogation?.split("T")[0] || "",
                commentaire: dfcData.commentaire || "",
            });
            setLoading(false);
        });
    }, [id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/dfc/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                const updated = await fetch(`/api/dfc/${id}`).then((r) => r.json());
                setDfc(updated);
                setEditing(false);
            }
        } finally {
            setSaving(false);
        }
    };

    const faisabiliteLabel = (f: string) =>
        f === "OUI" ? "Oui" : f === "NON" ? "Non" : f === "EN_COURS" ? "En cours" : "À clarifier";
    const faisabiliteBadge = (f: string) =>
        f === "OUI" ? "badge-success" : f === "NON" ? "badge-danger" : f === "EN_COURS" ? "badge-warning" : "badge-info";

    const fieldLabels: Record<string, string> = {
        description: "Description",
        faisabilite: "Faisabilité",
        typeDFC: "Type DFC",
        commentaire: "Commentaire",
        projectId: "Projet",
        familyId: "Famille",
        phaseId: "Phase",
        numeroDerogation: "N° Dérogation",
    };

    if (loading) {
        return (
            <>
                <Header title="Chargement..." />
                <div className="page-content">
                    <div className="skeleton" style={{ height: 300, marginBottom: 20 }} />
                </div>
            </>
        );
    }

    if (!dfc) return null;

    return (
        <>
            <Header title={`DFC #${dfc.numero}`} subtitle={dfc.project.name} />
            <div className="page-content animate-in">
                <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
                    <Link href="/dfc" className="btn btn-secondary"><FiArrowLeft /> Retour</Link>
                    {!editing && (
                        <button className="btn btn-primary" onClick={() => setEditing(true)}><FiEdit /> Modifier</button>
                    )}
                </div>

                {editing ? (
                    /* Edit Mode */
                    <div>
                        <div className="form-card" style={{ marginBottom: 20 }}>
                            <h3 className="form-card-title">Modifier le DFC</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Projet</label>
                                    <select name="projectId" className="form-select" value={form.projectId} onChange={handleChange}>
                                        {refData.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Famille</label>
                                    <select name="familyId" className="form-select" value={form.familyId} onChange={handleChange}>
                                        {refData.families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phase</label>
                                    <select name="phaseId" className="form-select" value={form.phaseId} onChange={handleChange}>
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
                                <label className="form-label">Description</label>
                                <textarea name="description" className="form-textarea" value={form.description} onChange={handleChange} />
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Faisabilité</label>
                                    <select name="faisabilite" className="form-select" value={form.faisabilite} onChange={handleChange}>
                                        <option value="OUI">Oui</option>
                                        <option value="NON">Non</option>
                                        <option value="EN_COURS">En cours</option>
                                        <option value="A_CLARIFIER">À clarifier</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Date de réponse</label>
                                    <input type="date" name="dateReponse" className="form-input" value={form.dateReponse} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Délai (jours)</label>
                                    <input type="number" name="delaiReponse" className="form-input" value={form.delaiReponse} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">N° Dérogation</label>
                                    <input type="text" name="numeroDerogation" className="form-input" value={form.numeroDerogation} onChange={handleChange} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Commentaire</label>
                                <textarea name="commentaire" className="form-textarea" value={form.commentaire} onChange={handleChange} />
                            </div>
                            <div className="form-actions">
                                <button className="btn btn-secondary" onClick={() => setEditing(false)}><FiX /> Annuler</button>
                                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                    {saving ? <><span className="loading-spinner" /> Enregistrement...</> : <><FiSave /> Sauvegarder</>}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* View Mode */
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <div className="form-card">
                            <h3 className="form-card-title">Informations</h3>
                            <div style={{ display: "grid", gap: 12 }}>
                                {[
                                    ["N° DFC", dfc.numero],
                                    ["Projet", dfc.project.name],
                                    ["Famille", dfc.family.name],
                                    ["Phase", dfc.phase.name],
                                    ["Type", dfc.typeDFC],
                                    ["Créé par", `${dfc.createdBy.prenom} ${dfc.createdBy.nom}`],
                                    ["Date réception", new Date(dfc.dateReception).toLocaleDateString("fr-FR")],
                                    ["Date réponse", dfc.dateReponse ? new Date(dfc.dateReponse).toLocaleDateString("fr-FR") : "—"],
                                    ["Délai", dfc.delaiReponse ? `${dfc.delaiReponse} jours` : "—"],
                                ].map(([label, value]) => (
                                    <div key={label as string} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                                        <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{label}</span>
                                        <span style={{ fontWeight: 600, fontSize: 14 }}>{value}</span>
                                    </div>
                                ))}
                                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                                    <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Faisabilité</span>
                                    <span className={`badge ${faisabiliteBadge(dfc.faisabilite)}`}>
                                        {faisabiliteLabel(dfc.faisabilite)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="form-card" style={{ marginBottom: 20 }}>
                                <h3 className="form-card-title">Description</h3>
                                <p style={{ fontSize: 14, lineHeight: 1.7 }}>{dfc.description}</p>
                                {dfc.commentaire && (
                                    <>
                                        <h4 style={{ fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>Commentaire</h4>
                                        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{dfc.commentaire}</p>
                                    </>
                                )}
                            </div>

                            {dfc.numeroDerogation && (
                                <div className="form-card" style={{ marginBottom: 20 }}>
                                    <h3 className="form-card-title">Dérogation</h3>
                                    <div style={{ display: "grid", gap: 8 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>N°</span>
                                            <span style={{ fontWeight: 600 }}>{dfc.numeroDerogation}</span>
                                        </div>
                                        {dfc.dateReceptionDerogation && (
                                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Reçue le</span>
                                                <span>{new Date(dfc.dateReceptionDerogation).toLocaleDateString("fr-FR")}</span>
                                            </div>
                                        )}
                                        {dfc.dateApplicationEstimee && (
                                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Application estimée</span>
                                                <span>{new Date(dfc.dateApplicationEstimee).toLocaleDateString("fr-FR")}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* History */}
                        {dfc.histories.length > 0 && (
                            <div className="form-card" style={{ gridColumn: "1 / -1" }}>
                                <h3 className="form-card-title">Historique des modifications</h3>
                                <div style={{ display: "grid", gap: 12 }}>
                                    {dfc.histories.map((h) => (
                                        <div key={h.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
                                            <FiClock style={{ color: "var(--text-muted)", marginTop: 2, flexShrink: 0 }} />
                                            <div>
                                                <div style={{ fontSize: 13 }}>
                                                    <strong>{h.user.prenom} {h.user.nom}</strong> a modifié <strong>{fieldLabels[h.field] || h.field}</strong>
                                                </div>
                                                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                                                    {h.oldValue && <span style={{ textDecoration: "line-through", marginRight: 8 }}>{h.oldValue}</span>}
                                                    {h.newValue && <span style={{ color: "var(--success)" }}>→ {h.newValue}</span>}
                                                </div>
                                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                                    {new Date(h.changedAt).toLocaleString("fr-FR")}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import DFCFileManager from "@/components/DFCFileManager";
import DFCDerogationManager from "@/components/DFCDerogationManager";
import DFCEcoManager from "@/components/DFCEcoManager";
import Link from "next/link";
import { FiEdit, FiArrowLeft, FiSave, FiX, FiClock } from "react-icons/fi";
import { formatDate, formatDateTime } from "@/lib/i18n/format";
import { faisabilityLabels } from "@/lib/i18n/messages";

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
    assignedTo: { id: string; nom: string; prenom: string; matricule: string } | null;
    derogations?: Array<{
        id: string;
        numero: string | null;
        dateReception: string | null;
        dateApplicationEstimee: string | null;
        dateApplicationEffective: string | null;
        commentaire: string | null;
        createdAt: string;
    }>;
    eco?: {
        id: string;
        code: string;
        status: string;
        issuedAt: string | null;
        commentaire: string | null;
    } | null;
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
    users: { id: string; nom: string; prenom: string; matricule: string; fonction: string }[];
}

export default function DFCDetailPage() {
    const { id } = useParams();
    const dfcId = Array.isArray(id) ? id[0] : id;
    const router = useRouter();
    const searchParams = useSearchParams();
    const [dfc, setDfc] = useState<DFCDetail | null>(null);
    const [editing, setEditing] = useState(searchParams.get("edit") === "true");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refData, setRefData] = useState<RefData>({ projects: [], families: [], phases: [], users: [] });
    const [form, setForm] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!dfcId) {
            setLoadError("Invalid DFC identifier");
            setLoading(false);
            return;
        }

        const readJsonSafe = async (response: Response) => {
            const raw = await response.text();
            if (!raw) return null;
            try {
                return JSON.parse(raw) as unknown;
            } catch {
                return null;
            }
        };

        const load = async () => {
            try {
                setLoadError(null);

                const [dfcRes, refRes] = await Promise.all([
                    fetch(`/api/dfc/${dfcId}`),
                    fetch("/api/reference"),
                ]);

                const dfcPayload = await readJsonSafe(dfcRes);
                const refPayload = await readJsonSafe(refRes);

                if (!dfcRes.ok || !dfcPayload) {
                    const apiError = (dfcPayload as { error?: string } | null)?.error;
                    setLoadError(apiError || "Failed to load DFC details");
                    return;
                }

                if (!refRes.ok || !refPayload) {
                    setLoadError("Failed to load reference data");
                    return;
                }

                const dfcData = dfcPayload as DFCDetail;
                const ref = refPayload as RefData;

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
                    assignedToId: dfcData.assignedTo?.id || "",
                });
            } catch {
                setLoadError("Connection error while loading DFC details");
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [dfcId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/dfc/${dfcId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                const updatedRes = await fetch(`/api/dfc/${dfcId}`);
                const updatedText = await updatedRes.text();
                if (updatedRes.ok && updatedText) {
                    setDfc(JSON.parse(updatedText) as DFCDetail);
                    setEditing(false);
                }
            }
        } finally {
            setSaving(false);
        }
    };

    const faisabiliteLabel = (f: string) => faisabilityLabels[f] || f;
    const faisabiliteBadge = (f: string) =>
        f === "OUI" ? "badge-success" : f === "NON" ? "badge-danger" : f === "EN_COURS" ? "badge-warning" : "badge-info";

    const fieldLabels: Record<string, string> = {
        description: "Description",
        faisabilite: "Feasibility",
        typeDFC: "Type DFC",
        commentaire: "Comment",
        projectId: "Project",
        familyId: "Family",
        phaseId: "Phase",
        numeroDerogation: "Waiver number",
        assignedToId: "Assigned responsible",
    };

    if (loading) {
        return (
            <>
                <Header title="Loading..." />
                <div className="page-content">
                    <div className="skeleton" style={{ height: 300, marginBottom: 20 }} />
                </div>
            </>
        );
    }

    if (loadError) {
        return (
            <>
                <Header title="DFC" />
                <div className="page-content">
                    <div className="form-card" style={{ maxWidth: 640 }}>
                        <h3 className="form-card-title">Unable to load DFC</h3>
                        <p style={{ color: "var(--danger)", marginBottom: 16 }}>{loadError}</p>
                        <button className="btn btn-secondary" onClick={() => router.push("/dfc")}>Back to list</button>
                    </div>
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
                    <Link href="/dfc" className="btn btn-secondary"><FiArrowLeft /> Back</Link>
                    {!editing && (
                        <button className="btn btn-primary" onClick={() => setEditing(true)}><FiEdit /> Edit</button>
                    )}
                </div>

                {editing ? (
                    /* Edit Mode */
                    <div>
                        <div className="form-card" style={{ marginBottom: 20 }}>
                            <h3 className="form-card-title">Edit DFC</h3>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Project</label>
                                    <select name="projectId" className="form-select" value={form.projectId} onChange={handleChange}>
                                        {refData.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Family</label>
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
                                <div className="form-group">
                                    <label className="form-label">Assigned responsible</label>
                                    <select name="assignedToId" className="form-select" value={form.assignedToId || ""} onChange={handleChange}>
                                        <option value="">None</option>
                                        {refData.users.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.prenom} {u.nom} ({u.matricule})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea name="description" className="form-textarea" value={form.description} onChange={handleChange} />
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Feasibility</label>
                                    <select name="faisabilite" className="form-select" value={form.faisabilite} onChange={handleChange}>
                                        <option value="OUI">Yes</option>
                                        <option value="NON">No</option>
                                        <option value="EN_COURS">In progress</option>
                                        <option value="A_CLARIFIER">Needs clarification</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Response date</label>
                                    <input type="date" name="dateReponse" className="form-input" value={form.dateReponse} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Lead time (days)</label>
                                    <input type="number" name="delaiReponse" className="form-input" value={form.delaiReponse} onChange={handleChange} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Waiver No.</label>
                                    <input type="text" name="numeroDerogation" className="form-input" value={form.numeroDerogation} onChange={handleChange} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Comment</label>
                                <textarea name="commentaire" className="form-textarea" value={form.commentaire} onChange={handleChange} />
                            </div>
                            <div className="form-actions">
                                <button className="btn btn-secondary" onClick={() => setEditing(false)}><FiX /> Cancel</button>
                                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                    {saving ? <><span className="loading-spinner" /> Saving...</> : <><FiSave /> Save</>}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* View Mode */
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <div className="form-card">
                            <h3 className="form-card-title">Information</h3>
                            <div style={{ display: "grid", gap: 12 }}>
                                {[
                                    ["N° DFC", dfc.numero],
                                    ["Project", dfc.project.name],
                                    ["Family", dfc.family.name],
                                    ["Phase", dfc.phase.name],
                                    ["Type", dfc.typeDFC],
                                    ["Created by", `${dfc.createdBy.prenom} ${dfc.createdBy.nom}`],
                                    ["Assigned responsible", dfc.assignedTo ? `${dfc.assignedTo.prenom} ${dfc.assignedTo.nom}` : "—"],
                                    ["Received date", formatDate(dfc.dateReception)],
                                    ["Response date", dfc.dateReponse ? formatDate(dfc.dateReponse) : "—"],
                                    ["Lead time", dfc.delaiReponse ? `${dfc.delaiReponse} days` : "—"],
                                ].map(([label, value]) => (
                                    <div key={label as string} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
                                        <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{label}</span>
                                        <span style={{ fontWeight: 600, fontSize: 14 }}>{value}</span>
                                    </div>
                                ))}
                                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                                    <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Feasibility</span>
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
                                        <h4 style={{ fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>Comment</h4>
                                        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>{dfc.commentaire}</p>
                                    </>
                                )}
                            </div>

                            {dfc.numeroDerogation && (
                                <div className="form-card" style={{ marginBottom: 20 }}>
                                    <h3 className="form-card-title">Waiver</h3>
                                    <div style={{ display: "grid", gap: 8 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>N°</span>
                                            <span style={{ fontWeight: 600 }}>{dfc.numeroDerogation}</span>
                                        </div>
                                        {dfc.dateReceptionDerogation && (
                                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Received on</span>
                                                <span>{formatDate(dfc.dateReceptionDerogation)}</span>
                                            </div>
                                        )}
                                        {dfc.dateApplicationEstimee && (
                                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Estimated application</span>
                                                <span>{formatDate(dfc.dateApplicationEstimee)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* History */}
                        {dfc.histories.length > 0 && (
                            <div className="form-card" style={{ gridColumn: "1 / -1" }}>
                                <h3 className="form-card-title">Change history</h3>
                                <div style={{ display: "grid", gap: 12 }}>
                                    {dfc.histories.map((h) => (
                                        <div key={h.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
                                            <FiClock style={{ color: "var(--text-muted)", marginTop: 2, flexShrink: 0 }} />
                                            <div>
                                                <div style={{ fontSize: 13 }}>
                                                    <strong>{h.user.prenom} {h.user.nom}</strong> updated <strong>{fieldLabels[h.field] || h.field}</strong>
                                                </div>
                                                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                                                    {h.oldValue && <span style={{ textDecoration: "line-through", marginRight: 8 }}>{h.oldValue}</span>}
                                                    {h.newValue && <span style={{ color: "var(--success)" }}>→ {h.newValue}</span>}
                                                </div>
                                                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                                                    {formatDateTime(h.changedAt)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <DFCFileManager dfcId={dfc.id} />
                        <DFCDerogationManager dfcId={dfc.id} />
                        <DFCEcoManager dfcId={dfc.id} />
                    </div>
                )}
            </div>
        </>
    );
}

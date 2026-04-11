"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import FileImportUploader from "@/components/FileImportUploader";
import { FiSave, FiX } from "react-icons/fi";
import { useFeedback } from "@/components/ui/feedback-provider";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = new Set([
    "pdf",
    "xlsx",
    "csv",
    "doc",
    "docx",
    "png",
    "jpg",
    "jpeg",
]);

interface RefData {
    projects: { id: string; name: string }[];
    families: { id: string; name: string }[];
    phases: { id: string; name: string }[];
}

export default function NewDFCPage() {
    const router = useRouter();
    const { notify } = useFeedback();
    const [refData, setRefData] = useState<RefData>({ projects: [], families: [], phases: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [importSuccess, setImportSuccess] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [derogations, setDerogations] = useState<Array<{
        numero: string;
        dateReception: string;
        dateApplicationEstimee: string;
        dateApplicationEffective: string;
        commentaire: string;
    }>>([]);
    const [eco, setEco] = useState({
        code: "",
        status: "DRAFT",
        issuedAt: "",
        commentaire: "",
    });

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

    const handleFeasibilityFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const incoming = Array.from(e.target.files || []);

        if (incoming.length === 0) return;

        const validFiles: File[] = [];

        for (const file of incoming) {
            const ext = file.name.split(".").pop()?.toLowerCase() || "";
            if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
                notify.error(`Unsupported file type: ${file.name}`);
                continue;
            }
            if (file.size > MAX_FILE_SIZE_BYTES) {
                notify.error(`File exceeds 20MB: ${file.name}`);
                continue;
            }

            validFiles.push(file);
        }

        if (validFiles.length > 0) {
            setSelectedFiles((prev) => [...prev, ...validFiles]);
        }

        e.target.value = "";
    };

    const removeSelectedFile = (index: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const addDerogation = () => {
        setDerogations((prev) => [
            ...prev,
            {
                numero: "",
                dateReception: "",
                dateApplicationEstimee: "",
                dateApplicationEffective: "",
                commentaire: "",
            },
        ]);
    };

    const updateDerogation = (index: number, key: string, value: string) => {
        setDerogations((prev) =>
            prev.map((item, i) => (i === index ? { ...item, [key]: value } : item))
        );
    };

    const removeDerogation = (index: number) => {
        setDerogations((prev) => prev.filter((_, i) => i !== index));
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
            setError("Please fill in all required fields");
            setLoading(false);
            return;
        }

        try {
            const validDerogations = derogations.filter(
                (d) =>
                    d.numero ||
                    d.dateReception ||
                    d.dateApplicationEstimee ||
                    d.dateApplicationEffective ||
                    d.commentaire
            );

            const ecoPayload = eco.code
                ? {
                    code: eco.code,
                    status: eco.status,
                    issuedAt: eco.issuedAt || null,
                    commentaire: eco.commentaire || null,
                }
                : null;

            const res = await fetch("/api/dfc", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    derogations: validDerogations,
                    eco: ecoPayload,
                }),
            });

            const created = await res.json();
            if (!res.ok) throw new Error(created.error || "Error");

            if (selectedFiles.length > 0) {
                const formData = new FormData();
                selectedFiles.forEach((file) => formData.append("files", file));

                const uploadRes = await fetch(`/api/dfc/${created.id}/files`, {
                    method: "POST",
                    body: formData,
                });

                if (!uploadRes.ok) {
                    const uploadErrorData = await uploadRes.json();
                    notify.error(uploadErrorData.error || "DFC created but file upload failed");
                    router.push(`/dfc/${created.id}`);
                    return;
                }
            }

            notify.success("DFC created successfully");
            router.push("/dfc");
        } catch {
            setError("Failed to create DFC");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Header title="New DFC" subtitle="Create a new feasibility request" />
            <div className="page-content animate-in">
                <FileImportUploader onExtracted={handleExtracted} />

                {importSuccess && (
                    <div className="import-success-banner">
                        Form pre-filled successfully. Review the data below before submitting.
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {error && <div className="login-error" style={{ marginBottom: 20 }}>{error}</div>}

                    <div className="form-card" style={{ marginBottom: 20 }}>
                        <h3 className="form-card-title">General information</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Project *</label>
                                <select name="projectId" className="form-select" value={form.projectId} onChange={handleChange} required>
                                    <option value="">Select a project</option>
                                    {refData.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Family *</label>
                                <select name="familyId" className="form-select" value={form.familyId} onChange={handleChange} required>
                                    <option value="">Select a family</option>
                                    {refData.families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phase *</label>
                                <select name="phaseId" className="form-select" value={form.phaseId} onChange={handleChange} required>
                                    <option value="">Select a phase</option>
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
                                placeholder="Detailed DFC description..."
                                value={form.description}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-card" style={{ marginBottom: 20 }}>
                        <h3 className="form-card-title">Feasibility files</h3>
                        <div className="form-group">
                            <label className="form-label">Attach files (optional)</label>
                            <input
                                type="file"
                                className="form-input"
                                multiple
                                accept=".pdf,.xlsx,.csv,.doc,.docx,.png,.jpg,.jpeg"
                                onChange={handleFeasibilityFileChange}
                            />
                            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                                Allowed: PDF, XLSX, CSV, DOC, DOCX, PNG, JPG (max 20MB each)
                            </p>
                        </div>
                        {selectedFiles.length > 0 && (
                            <div style={{ display: "grid", gap: 8 }}>
                                {selectedFiles.map((file, index) => (
                                    <div
                                        key={`${file.name}-${index}`}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            border: "1px solid var(--border-light)",
                                            borderRadius: 8,
                                            padding: "8px 12px",
                                        }}
                                    >
                                        <span style={{ fontSize: 13 }}>{file.name}</span>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => removeSelectedFile(index)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="form-card" style={{ marginBottom: 20 }}>
                        <h3 className="form-card-title">Dates and feasibility</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Received date *</label>
                                <input type="date" name="dateReception" className="form-input" value={form.dateReception} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Feasibility</label>
                                <div className="form-radio-group">
                                    {[
                                        { value: "OUI", label: "Yes" },
                                        { value: "NON", label: "No" },
                                        { value: "EN_COURS", label: "In progress (OG)" },
                                        { value: "A_CLARIFIER", label: "Needs clarification (NC)" },
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
                                <label className="form-label">Response date</label>
                                <input type="date" name="dateReponse" className="form-input" value={form.dateReponse} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Response lead time (days)</label>
                                <input type="number" name="delaiReponse" className="form-input" placeholder="Number of days" value={form.delaiReponse} onChange={handleChange} />
                            </div>
                        </div>
                    </div>

                    <div className="form-card" style={{ marginBottom: 20 }}>
                        <h3 className="form-card-title">Waiver</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Waiver No.</label>
                                <input type="text" name="numeroDerogation" className="form-input" placeholder="Ex: DRG1111111-1" value={form.numeroDerogation} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Waiver received date</label>
                                <input type="date" name="dateReceptionDerogation" className="form-input" value={form.dateReceptionDerogation} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Estimated application date</label>
                                <input type="date" name="dateApplicationEstimee" className="form-input" value={form.dateApplicationEstimee} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Actual application date</label>
                                <input type="date" name="dateApplicationDerogation" className="form-input" value={form.dateApplicationDerogation} onChange={handleChange} />
                            </div>
                        </div>
                    </div>

                    <div className="form-card" style={{ marginBottom: 20 }}>
                        <h3 className="form-card-title">Additional derogations</h3>
                        <div style={{ marginBottom: 12 }}>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={addDerogation}>
                                Add derogation
                            </button>
                        </div>
                        {derogations.length === 0 ? (
                            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                                No additional derogation added.
                            </p>
                        ) : (
                            <div style={{ display: "grid", gap: 12 }}>
                                {derogations.map((item, index) => (
                                    <div
                                        key={`derogation-${index}`}
                                        style={{ border: "1px solid var(--border-light)", borderRadius: 8, padding: 12 }}
                                    >
                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label className="form-label">Waiver No.</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={item.numero}
                                                    onChange={(e) => updateDerogation(index, "numero", e.target.value)}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Received date</label>
                                                <input
                                                    type="date"
                                                    className="form-input"
                                                    value={item.dateReception}
                                                    onChange={(e) => updateDerogation(index, "dateReception", e.target.value)}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Estimated application</label>
                                                <input
                                                    type="date"
                                                    className="form-input"
                                                    value={item.dateApplicationEstimee}
                                                    onChange={(e) => updateDerogation(index, "dateApplicationEstimee", e.target.value)}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Effective application</label>
                                                <input
                                                    type="date"
                                                    className="form-input"
                                                    value={item.dateApplicationEffective}
                                                    onChange={(e) => updateDerogation(index, "dateApplicationEffective", e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Comment</label>
                                            <textarea
                                                className="form-textarea"
                                                value={item.commentaire}
                                                onChange={(e) => updateDerogation(index, "commentaire", e.target.value)}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => removeDerogation(index)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="form-card" style={{ marginBottom: 20 }}>
                        <h3 className="form-card-title">ECO (optional)</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">ECO code</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={eco.code}
                                    onChange={(e) => setEco((prev) => ({ ...prev, code: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select
                                    className="form-select"
                                    value={eco.status}
                                    onChange={(e) => setEco((prev) => ({ ...prev, status: e.target.value }))}
                                >
                                    <option value="DRAFT">DRAFT</option>
                                    <option value="VALIDATED">VALIDATED</option>
                                    <option value="RELEASED">RELEASED</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Issued at</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={eco.issuedAt}
                                    onChange={(e) => setEco((prev) => ({ ...prev, issuedAt: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Comment</label>
                            <textarea
                                className="form-textarea"
                                value={eco.commentaire}
                                onChange={(e) => setEco((prev) => ({ ...prev, commentaire: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="form-card">
                        <h3 className="form-card-title">Comments</h3>
                        <div className="form-group">
                            <textarea
                                name="commentaire"
                                className="form-textarea"
                                placeholder="Comments and notes..."
                                value={form.commentaire}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
                                <FiX /> Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? <><span className="loading-spinner" /> Saving...</> : <><FiSave /> Save</>}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </>
    );
}

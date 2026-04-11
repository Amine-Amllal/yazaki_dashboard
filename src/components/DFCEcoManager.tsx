"use client";

import { useEffect, useState } from "react";
import { FiSave, FiTrash2 } from "react-icons/fi";
import { useFeedback } from "@/components/ui/feedback-provider";
import { formatDate } from "@/lib/i18n/format";

interface EcoRecord {
    id: string;
    code: string;
    status: string;
    issuedAt: string | null;
    commentaire: string | null;
}

export default function DFCEcoManager({ dfcId }: { dfcId: string }) {
    const { notify, confirm } = useFeedback();
    const [eco, setEco] = useState<EcoRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({
        code: "",
        status: "DRAFT",
        issuedAt: "",
        commentaire: "",
    });

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/dfc/${dfcId}/eco`);
                const data = await res.json();
                if (!res.ok) {
                    notify.error(data.error || "Failed to load ECO");
                    return;
                }
                setEco(data.eco || null);
                if (data.eco) {
                    setForm({
                        code: data.eco.code,
                        status: data.eco.status,
                        issuedAt: data.eco.issuedAt ? data.eco.issuedAt.split("T")[0] : "",
                        commentaire: data.eco.commentaire || "",
                    });
                }
            } catch {
                notify.error("Connection error while loading ECO");
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [dfcId, notify]);

    const saveEco = async () => {
        if (!form.code) {
            notify.error("ECO code is required");
            return;
        }

        try {
            const res = await fetch(`/api/dfc/${dfcId}/eco`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) {
                notify.error(data.error || "Failed to save ECO");
                return;
            }
            setEco(data.eco);
            notify.success("ECO saved");
        } catch {
            notify.error("Connection error while saving ECO");
        }
    };

    const deleteEco = async () => {
        if (!eco) return;

        const accepted = await confirm({
            title: "Delete ECO",
            message: `Delete ECO ${eco.code}?`,
            confirmText: "Delete",
            cancelText: "Cancel",
            danger: true,
        });
        if (!accepted) return;

        try {
            const res = await fetch(`/api/dfc/${dfcId}/eco`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) {
                notify.error(data.error || "Failed to delete ECO");
                return;
            }
            setEco(null);
            setForm({ code: "", status: "DRAFT", issuedAt: "", commentaire: "" });
            notify.success("ECO deleted");
        } catch {
            notify.error("Connection error while deleting ECO");
        }
    };

    return (
        <div className="form-card" style={{ gridColumn: "1 / -1" }}>
            <h3 className="form-card-title">ECO (0..1)</h3>

            {loading ? (
                <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading ECO...</p>
            ) : (
                <>
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">ECO code</label>
                            <input className="form-input" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-select" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                                <option value="DRAFT">DRAFT</option>
                                <option value="VALIDATED">VALIDATED</option>
                                <option value="RELEASED">RELEASED</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Issued at</label>
                            <input type="date" className="form-input" value={form.issuedAt} onChange={(e) => setForm((p) => ({ ...p, issuedAt: e.target.value }))} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Comment</label>
                        <textarea className="form-textarea" value={form.commentaire} onChange={(e) => setForm((p) => ({ ...p, commentaire: e.target.value }))} />
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={saveEco}>
                            <FiSave /> Save ECO
                        </button>
                        {eco && (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={deleteEco}>
                                <FiTrash2 /> Delete ECO
                            </button>
                        )}
                    </div>

                    {eco && (
                        <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                            Current ECO: <strong>{eco.code}</strong> ({eco.status})
                            {eco.issuedAt ? ` - ${formatDate(eco.issuedAt)}` : ""}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

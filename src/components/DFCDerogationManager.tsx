"use client";

import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { useFeedback } from "@/components/ui/feedback-provider";
import { formatDate } from "@/lib/i18n/format";

interface DerogationRecord {
    id: string;
    numero: string | null;
    dateReception: string | null;
    dateApplicationEstimee: string | null;
    dateApplicationEffective: string | null;
    commentaire: string | null;
    createdAt: string;
}

export default function DFCDerogationManager({ dfcId }: { dfcId: string }) {
    const { notify, confirm } = useFeedback();
    const [items, setItems] = useState<DerogationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({
        numero: "",
        dateReception: "",
        dateApplicationEstimee: "",
        dateApplicationEffective: "",
        commentaire: "",
    });

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/dfc/${dfcId}/derogations`);
            const data = await res.json();
            if (!res.ok) {
                notify.error(data.error || "Failed to load derogations");
                return;
            }
            setItems(data.derogations || []);
        } catch {
            notify.error("Connection error while loading derogations");
        } finally {
            setLoading(false);
        }
    }, [dfcId, notify]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    const createItem = async () => {
        try {
            const res = await fetch(`/api/dfc/${dfcId}/derogations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) {
                notify.error(data.error || "Failed to create derogation");
                return;
            }
            setItems((prev) => [data, ...prev]);
            setForm({
                numero: "",
                dateReception: "",
                dateApplicationEstimee: "",
                dateApplicationEffective: "",
                commentaire: "",
            });
            notify.success("Derogation added");
        } catch {
            notify.error("Connection error while creating derogation");
        }
    };

    const deleteItem = async (id: string, numero: string | null) => {
        const accepted = await confirm({
            title: "Delete derogation",
            message: `Delete derogation ${numero || ""}?`,
            confirmText: "Delete",
            cancelText: "Cancel",
            danger: true,
        });
        if (!accepted) return;

        try {
            const res = await fetch(`/api/dfc/${dfcId}/derogations/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) {
                notify.error(data.error || "Failed to delete derogation");
                return;
            }
            setItems((prev) => prev.filter((item) => item.id !== id));
            notify.success("Derogation deleted");
        } catch {
            notify.error("Connection error while deleting derogation");
        }
    };

    return (
        <div className="form-card" style={{ gridColumn: "1 / -1" }}>
            <h3 className="form-card-title">Derogations</h3>

            <div className="form-grid" style={{ marginBottom: 12 }}>
                <div className="form-group">
                    <label className="form-label">Waiver No.</label>
                    <input className="form-input" value={form.numero} onChange={(e) => setForm((p) => ({ ...p, numero: e.target.value }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Received date</label>
                    <input type="date" className="form-input" value={form.dateReception} onChange={(e) => setForm((p) => ({ ...p, dateReception: e.target.value }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Estimated application</label>
                    <input type="date" className="form-input" value={form.dateApplicationEstimee} onChange={(e) => setForm((p) => ({ ...p, dateApplicationEstimee: e.target.value }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Effective application</label>
                    <input type="date" className="form-input" value={form.dateApplicationEffective} onChange={(e) => setForm((p) => ({ ...p, dateApplicationEffective: e.target.value }))} />
                </div>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label">Comment</label>
                <textarea className="form-textarea" value={form.commentaire} onChange={(e) => setForm((p) => ({ ...p, commentaire: e.target.value }))} />
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={createItem}>
                <FiPlus /> Add derogation
            </button>

            <div style={{ marginTop: 16 }}>
                {loading ? (
                    <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading derogations...</p>
                ) : items.length === 0 ? (
                    <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No derogation linked to this DFC.</p>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>No.</th>
                                    <th>Received</th>
                                    <th>Estimated</th>
                                    <th>Effective</th>
                                    <th>Comment</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id}>
                                        <td>{item.numero || "-"}</td>
                                        <td>{item.dateReception ? formatDate(item.dateReception) : "-"}</td>
                                        <td>{item.dateApplicationEstimee ? formatDate(item.dateApplicationEstimee) : "-"}</td>
                                        <td>{item.dateApplicationEffective ? formatDate(item.dateApplicationEffective) : "-"}</td>
                                        <td style={{ maxWidth: 220 }}>{item.commentaire || "-"}</td>
                                        <td>
                                            <button type="button" className="btn btn-secondary btn-sm btn-icon" onClick={() => deleteItem(item.id, item.numero)} title="Delete">
                                                <FiTrash2 />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

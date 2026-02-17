"use client";

import { useEffect, useState } from "react";
import { FiX, FiClock } from "react-icons/fi";

interface HistoryEntry {
    id: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    changedAt: string;
    user: {
        nom: string;
        prenom: string;
    };
}

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    dfcId: string;
    initialHistory?: HistoryEntry[];
}

export default function HistoryModal({ isOpen, onClose, dfcId, initialHistory }: HistoryModalProps) {
    const [history, setHistory] = useState<HistoryEntry[]>(initialHistory || []);
    const [loading, setLoading] = useState(!initialHistory);

    useEffect(() => {
        if (isOpen && !initialHistory) {
            setLoading(true);
            fetch(`/api/dfc/${dfcId}`)
                .then((res) => res.json())
                .then((data) => {
                    setHistory(data.histories || []);
                    setLoading(false);
                })
                .catch((err) => {
                    console.error("Error fetching history:", err);
                    setLoading(false);
                });
        }
    }, [isOpen, dfcId, initialHistory]);

    if (!isOpen) return null;

    const fieldLabels: Record<string, string> = {
        description: "Description",
        faisabilite: "Faisabilité",
        typeDFC: "Type DFC",
        commentaire: "Commentaire",
        projectId: "Projet",
        familyId: "Famille",
        phaseId: "Phase",
        numeroDerogation: "N° Dérogation",
        STATUS: "Statut",
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Historique du DFC</h3>
                    <button className="modal-close" onClick={onClose}><FiX /></button>
                </div>
                <div className="modal-body">
                    {loading ? (
                        <div style={{ textAlign: "center", padding: 20 }}>Chargement...</div>
                    ) : history.length === 0 ? (
                        <div style={{ textAlign: "center", padding: 20, color: "var(--text-secondary)" }}>
                            Aucun historique disponible
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: 12 }}>
                            {history.map((h) => (
                                <div key={h.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
                                    <FiClock style={{ color: "var(--text-muted)", marginTop: 2, flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontSize: 14 }}>
                                            <strong>{h.user.prenom} {h.user.nom}</strong>
                                            {h.field === "STATUS" && h.newValue === "CREATED" ? (
                                                <span> a créé le DFC</span>
                                            ) : (
                                                <> a modifié <strong>{fieldLabels[h.field] || h.field}</strong></>
                                            )}
                                        </div>
                                        {!(h.field === "STATUS" && h.newValue === "CREATED") && (
                                            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                                                {h.oldValue && <span style={{ textDecoration: "line-through", marginRight: 8 }}>{h.oldValue}</span>}
                                                {h.newValue && <span style={{ color: "var(--success)" }}>→ {h.newValue}</span>}
                                            </div>
                                        )}
                                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                                            {new Date(h.changedAt).toLocaleString("fr-FR")}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

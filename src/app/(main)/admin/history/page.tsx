"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { FiClock, FiRefreshCw } from "react-icons/fi";
import Link from "next/link";

interface HistoryEntry {
    id: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    changedAt: string;
    user: {
        nom: string;
        prenom: string;
        matricule: string;
    };
    dfc: {
        id: string;
        numero: number;
        description: string;
    };
}

interface UserOption {
    id: string;
    nom: string;
    prenom: string;
    matricule: string;
}

export default function GlobalHistoryPage() {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [limit, setLimit] = useState(50);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [selectedUserId, setSelectedUserId] = useState("");

    const fetchHistory = async () => {
        setLoading(true);
        try {
            let url = `/api/history?limit=${limit}`;
            if (selectedUserId) url += `&userId=${selectedUserId}`;
            const res = await fetch(url);
            const data = await res.json();
            if (Array.isArray(data)) {
                setHistory(data);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/users");
            const data = await res.json();
            if (Array.isArray(data)) {
                setUsers(data);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [limit, selectedUserId]);

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
        <>
            <Header title="Historique Global" subtitle="Tracabilité de toutes les actions" />
            <div className="page-content animate-in">
                <div className="filters-bar">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)" }}>
                        <FiClock /> Dernières activités
                    </div>
                    <select
                        className="filter-select"
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                        <option value="">Tous les utilisateurs</option>
                        {users.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.prenom} {u.nom} ({u.matricule})
                            </option>
                        ))}
                    </select>
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-secondary" onClick={fetchHistory}>
                        <FiRefreshCw /> Actualiser
                    </button>
                </div>

                <div className="table-card">
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Utilisateur</th>
                                    <th>DFC</th>
                                    <th>Action</th>
                                    <th>Détail</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i}>
                                            {Array.from({ length: 5 }).map((_, j) => (
                                                <td key={j}><div className="skeleton" style={{ height: 16, width: "80%" }} /></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : history.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: "center", padding: 40 }}>
                                            Aucun historique trouvé
                                        </td>
                                    </tr>
                                ) : (
                                    history.map((h) => (
                                        <tr key={h.id}>
                                            <td style={{ whiteSpace: "nowrap" }}>
                                                {new Date(h.changedAt).toLocaleString("fr-FR")}
                                            </td>
                                            <td>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{h.user.prenom} {h.user.nom}</div>
                                                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{h.user.matricule}</div>
                                                </div>
                                            </td>
                                            <td>
                                                <Link href={`/dfc/${h.dfc.id}`} className="link hover-underline">
                                                    <strong>#{h.dfc.numero}</strong>
                                                </Link>
                                                <div style={{ fontSize: 11, color: "var(--text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {h.dfc.description}
                                                </div>
                                            </td>
                                            <td>
                                                {h.field === "STATUS" && h.newValue === "CREATED" ? (
                                                    <span className="badge badge-success">Création</span>
                                                ) : (
                                                    <span className="badge badge-info">Modification</span>
                                                )}
                                            </td>
                                            <td>
                                                {h.field === "STATUS" && h.newValue === "CREATED" ? (
                                                    <span>A créé le DFC</span>
                                                ) : (
                                                    <div>
                                                        A modifié <strong>{fieldLabels[h.field] || h.field}</strong>
                                                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                                                            {h.oldValue && <span style={{ textDecoration: "line-through", marginRight: 8, color: "var(--text-secondary)" }}>{h.oldValue}</span>}
                                                            {h.newValue && <span style={{ color: "var(--success)" }}>→ {h.newValue}</span>}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}

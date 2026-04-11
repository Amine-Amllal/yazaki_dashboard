"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import Link from "next/link";
import { FiArrowLeft, FiClock, FiRefreshCw, FiEdit, FiPlusCircle } from "react-icons/fi";
import { formatDateTime } from "@/lib/i18n/format";

interface UserInfo {
    id: string;
    nom: string;
    prenom: string;
    matricule: string;
    email: string;
    fonction: string;
}

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

export default function UserHistoryPage() {
    const params = useParams();
    const router = useRouter();
    const userId = params.id as string;

    const [user, setUser] = useState<UserInfo | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [userRes, historyRes] = await Promise.all([
                fetch(`/api/users/${userId}`),
                fetch(`/api/history?userId=${userId}&limit=100`),
            ]);
            const userData = await userRes.json();
            const historyData = await historyRes.json();

            setUser(userData);
            if (Array.isArray(historyData)) {
                setHistory(historyData);
            }
        } catch (error) {
            console.error("Error fetching user history:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [userId]);

    const fieldLabels: Record<string, string> = {
        description: "Description",
        faisabilite: "Feasibility",
        typeDFC: "Type DFC",
        commentaire: "Comment",
        projectId: "Project",
        familyId: "Family",
        phaseId: "Phase",
        numeroDerogation: "Waiver number",
        STATUS: "Status",
    };

    const creations = history.filter((h) => h.field === "STATUS" && h.newValue === "CREATED").length;
    const modifications = history.filter((h) => !(h.field === "STATUS" && h.newValue === "CREATED")).length;

    const fonctionLabel = (f: string) =>
        f === "PP_RESPONSIBLE" ? "PP Responsible" :
            f === "PP_TECHNICIAN" ? "PP Technician" : "PP Coordinator";

    return (
        <>
            <Header
                title={user ? `${user.prenom} ${user.nom} history` : "User history"}
                subtitle={user ? `${user.matricule} — ${fonctionLabel(user.fonction)}` : "Loading..."}
            />
            <div className="page-content animate-in">
                {/* Back + Refresh bar */}
                <div className="filters-bar">
                    <button className="btn btn-secondary" onClick={() => router.push("/admin/users")}>
                        <FiArrowLeft /> Back to users
                    </button>
                    <div style={{ flex: 1 }} />
                    <button className="btn btn-secondary" onClick={fetchData}>
                        <FiRefreshCw /> Refresh
                    </button>
                </div>

                {/* Summary cards */}
                <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 24 }}>
                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-card-label">Total Actions</div>
                            <div className="stat-card-icon blue"><FiClock /></div>
                        </div>
                        <div className="stat-card-value">{history.length}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-card-label">DFCs created</div>
                            <div className="stat-card-icon green"><FiPlusCircle /></div>
                        </div>
                        <div className="stat-card-value">{creations}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-card-label">Modifications</div>
                            <div className="stat-card-icon orange"><FiEdit /></div>
                        </div>
                        <div className="stat-card-value">{modifications}</div>
                    </div>
                </div>

                {/* History table */}
                <div className="table-card">
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>DFC</th>
                                    <th>Action</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i}>
                                            {Array.from({ length: 4 }).map((_, j) => (
                                                <td key={j}><div className="skeleton" style={{ height: 16, width: "80%" }} /></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : history.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
                                            No activity recorded for this user
                                        </td>
                                    </tr>
                                ) : (
                                    history.map((h) => (
                                        <tr key={h.id}>
                                            <td style={{ whiteSpace: "nowrap" }}>
                                                {formatDateTime(h.changedAt)}
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
                                                    <span className="badge badge-success">Created</span>
                                                ) : (
                                                    <span className="badge badge-info">Updated</span>
                                                )}
                                            </td>
                                            <td>
                                                {h.field === "STATUS" && h.newValue === "CREATED" ? (
                                                    <span>Created the DFC</span>
                                                ) : (
                                                    <div>
                                                        Updated <strong>{fieldLabels[h.field] || h.field}</strong>
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

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { useFeedback } from "@/components/ui/feedback-provider";
import { FiSearch, FiPlus, FiEye, FiEdit, FiTrash2 } from "react-icons/fi";
import { formatDate } from "@/lib/i18n/format";
import { faisabilityLabels, statusLabels } from "@/lib/i18n/messages";

interface DFC {
    id: string;
    numero: number;
    description: string;
    faisabilite: string;
    typeDFC: string;
    dateReception: string;
    dateReponse: string | null;
    isOverdue: boolean;
    slaDueDate: string | null;
    project: { name: string };
    family: { name: string };
    phase: { name: string };
    createdBy: { nom: string; prenom: string };
    assignedTo: { nom: string; prenom: string } | null;
}

interface RefData {
    projects: { id: string; name: string }[];
    users: { id: string; prenom: string; nom: string; matricule: string }[];
}

export default function DFCListPage() {
    const searchParams = useSearchParams();
    const { confirm, notify } = useFeedback();
    const [dfcs, setDfcs] = useState<DFC[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");
    const [projectFilter, setProjectFilter] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [faisabiliteFilter, setFaisabiliteFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [overdueOnlyFilter, setOverdueOnlyFilter] = useState("");
    const [assignedToFilter, setAssignedToFilter] = useState(searchParams.get("assignedToId") || "");
    const [projects, setProjects] = useState<RefData["projects"]>([]);
    const [users, setUsers] = useState<RefData["users"]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDFCs = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "15" });
        if (search) params.set("search", search);
        if (projectFilter) params.set("projectId", projectFilter);
        if (typeFilter) params.set("typeDFC", typeFilter);
        if (faisabiliteFilter) params.set("faisabilite", faisabiliteFilter);
        if (statusFilter) params.set("status", statusFilter);
        if (overdueOnlyFilter) params.set("overdueOnly", overdueOnlyFilter);
        if (assignedToFilter) params.set("assignedToId", assignedToFilter);

        const res = await fetch(`/api/dfc?${params}`);
        const data = await res.json();
        setDfcs(data.dfcs);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setLoading(false);
    }, [page, search, projectFilter, typeFilter, faisabiliteFilter, statusFilter, overdueOnlyFilter, assignedToFilter]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchDFCs();
    }, [fetchDFCs]);

    useEffect(() => {
        fetch("/api/reference")
            .then((r) => r.json())
            .then((data) => {
                setProjects(data.projects || []);
                setUsers(data.users || []);
            });
    }, []);

    const handleDelete = async (id: string) => {
        const accepted = await confirm({
            title: "Delete DFC",
            message: "Do you really want to delete this DFC?",
            confirmText: "Delete",
            cancelText: "Cancel",
            danger: true,
        });
        if (!accepted) return;

        try {
            const res = await fetch(`/api/dfc/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const err = await res.json();
                notify.error(err.error || "Failed to delete DFC");
                return;
            }
            notify.success("DFC deleted successfully");
            fetchDFCs();
        } catch {
            notify.error("Connection error");
        }
    };

    const faisabiliteLabel = (f: string) => faisabilityLabels[f] || f;

    const faisabiliteBadge = (f: string) =>
        f === "OUI" ? "badge-success" :
            f === "NON" ? "badge-danger" :
                f === "EN_COURS" ? "badge-warning" : "badge-info";

    return (
        <>
            <Header title="DFC List" subtitle={`${total} DFC total`} />
            <div className="page-content animate-in">
                {/* Filters */}
                <div className="filters-bar">
                    <div className="search-input">
                        <FiSearch />
                        <input
                            type="text"
                            placeholder="Search by description, number..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                    <select className="filter-select" value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setPage(1); }}>
                        <option value="">All projects</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select className="filter-select" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                        <option value="">All types</option>
                        <option value="T1">T1</option>
                        <option value="T2">T2</option>
                        <option value="T3">T3</option>
                        <option value="MISTAKED">Mistaked</option>
                    </select>
                    <select className="filter-select" value={faisabiliteFilter} onChange={(e) => { setFaisabiliteFilter(e.target.value); setPage(1); }}>
                        <option value="">All feasibility</option>
                        <option value="OUI">Yes</option>
                        <option value="NON">No</option>
                        <option value="EN_COURS">In progress</option>
                        <option value="A_CLARIFIER">Needs clarification</option>
                    </select>
                    <select className="filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                        <option value="">All statuses</option>
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                    </select>
                    <select className="filter-select" value={overdueOnlyFilter} onChange={(e) => { setOverdueOnlyFilter(e.target.value); setPage(1); }}>
                        <option value="">All delay status</option>
                        <option value="true">Overdue only</option>
                    </select>
                    <select className="filter-select" value={assignedToFilter} onChange={(e) => { setAssignedToFilter(e.target.value); setPage(1); }}>
                        <option value="">All responsibles</option>
                        {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
                        ))}
                    </select>
                    <Link href="/dfc/new" className="btn btn-primary">
                        <FiPlus /> New DFC
                    </Link>
                </div>

                {/* Table */}
                <div className="table-card">
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>N°</th>
                                    <th>Description</th>
                                    <th>Project</th>
                                    <th>Family</th>
                                    <th>Responsible</th>
                                    <th>Type</th>
                                    <th>Feasibility</th>
                                    <th>Received date</th>
                                    <th>Status</th>
                                    <th>Delay status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i}>
                                            {Array.from({ length: 11 }).map((_, j) => (
                                                <td key={j}><div className="skeleton" style={{ height: 16, width: "80%" }} /></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : dfcs.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} style={{ textAlign: "center", padding: 40 }}>
                                            No DFC found
                                        </td>
                                    </tr>
                                ) : (
                                    dfcs.map((dfc) => (
                                        <tr key={dfc.id}>
                                            <td><strong>{dfc.numero}</strong></td>
                                            <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {dfc.description}
                                            </td>
                                            <td>{dfc.project.name}</td>
                                            <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {dfc.family.name}
                                            </td>
                                            <td>
                                                {dfc.assignedTo
                                                    ? `${dfc.assignedTo.prenom} ${dfc.assignedTo.nom}`
                                                    : `${dfc.createdBy.prenom} ${dfc.createdBy.nom}`}
                                            </td>
                                            <td><span className="badge badge-neutral">{dfc.typeDFC}</span></td>
                                            <td>
                                                <span className={`badge ${faisabiliteBadge(dfc.faisabilite)}`}>
                                                    {faisabiliteLabel(dfc.faisabilite)}
                                                </span>
                                            </td>
                                            <td>{formatDate(dfc.dateReception)}</td>
                                            <td>
                                                <span className={`badge ${dfc.dateReponse ? "badge-success" : "badge-warning"}`}>
                                                    {dfc.dateReponse ? statusLabels.closed : statusLabels.open}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${dfc.isOverdue ? "badge-danger" : "badge-success"}`}>
                                                    {dfc.isOverdue ? "Overdue" : "On time"}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", gap: 4 }}>
                                                    <Link href={`/dfc/${dfc.id}`} className="btn btn-secondary btn-sm btn-icon" title="View">
                                                        <FiEye />
                                                    </Link>
                                                    <Link href={`/dfc/${dfc.id}?edit=true`} className="btn btn-secondary btn-sm btn-icon" title="Edit">
                                                        <FiEdit />
                                                    </Link>
                                                    <button onClick={() => handleDelete(dfc.id)} className="btn btn-secondary btn-sm btn-icon" title="Delete">
                                                        <FiTrash2 />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination">
                            <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                ‹
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                <button key={p} className={`pagination-btn ${p === page ? "active" : ""}`} onClick={() => setPage(p)}>
                                    {p}
                                </button>
                            ))}
                            <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                                ›
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

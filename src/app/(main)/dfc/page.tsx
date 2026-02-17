"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { FiSearch, FiPlus, FiEye, FiEdit, FiTrash2, FiClock } from "react-icons/fi";
import HistoryModal from "@/components/HistoryModal";

interface DFC {
    id: string;
    numero: number;
    description: string;
    faisabilite: string;
    typeDFC: string;
    dateReception: string;
    dateReponse: string | null;
    project: { name: string };
    family: { name: string };
    phase: { name: string };
    createdBy: { nom: string; prenom: string };
}

interface RefData {
    projects: { id: string; name: string }[];
}

export default function DFCListPage() {
    const [dfcs, setDfcs] = useState<DFC[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");
    const [projectFilter, setProjectFilter] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [faisabiliteFilter, setFaisabiliteFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [projects, setProjects] = useState<RefData["projects"]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDFCs = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "15" });
        if (search) params.set("search", search);
        if (projectFilter) params.set("projectId", projectFilter);
        if (typeFilter) params.set("typeDFC", typeFilter);
        if (faisabiliteFilter) params.set("faisabilite", faisabiliteFilter);
        if (statusFilter) params.set("status", statusFilter);

        const res = await fetch(`/api/dfc?${params}`);
        const data = await res.json();
        setDfcs(data.dfcs);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setLoading(false);
    }, [page, search, projectFilter, typeFilter, faisabiliteFilter, statusFilter]);

    useEffect(() => {
        fetchDFCs();
    }, [fetchDFCs]);

    useEffect(() => {
        fetch("/api/reference")
            .then((r) => r.json())
            .then((data) => setProjects(data.projects));
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Voulez-vous vraiment supprimer ce DFC ?")) return;
        await fetch(`/api/dfc/${id}`, { method: "DELETE" });
        fetchDFCs();
    };

    const faisabiliteLabel = (f: string) =>
        f === "OUI" ? "Oui" : f === "NON" ? "Non" : f === "EN_COURS" ? "En cours" : "À clarifier";

    const faisabiliteBadge = (f: string) =>
        f === "OUI" ? "badge-success" :
            f === "NON" ? "badge-danger" :
                f === "EN_COURS" ? "badge-warning" : "badge-info";

    return (
        <>
            <Header title="Liste des DFC" subtitle={`${total} DFC au total`} />
            <div className="page-content animate-in">
                {/* Filters */}
                <div className="filters-bar">
                    <div className="search-input">
                        <FiSearch />
                        <input
                            type="text"
                            placeholder="Rechercher par description, numéro..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                    <select className="filter-select" value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setPage(1); }}>
                        <option value="">Tous les projets</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select className="filter-select" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                        <option value="">Tous les types</option>
                        <option value="T1">T1</option>
                        <option value="T2">T2</option>
                        <option value="T3">T3</option>
                        <option value="MISTAKED">Mistaked</option>
                    </select>
                    <select className="filter-select" value={faisabiliteFilter} onChange={(e) => { setFaisabiliteFilter(e.target.value); setPage(1); }}>
                        <option value="">Toute faisabilité</option>
                        <option value="OUI">Oui</option>
                        <option value="NON">Non</option>
                        <option value="EN_COURS">En cours</option>
                        <option value="A_CLARIFIER">À clarifier</option>
                    </select>
                    <select className="filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                        <option value="">Tous les statuts</option>
                        <option value="open">Ouvert</option>
                        <option value="closed">Fermé</option>
                    </select>
                    <Link href="/dfc/new" className="btn btn-primary">
                        <FiPlus /> Nouveau DFC
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
                                    <th>Projet</th>
                                    <th>Famille</th>
                                    <th>Type</th>
                                    <th>Faisabilité</th>
                                    <th>Date réception</th>
                                    <th>Statut</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i}>
                                            {Array.from({ length: 9 }).map((_, j) => (
                                                <td key={j}><div className="skeleton" style={{ height: 16, width: "80%" }} /></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : dfcs.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} style={{ textAlign: "center", padding: 40 }}>
                                            Aucun DFC trouvé
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
                                            <td><span className="badge badge-neutral">{dfc.typeDFC}</span></td>
                                            <td>
                                                <span className={`badge ${faisabiliteBadge(dfc.faisabilite)}`}>
                                                    {faisabiliteLabel(dfc.faisabilite)}
                                                </span>
                                            </td>
                                            <td>{new Date(dfc.dateReception).toLocaleDateString("fr-FR")}</td>
                                            <td>
                                                <span className={`badge ${dfc.dateReponse ? "badge-success" : "badge-warning"}`}>
                                                    {dfc.dateReponse ? "Fermé" : "Ouvert"}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", gap: 4 }}>
                                                    <Link href={`/dfc/${dfc.id}`} className="btn btn-secondary btn-sm btn-icon" title="Voir">
                                                        <FiEye />
                                                    </Link>
                                                    <Link href={`/dfc/${dfc.id}?edit=true`} className="btn btn-secondary btn-sm btn-icon" title="Modifier">
                                                        <FiEdit />
                                                    </Link>
                                                    <button onClick={() => handleDelete(dfc.id)} className="btn btn-secondary btn-sm btn-icon" title="Supprimer">
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

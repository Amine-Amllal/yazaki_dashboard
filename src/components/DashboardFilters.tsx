"use client";

import { useState } from "react";
import { FiFilter, FiX, FiChevronDown, FiChevronUp } from "react-icons/fi";

export interface FilterValues {
    dateStart: string;
    dateEnd: string;
    projectId: string;
    familyId: string;
    typeDFC: string;
    statut: string;
    responsableId: string;
    faisabilite: string;
}

export interface FilterOptions {
    projects: { id: string; name: string }[];
    families: { id: string; name: string }[];
    users: { id: string; name: string }[];
}

interface DashboardFiltersProps {
    filters: FilterValues;
    filterOptions: FilterOptions | null;
    onFilterChange: (filters: FilterValues) => void;
    onApply: () => void;
}

const emptyFilters: FilterValues = {
    dateStart: "",
    dateEnd: "",
    projectId: "",
    familyId: "",
    typeDFC: "",
    statut: "",
    responsableId: "",
    faisabilite: "",
};

export default function DashboardFilters({ filters, filterOptions, onFilterChange, onApply }: DashboardFiltersProps) {
    const [expanded, setExpanded] = useState(false);

    const activeCount = Object.values(filters).filter((v) => v !== "").length;

    const handleChange = (key: keyof FilterValues, value: string) => {
        onFilterChange({ ...filters, [key]: value });
    };

    const handleReset = () => {
        onFilterChange({ ...emptyFilters });
        setTimeout(() => onApply(), 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") onApply();
    };

    return (
        <div className="dashboard-filters-wrapper">
            <button
                className="dashboard-filters-toggle"
                onClick={() => setExpanded(!expanded)}
                type="button"
            >
                <FiFilter />
                <span>Filtres avancés</span>
                {activeCount > 0 && <span className="filter-count-badge">{activeCount}</span>}
                {expanded ? <FiChevronUp /> : <FiChevronDown />}
            </button>

            {expanded && (
                <div className="dashboard-filters-panel" onKeyDown={handleKeyDown}>
                    <div className="dashboard-filters-grid">
                        {/* Période */}
                        <div className="filter-group">
                            <label className="filter-label">Date début</label>
                            <input
                                type="date"
                                className="filter-input"
                                value={filters.dateStart}
                                onChange={(e) => handleChange("dateStart", e.target.value)}
                            />
                        </div>
                        <div className="filter-group">
                            <label className="filter-label">Date fin</label>
                            <input
                                type="date"
                                className="filter-input"
                                value={filters.dateEnd}
                                onChange={(e) => handleChange("dateEnd", e.target.value)}
                            />
                        </div>

                        {/* Projet */}
                        <div className="filter-group">
                            <label className="filter-label">Projet</label>
                            <select
                                className="filter-input"
                                value={filters.projectId}
                                onChange={(e) => handleChange("projectId", e.target.value)}
                            >
                                <option value="">Tous les projets</option>
                                {filterOptions?.projects.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Famille */}
                        <div className="filter-group">
                            <label className="filter-label">Famille de produits</label>
                            <select
                                className="filter-input"
                                value={filters.familyId}
                                onChange={(e) => handleChange("familyId", e.target.value)}
                            >
                                <option value="">Toutes les familles</option>
                                {filterOptions?.families.map((f) => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Type DFC */}
                        <div className="filter-group">
                            <label className="filter-label">Type de DFC</label>
                            <select
                                className="filter-input"
                                value={filters.typeDFC}
                                onChange={(e) => handleChange("typeDFC", e.target.value)}
                            >
                                <option value="">Tous les types</option>
                                <option value="T1">T1</option>
                                <option value="T2">T2</option>
                                <option value="T3">T3</option>
                                <option value="MISTAKED">Mistaked</option>
                            </select>
                        </div>

                        {/* Statut */}
                        <div className="filter-group">
                            <label className="filter-label">Statut</label>
                            <select
                                className="filter-input"
                                value={filters.statut}
                                onChange={(e) => handleChange("statut", e.target.value)}
                            >
                                <option value="">Tous les statuts</option>
                                <option value="ouvert">Ouvert</option>
                                <option value="ferme">Fermé</option>
                            </select>
                        </div>

                        {/* Responsable */}
                        <div className="filter-group">
                            <label className="filter-label">Responsable</label>
                            <select
                                className="filter-input"
                                value={filters.responsableId}
                                onChange={(e) => handleChange("responsableId", e.target.value)}
                            >
                                <option value="">Tous les responsables</option>
                                {filterOptions?.users.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Faisabilité */}
                        <div className="filter-group">
                            <label className="filter-label">Faisabilité</label>
                            <select
                                className="filter-input"
                                value={filters.faisabilite}
                                onChange={(e) => handleChange("faisabilite", e.target.value)}
                            >
                                <option value="">Toutes</option>
                                <option value="OUI">Oui</option>
                                <option value="NON">Non</option>
                                <option value="EN_COURS">En cours (OG)</option>
                                <option value="A_CLARIFIER">À clarifier (NC)</option>
                            </select>
                        </div>
                    </div>

                    <div className="dashboard-filters-actions">
                        <button className="btn btn-primary btn-sm" onClick={onApply} type="button">
                            <FiFilter size={14} />
                            Appliquer
                        </button>
                        {activeCount > 0 && (
                            <button className="btn btn-outline btn-sm" onClick={handleReset} type="button">
                                <FiX size={14} />
                                Réinitialiser
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

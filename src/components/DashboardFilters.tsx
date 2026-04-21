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
    overdueOnly: string;
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
    overdueOnly: "",
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
                <span>Advanced filters</span>
                {activeCount > 0 && <span className="filter-count-badge">{activeCount}</span>}
                {expanded ? <FiChevronUp /> : <FiChevronDown />}
            </button>

            {expanded && (
                <div className="dashboard-filters-panel" onKeyDown={handleKeyDown}>
                    <div className="dashboard-filters-grid">
                        {/* Date range */}
                        <div className="filter-group">
                            <label className="filter-label">Start date</label>
                            <input
                                type="date"
                                className="filter-input"
                                value={filters.dateStart}
                                onChange={(e) => handleChange("dateStart", e.target.value)}
                            />
                        </div>
                        <div className="filter-group">
                            <label className="filter-label">End date</label>
                            <input
                                type="date"
                                className="filter-input"
                                value={filters.dateEnd}
                                onChange={(e) => handleChange("dateEnd", e.target.value)}
                            />
                        </div>

                        {/* Project */}
                        <div className="filter-group">
                            <label className="filter-label">Project</label>
                            <select
                                className="filter-input"
                                value={filters.projectId}
                                onChange={(e) => handleChange("projectId", e.target.value)}
                            >
                                <option value="">All projects</option>
                                {filterOptions?.projects.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Family */}
                        <div className="filter-group">
                            <label className="filter-label">Product family</label>
                            <select
                                className="filter-input"
                                value={filters.familyId}
                                onChange={(e) => handleChange("familyId", e.target.value)}
                            >
                                <option value="">All families</option>
                                {filterOptions?.families.map((f) => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Type DFC */}
                        <div className="filter-group">
                            <label className="filter-label">DFC type</label>
                            <select
                                className="filter-input"
                                value={filters.typeDFC}
                                onChange={(e) => handleChange("typeDFC", e.target.value)}
                            >
                                <option value="">All types</option>
                                <option value="T1">T1</option>
                                <option value="T2">T2</option>
                                <option value="T3">T3</option>
                                <option value="MISTAKED">Mistaked</option>
                            </select>
                        </div>

                        {/* Status */}
                        <div className="filter-group">
                            <label className="filter-label">Status</label>
                            <select
                                className="filter-input"
                                value={filters.statut}
                                onChange={(e) => handleChange("statut", e.target.value)}
                            >
                                <option value="">All statuses</option>
                                <option value="open">Open</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>

                        <div className="filter-group">
                            <label className="filter-label">Delay status</label>
                            <select
                                className="filter-input"
                                value={filters.overdueOnly}
                                onChange={(e) => handleChange("overdueOnly", e.target.value)}
                            >
                                <option value="">All</option>
                                <option value="true">Overdue only</option>
                            </select>
                        </div>

                        {/* Owner */}
                        <div className="filter-group">
                            <label className="filter-label">Owner</label>
                            <select
                                className="filter-input"
                                value={filters.responsableId}
                                onChange={(e) => handleChange("responsableId", e.target.value)}
                            >
                                <option value="">All owners</option>
                                {filterOptions?.users.map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Feasibility */}
                        <div className="filter-group">
                            <label className="filter-label">Feasibility</label>
                            <select
                                className="filter-input"
                                value={filters.faisabilite}
                                onChange={(e) => handleChange("faisabilite", e.target.value)}
                            >
                                <option value="">All</option>
                                <option value="OUI">Yes</option>
                                <option value="NON">No</option>
                                <option value="EN_COURS">In progress (OG)</option>
                                <option value="A_CLARIFIER">Needs clarification (NC)</option>
                            </select>
                        </div>
                    </div>

                    <div className="dashboard-filters-actions">
                        <button className="btn btn-primary btn-sm" onClick={onApply} type="button">
                            <FiFilter size={14} />
                            Apply
                        </button>
                        {activeCount > 0 && (
                            <button className="btn btn-outline btn-sm" onClick={handleReset} type="button">
                                <FiX size={14} />
                                Reset
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

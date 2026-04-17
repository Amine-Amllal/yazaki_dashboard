"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import DashboardFilters, { FilterOptions, FilterValues } from "@/components/DashboardFilters";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiTrendingUp, FiUsers } from "react-icons/fi";

type ResponsiblePerformance = {
    responsableId: string;
    name: string;
    matricule: string;
    fonction: string;
    totalDFC: number;
    openDFC: number;
    closedDFC: number;
    inProgressDFC: number;
    treatedCount: number;
    tauxFaisabilite: number;
    responseRate: number;
    delaiMoyen: number;
    performanceScore: number;
    difficulty: "OK" | "WARNING" | "CRITICAL";
};

type StatsPayload = {
    totalDFC: number;
    dfcOuverts: number;
    dfcFermes: number;
    delaiMoyen: number;
    filterOptions: FilterOptions;
    responsablesPerformance: ResponsiblePerformance[];
};

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

const difficultyColors = ["#06d6a0", "#ffd166", "#ef476f"];

export default function AdminResponsiblePerformancePage() {
    const [stats, setStats] = useState<StatsPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<FilterValues>({ ...emptyFilters });
    const [sortBy, setSortBy] = useState("performanceScore");
    const [order, setOrder] = useState<"asc" | "desc">("desc");

    const fetchStats = useCallback((appliedFilters: FilterValues, currentSortBy: string, currentOrder: "asc" | "desc") => {
        setLoading(true);
        const params = new URLSearchParams();

        Object.entries(appliedFilters).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });

        params.set("sortBy", currentSortBy);
        params.set("order", currentOrder);

        fetch(`/api/stats?${params.toString()}`)
            .then((r) => r.json())
            .then((data) => {
                setStats(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchStats(filters, sortBy, order);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleApply = () => {
        fetchStats(filters, sortBy, order);
    };

    const rankingData = useMemo(() => stats?.responsablesPerformance || [], [stats]);

    const summary = useMemo(() => {
        const critical = rankingData.filter((item) => item.difficulty === "CRITICAL").length;
        const warning = rankingData.filter((item) => item.difficulty === "WARNING").length;
        const best = rankingData[0];

        return {
            responsibleCount: rankingData.length,
            critical,
            warning,
            bestName: best?.name || "N/A",
            bestScore: best?.performanceScore || 0,
        };
    }, [rankingData]);

    const chartData = useMemo(() => rankingData.slice(0, 10).map((item) => ({
        ...item,
        shortName: item.name.length > 14 ? `${item.name.slice(0, 14)}...` : item.name,
    })), [rankingData]);

    const difficultyData = useMemo(() => {
        const ok = rankingData.filter((item) => item.difficulty === "OK").length;
        const warning = rankingData.filter((item) => item.difficulty === "WARNING").length;
        const critical = rankingData.filter((item) => item.difficulty === "CRITICAL").length;

        return [
            { name: "OK", count: ok },
            { name: "Warning", count: warning },
            { name: "Critical", count: critical },
        ];
    }, [rankingData]);

    const badgeClass = (difficulty: ResponsiblePerformance["difficulty"]) => {
        if (difficulty === "CRITICAL") return "badge-danger";
        if (difficulty === "WARNING") return "badge-warning";
        return "badge-success";
    };

    if (loading || !stats) {
        return (
            <>
                <Header title="Responsible performance" subtitle="KPI and ranking" />
                <div className="page-content">
                    <div className="stats-grid">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="stat-card">
                                <div className="skeleton" style={{ height: 60 }} />
                            </div>
                        ))}
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Header title="Responsible performance" subtitle="Compare KPI by owner" />
            <div className="page-content animate-in">
                <DashboardFilters
                    filters={filters}
                    filterOptions={stats.filterOptions}
                    onFilterChange={setFilters}
                    onApply={handleApply}
                />

                <div className="filters-bar" style={{ marginBottom: 20 }}>
                    <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="performanceScore">Sort by score</option>
                        <option value="treatedCount">Sort by treated DFC</option>
                        <option value="tauxFaisabilite">Sort by feasibility rate</option>
                        <option value="responseRate">Sort by response rate</option>
                        <option value="delaiMoyen">Sort by average lead time</option>
                        <option value="openDFC">Sort by open DFC</option>
                    </select>
                    <select className="filter-select" value={order} onChange={(e) => setOrder(e.target.value as "asc" | "desc")}>
                        <option value="desc">Descending</option>
                        <option value="asc">Ascending</option>
                    </select>
                    <button className="btn btn-primary" type="button" onClick={() => fetchStats(filters, sortBy, order)}>
                        Apply ranking
                    </button>
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-card-icon blue"><FiUsers /></div>
                        </div>
                        <div className="stat-card-label">Responsible count</div>
                        <div className="stat-card-value">{summary.responsibleCount}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-card-icon red"><FiAlertTriangle /></div>
                        </div>
                        <div className="stat-card-label">Critical profiles</div>
                        <div className="stat-card-value">{summary.critical}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-card-icon orange"><FiClock /></div>
                        </div>
                        <div className="stat-card-label">Warning profiles</div>
                        <div className="stat-card-value">{summary.warning}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-card-icon green"><FiCheckCircle /></div>
                        </div>
                        <div className="stat-card-label">Top performer</div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{summary.bestName}</div>
                        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>Score: {summary.bestScore}</div>
                    </div>
                </div>

                <div className="charts-grid">
                    <div className="chart-card">
                        <div className="chart-card-header">
                            <h3 className="chart-card-title">Response vs Feasibility rates</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="shortName" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="responseRate" fill="#118ab2" name="Response rate %" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="tauxFaisabilite" fill="#06d6a0" name="Feasibility rate %" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="chart-card">
                        <div className="chart-card-header">
                            <h3 className="chart-card-title">Average lead time by responsible</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="shortName" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="delaiMoyen" name="Lead time (days)" radius={[6, 6, 0, 0]}>
                                    {chartData.map((entry) => (
                                        <Cell
                                            key={entry.responsableId}
                                            fill={entry.difficulty === "CRITICAL" ? "#ef476f" : entry.difficulty === "WARNING" ? "#ffd166" : "#06d6a0"}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="chart-card">
                        <div className="chart-card-header">
                            <h3 className="chart-card-title">Difficulty distribution</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={320}>
                            <PieChart>
                                <Pie data={difficultyData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={110} label>
                                    {difficultyData.map((_, i) => (
                                        <Cell key={i} fill={difficultyColors[i % difficultyColors.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="table-card">
                    <div className="table-header">
                        <h3 className="table-title">Responsible ranking</h3>
                    </div>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Responsible</th>
                                    <th>Open</th>
                                    <th>Closed</th>
                                    <th>In progress</th>
                                    <th>Treated</th>
                                    <th>Feasibility %</th>
                                    <th>Response %</th>
                                    <th>Lead time</th>
                                    <th>Score</th>
                                    <th>Difficulty</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rankingData.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} style={{ textAlign: "center", padding: 32 }}>
                                            No data for the selected filters
                                        </td>
                                    </tr>
                                ) : (
                                    rankingData.map((item, index) => (
                                        <tr key={item.responsableId}>
                                            <td><strong>#{index + 1}</strong></td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{item.name}</div>
                                                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{item.matricule} • {item.fonction}</div>
                                            </td>
                                            <td>{item.openDFC}</td>
                                            <td>{item.closedDFC}</td>
                                            <td>{item.inProgressDFC}</td>
                                            <td>{item.treatedCount}</td>
                                            <td>{item.tauxFaisabilite}%</td>
                                            <td>{item.responseRate}%</td>
                                            <td>{item.delaiMoyen} d</td>
                                            <td>{item.performanceScore}</td>
                                            <td>
                                                <span className={`badge ${badgeClass(item.difficulty)}`}>
                                                    {item.difficulty}
                                                </span>
                                            </td>
                                            <td>
                                                <Link href={`/dfc?assignedToId=${item.responsableId}`} className="btn btn-secondary btn-sm">
                                                    View DFCs
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="stats-grid" style={{ marginTop: 20 }}>
                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-card-icon blue"><FiTrendingUp /></div>
                        </div>
                        <div className="stat-card-label">Global response rate</div>
                        <div className="stat-card-value">
                            {stats.totalDFC > 0 ? Math.round((stats.dfcFermes / stats.totalDFC) * 100) : 0}%
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-card-icon orange"><FiClock /></div>
                        </div>
                        <div className="stat-card-label">Global average lead time</div>
                        <div className="stat-card-value">{stats.delaiMoyen} days</div>
                    </div>
                </div>
            </div>
        </>
    );
}

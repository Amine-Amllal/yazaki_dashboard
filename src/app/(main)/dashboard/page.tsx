"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import DashboardFilters, { FilterValues, FilterOptions } from "@/components/DashboardFilters";
import { FiFileText, FiClock, FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { formatDate } from "@/lib/i18n/format";
import { faisabilityLabels } from "@/lib/i18n/messages";

const COLORS = ["#E60012", "#231F20", "#ff4d4d", "#4a4a4a", "#94a3b8"];
const FAIS_COLORS = ["#06d6a0", "#ef476f", "#ffd166", "#118ab2"];

interface Stats {
    totalDFC: number;
    dfcOuverts: number;
    dfcFermes: number;
    delaiMoyen: number;
    overdueCount: number;
    dfcByType: { name: string; count: number }[];
    dfcByProject: { name: string; count: number }[];
    dfcByFaisabilite: { name: string; count: number }[];
    monthlyData: { month: string; received: number; answered: number }[];
    recentDFCs: {
        id: string;
        numero: number;
        description: string;
        faisabilite: string;
        typeDFC: string;
        dateReception: string;
        project: { name: string };
        family: { name: string };
    }[];
    filterOptions: FilterOptions;
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

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<FilterValues>({ ...emptyFilters });

    const fetchStats = useCallback((appliedFilters: FilterValues) => {
        setLoading(true);
        const params = new URLSearchParams();
        Object.entries(appliedFilters).forEach(([key, value]) => {
            if (value) params.set(key, value);
        });
        fetch(`/api/stats?${params.toString()}`)
            .then((r) => r.json())
            .then((data) => {
                setStats(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchStats(filters);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleApply = () => fetchStats(filters);

    if (loading) {
        return (
            <>
                <Header title="Dashboard" subtitle="DFC overview" />
                <div className="page-content">
                    <div className="stats-grid">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="stat-card">
                                <div className="skeleton" style={{ height: 20, width: "60%", marginBottom: 12 }} />
                                <div className="skeleton" style={{ height: 40, width: "40%" }} />
                            </div>
                        ))}
                    </div>
                </div>
            </>
        );
    }

    if (!stats) return null;

    const faisabiliteLabel = (f: string) => faisabilityLabels[f] || f;

    const faisabiliteBadge = (f: string) =>
        f === "OUI" ? "badge-success" :
            f === "NON" ? "badge-danger" :
                f === "EN_COURS" ? "badge-warning" : "badge-info";

    return (
        <>
            <Header title="Dashboard" subtitle="DFC overview" />
            <div className="page-content animate-in">
                {/* Advanced Filters */}
                <DashboardFilters
                    filters={filters}
                    filterOptions={stats.filterOptions}
                    onFilterChange={setFilters}
                    onApply={handleApply}
                />

                {/* KPI Cards */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-card-icon blue"><FiFileText /></div>
                        </div>
                        <div className="stat-card-label">Total DFC</div>
                        <div className="stat-card-value">{stats.totalDFC}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-card-icon orange"><FiClock /></div>
                        </div>
                        <div className="stat-card-label">Open DFCs</div>
                        <div className="stat-card-value">{stats.dfcOuverts}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-card-icon green"><FiCheckCircle /></div>
                        </div>
                        <div className="stat-card-label">Closed DFCs</div>
                        <div className="stat-card-value">{stats.dfcFermes}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-card-icon red"><FiAlertCircle /></div>
                        </div>
                        <div className="stat-card-label">Average lead time (days)</div>
                        <div className="stat-card-value">{stats.delaiMoyen}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-card-icon red"><FiAlertCircle /></div>
                        </div>
                        <div className="stat-card-label">Overdue DFCs</div>
                        <div className="stat-card-value">{stats.overdueCount}</div>
                    </div>
                </div>

                {/* Charts */}
                <div className="charts-grid">
                    {/* Monthly Trend */}
                    <div className="chart-card">
                        <div className="chart-card-header">
                            <h3 className="chart-card-title">Monthly trend</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={stats.monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="received" stroke="#E60012" strokeWidth={2} dot={{ r: 4 }} name="Received" />
                                <Line type="monotone" dataKey="answered" stroke="#06d6a0" strokeWidth={2} dot={{ r: 4 }} name="Answered" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* DFC by Type */}
                    <div className="chart-card">
                        <div className="chart-card-header">
                            <h3 className="chart-card-title">DFCs by type</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie data={stats.dfcByType} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                    {stats.dfcByType.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* DFC by Project */}
                    <div className="chart-card">
                        <div className="chart-card-header">
                            <h3 className="chart-card-title">DFCs by project</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={stats.dfcByProject}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#E60012" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* DFC by feasibility */}
                    <div className="chart-card">
                        <div className="chart-card-header">
                            <h3 className="chart-card-title">Feasibility</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie data={stats.dfcByFaisabilite} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                    {stats.dfcByFaisabilite.map((_, i) => (
                                        <Cell key={i} fill={FAIS_COLORS[i % FAIS_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent DFCs */}
                <div className="table-card">
                    <div className="table-header">
                        <h3 className="table-title">Recent DFCs</h3>
                    </div>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>N°</th>
                                    <th>Description</th>
                                    <th>Project</th>
                                    <th>Type</th>
                                    <th>Feasibility</th>
                                    <th>Received date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.recentDFCs.map((dfc) => (
                                    <tr key={dfc.id}>
                                        <td><strong>{dfc.numero}</strong></td>
                                        <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {dfc.description}
                                        </td>
                                        <td>{dfc.project.name}</td>
                                        <td><span className="badge badge-neutral">{dfc.typeDFC}</span></td>
                                        <td>
                                            <span className={`badge ${faisabiliteBadge(dfc.faisabilite)}`}>
                                                {faisabiliteLabel(dfc.faisabilite)}
                                            </span>
                                        </td>
                                        <td>{formatDate(dfc.dateReception)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}

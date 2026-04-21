"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import DashboardFilters, { FilterValues, FilterOptions } from "@/components/DashboardFilters";
import { FiFileText, FiClock, FiCheckCircle, FiTrendingUp, FiUsers, FiAlertCircle } from "react-icons/fi";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const COLORS = ["#E60012", "#231F20", "#ff4d4d", "#4a4a4a", "#94a3b8"];

interface Stats {
    totalDFC: number;
    dfcOuverts: number;
    dfcFermes: number;
    delaiMoyen: number;
    overdueCount: number;
    overdueRenault: {
        id: string;
        numero: number;
        dateReception: string;
        overdueSince: string | null;
        project: { name: string };
        assignedTo: { prenom: string; nom: string; matricule: string } | null;
        createdBy: { prenom: string; nom: string; matricule: string };
    }[];
    dfcByType: { name: string; count: number }[];
    dfcByProject: { name: string; count: number }[];
    dfcByFaisabilite: { name: string; count: number }[];
    monthlyData: { month: string; received: number; answered: number }[];
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

export default function AdminDashboardPage() {
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
            .then((data) => { setStats(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchStats(filters);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleApply = () => fetchStats(filters);

    if (loading || !stats) {
        return (
            <>
                <Header title="Admin dashboard" subtitle="Global supervision" />
                <div className="page-content">
                    <div className="stats-grid">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="stat-card"><div className="skeleton" style={{ height: 60 }} /></div>
                        ))}
                    </div>
                </div>
            </>
        );
    }

    const tauxFaisabilite = stats.totalDFC > 0
        ? Math.round((stats.dfcByFaisabilite.find((f) => f.name === "Yes")?.count || 0) / stats.totalDFC * 100)
        : 0;

    return (
        <>
            <Header title="Admin dashboard" subtitle="Global and strategic overview" />
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
                        <div className="stat-card-label">Total DFCs received</div>
                        <div className="stat-card-value">{stats.totalDFC}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-header">
                            <div className="stat-card-icon green"><FiCheckCircle /></div>
                        </div>
                        <div className="stat-card-label">DFCs answered</div>
                        <div className="stat-card-value">{stats.dfcFermes}</div>
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
                            <div className="stat-card-icon blue"><FiTrendingUp /></div>
                        </div>
                        <div className="stat-card-label">Feasibility rate</div>
                        <div className="stat-card-value">{tauxFaisabilite}%</div>
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
                            <div className="stat-card-icon green"><FiUsers /></div>
                        </div>
                        <div className="stat-card-label">Response rate</div>
                        <div className="stat-card-value">
                            {stats.totalDFC > 0 ? Math.round(stats.dfcFermes / stats.totalDFC * 100) : 0}%
                        </div>
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
                    <div className="chart-card">
                        <div className="chart-card-header">
                            <h3 className="chart-card-title">Monthly DFC and ECO trend</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={stats.monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="received" stroke="#E60012" strokeWidth={2.5} dot={{ r: 5 }} name="DFCs received" />
                                <Line type="monotone" dataKey="answered" stroke="#06d6a0" strokeWidth={2.5} dot={{ r: 5 }} name="DFCs answered" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="chart-card">
                        <div className="chart-card-header">
                            <h3 className="chart-card-title">Distribution by type</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={stats.dfcByType} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={60} label paddingAngle={2}>
                                    {stats.dfcByType.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="chart-card">
                        <div className="chart-card-header">
                            <h3 className="chart-card-title">Distribution by project</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stats.dfcByProject}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="count" radius={[8, 8, 0, 0]} name="DFC count">
                                    {stats.dfcByProject.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="chart-card">
                        <div className="chart-card-header">
                            <h3 className="chart-card-title">Feasibility</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={stats.dfcByFaisabilite} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={60} label paddingAngle={2}>
                                    {stats.dfcByFaisabilite.map((_, i) => (
                                        <Cell key={i} fill={["#06d6a0", "#ef476f", "#ffd166", "#118ab2"][i % 4]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="table-card" style={{ marginTop: 20 }}>
                    <div className="table-header">
                        <h3 className="table-title">Renault overdue DFCs</h3>
                    </div>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>N°</th>
                                    <th>Project</th>
                                    <th>Received date</th>
                                    <th>Responsible</th>
                                    <th>Overdue since</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.overdueRenault.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: "center", padding: 24 }}>
                                            No Renault overdue DFCs
                                        </td>
                                    </tr>
                                ) : (
                                    stats.overdueRenault.map((item) => {
                                        const responsible = item.assignedTo
                                            ? `${item.assignedTo.prenom} ${item.assignedTo.nom}`
                                            : `${item.createdBy.prenom} ${item.createdBy.nom}`;

                                        return (
                                            <tr key={item.id}>
                                                <td><strong>{item.numero}</strong></td>
                                                <td>{item.project.name}</td>
                                                <td>{new Date(item.dateReception).toLocaleDateString()}</td>
                                                <td>{responsible}</td>
                                                <td>{item.overdueSince ? new Date(item.overdueSince).toLocaleDateString() : "-"}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}

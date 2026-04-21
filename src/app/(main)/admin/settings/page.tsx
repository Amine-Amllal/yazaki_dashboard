"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { useFeedback } from "@/components/ui/feedback-provider";
import { FiPlus, FiFolder, FiLayers, FiGrid, FiTrash2, FiMoreVertical, FiEdit2 } from "react-icons/fi";
import { formatDate } from "@/lib/i18n/format";

interface RefItem {
    id: string;
    name: string;
    createdAt: string;
}

interface RefData {
    projects: RefItem[];
    families: RefItem[];
    phases: RefItem[];
}

interface SlaRule {
    id: string;
    projectId: string;
    typeDFC: string | null;
    delayDays: number;
    active: boolean;
    project: { id: string; name: string };
}

export default function AdminSettingsPage() {
    const { notify, confirm, prompt } = useFeedback();
    const [data, setData] = useState<RefData>({ projects: [], families: [], phases: [] });
    const [loading, setLoading] = useState(true);
    const [newItem, setNewItem] = useState({ type: "", name: "" });
    const [saving, setSaving] = useState(false);
    const [openMenu, setOpenMenu] = useState<{ type: string, id: string } | null>(null);
    const [slaRules, setSlaRules] = useState<SlaRule[]>([]);
    const [slaForm, setSlaForm] = useState({ projectId: "", typeDFC: "", delayDays: "3", active: true });
    const [savingSla, setSavingSla] = useState(false);
    const [editingSlaId, setEditingSlaId] = useState<string | null>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenu(null);
        window.addEventListener("click", handleClickOutside);
        return () => window.removeEventListener("click", handleClickOutside);
    }, []);

    const fetchData = async () => {
        try {
            const [refRes, slaRes] = await Promise.all([
                fetch("/api/reference"),
                fetch("/api/sla-rules"),
            ]);

            const refData = await refRes.json();
            setData(refData);

            if (slaRes.ok) {
                const slaData = await slaRes.json();
                setSlaRules(Array.isArray(slaData.rules) ? slaData.rules : []);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleAdd = async (type: string) => {
        if (!newItem.name.trim()) return;
        setSaving(true);
        try {
            const res = await fetch("/api/reference", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, name: newItem.name }),
            });

            if (!res.ok) {
                const err = await res.json();
                notify.error(err.error || "An error occurred");
                return;
            }

            setNewItem({ type: "", name: "" });
            notify.success("Item added successfully");
            fetchData();
        } catch (error) {
            console.error(error);
            notify.error("Connection error");
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async (type: string, item: RefItem) => {
        const newName = await prompt({
            title: "Rename item",
            message: "Enter the new name:",
            defaultValue: item.name,
            confirmText: "Rename",
            cancelText: "Cancel",
        });
        if (!newName || newName.trim() === "" || newName === item.name) return;

        try {
            const res = await fetch("/api/reference", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, id: item.id, name: newName }),
            });

            if (!res.ok) {
                const err = await res.json();
                notify.error(err.error || "Failed to update item");
                return;
            }
            notify.success("Item updated successfully");
            fetchData();
        } catch {
            notify.error("Connection error");
        }
    };

    const handleDelete = async (type: string, id: string) => {
        const accepted = await confirm({
            title: "Delete item",
            message: "Are you sure you want to delete this item?",
            confirmText: "Delete",
            cancelText: "Cancel",
            danger: true,
        });
        if (!accepted) return;

        try {
            const res = await fetch(`/api/reference?type=${type}&id=${id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const err = await res.json();
                notify.error(err.error || "Failed to delete item");
                return;
            }
            notify.success("Item deleted successfully");
            fetchData();
        } catch {
            notify.error("Connection error");
        }
    };

    const handleSaveSlaRule = async () => {
        if (!slaForm.projectId) {
            notify.error("Project is required");
            return;
        }

        const delayDays = Number(slaForm.delayDays);
        if (!Number.isInteger(delayDays) || delayDays < 1 || delayDays > 30) {
            notify.error("Delay must be an integer between 1 and 30");
            return;
        }

        setSavingSla(true);
        try {
            const res = await fetch("/api/sla-rules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: editingSlaId || undefined,
                    projectId: slaForm.projectId,
                    typeDFC: slaForm.typeDFC || null,
                    delayDays,
                    active: slaForm.active,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                notify.error(err.error || "Failed to save SLA rule");
                return;
            }

            notify.success(editingSlaId ? "SLA rule updated" : "SLA rule saved");
            await fetchData();
            setEditingSlaId(null);
            setSlaForm({ projectId: "", typeDFC: "", delayDays: "3", active: true });
        } catch {
            notify.error("Connection error");
        } finally {
            setSavingSla(false);
        }
    };

    const handleDeleteSlaRule = async (rule: SlaRule) => {
        const accepted = await confirm({
            title: "Delete SLA rule",
            message: `Delete SLA rule for ${rule.project.name} (${rule.typeDFC || "All types"})?`,
            confirmText: "Delete",
            cancelText: "Cancel",
            danger: true,
        });
        if (!accepted) return;

        try {
            const res = await fetch(`/api/sla-rules?id=${rule.id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const err = await res.json();
                notify.error(err.error || "Failed to delete SLA rule");
                return;
            }

            if (editingSlaId === rule.id) {
                setEditingSlaId(null);
                setSlaForm({ projectId: "", typeDFC: "", delayDays: "3", active: true });
            }

            notify.success("SLA rule deleted");
            await fetchData();
        } catch {
            notify.error("Connection error");
        }
    };

    const sections = [
        { key: "project", title: "Projects", icon: <FiFolder />, items: data.projects },
        { key: "family", title: "Product families", icon: <FiLayers />, items: data.families },
        { key: "phase", title: "Phases", icon: <FiGrid />, items: data.phases },
    ];

    return (
        <>
            <Header title="Reference data" subtitle="Manage reference lists" />
            <div className="page-content animate-in">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
                    {sections.map((section) => (
                        <div key={section.key} className="form-card">
                            <h3 className="form-card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                {section.icon} {section.title}
                                <span className="badge badge-neutral" style={{ marginLeft: "auto" }}>{section.items.length}</span>
                            </h3>

                            {/* Add new item */}
                            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder={`Add a ${section.title.toLowerCase().slice(0, -1)}...`}
                                    value={newItem.type === section.key ? newItem.name : ""}
                                    onFocus={() => setNewItem((p) => ({ ...p, type: section.key }))}
                                    onChange={(e) => setNewItem({ type: section.key, name: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleAdd(section.key);
                                    }}
                                />
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleAdd(section.key)}
                                    disabled={saving || newItem.type !== section.key || !newItem.name.trim()}
                                >
                                    <FiPlus />
                                </button>
                            </div>

                            {/* Item list */}
                            <div style={{ maxHeight: 300, overflowY: "auto" }}>
                                {loading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <div key={i} className="skeleton" style={{ height: 36, marginBottom: 4 }} />
                                    ))
                                ) : section.items.length === 0 ? (
                                    <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 16 }}>
                                        No items
                                    </p>
                                ) : (
                                    section.items.map((item) => (
                                        <div
                                            key={item.id}
                                            style={{
                                                padding: "10px 12px",
                                                borderBottom: "1px solid var(--border-light)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                fontSize: 14,
                                            }}
                                        >
                                            <span style={{ fontWeight: 500 }}>{item.name}</span>
                                            <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 10 }}>
                                                {formatDate(item.createdAt)}
                                            </span>

                                            {/* Menu Trigger */}
                                            <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    className="btn btn-icon btn-secondary"
                                                    style={{ width: 28, height: 28, fontSize: 16, border: "none", background: "transparent" }}
                                                    onClick={() => setOpenMenu(openMenu?.id === item.id ? null : { type: section.key, id: item.id })}
                                                >
                                                    <FiMoreVertical />
                                                </button>

                                                {/* Dropdown Menu */}
                                                {openMenu?.id === item.id && openMenu?.type === section.key && (
                                                    <div style={{
                                                        position: "absolute",
                                                        right: 0,
                                                        top: "100%",
                                                        background: "var(--bg-card)",
                                                        border: "1px solid var(--border)",
                                                        borderRadius: "var(--radius)",
                                                        boxShadow: "var(--shadow-lg)",
                                                        zIndex: 10,
                                                        minWidth: 120,
                                                        overflow: "hidden"
                                                    }}>
                                                        <button
                                                            style={{
                                                                width: "100%",
                                                                textAlign: "left",
                                                                padding: "8px 12px",
                                                                background: "none",
                                                                border: "none",
                                                                cursor: "pointer",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: 8,
                                                                fontSize: 13,
                                                                color: "var(--text)"
                                                            }}
                                                            className=""
                                                            onClick={() => {
                                                                setOpenMenu(null);
                                                                handleEdit(section.key, item);
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = "var(--primary-50)"}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                                                        >
                                                            <FiEdit2 size={13} /> Edit
                                                        </button>
                                                        <button
                                                            style={{
                                                                width: "100%",
                                                                textAlign: "left",
                                                                padding: "8px 12px",
                                                                background: "none",
                                                                border: "none",
                                                                cursor: "pointer",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: 8,
                                                                fontSize: 13,
                                                                color: "var(--danger)"
                                                            }}
                                                            onClick={() => {
                                                                setOpenMenu(null);
                                                                handleDelete(section.key, item.id);
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = "var(--danger-bg)"}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                                                        >
                                                            <FiTrash2 size={13} /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="form-card" style={{ marginTop: 20 }}>
                    <h3 className="form-card-title">SLA rules by project</h3>
                    {editingSlaId && (
                        <div style={{ marginBottom: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                            Editing rule. Click Save to update or Cancel to discard.
                        </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "end", marginBottom: 16 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Project</label>
                            <select
                                className="form-select"
                                value={slaForm.projectId}
                                onChange={(e) => setSlaForm((prev) => ({ ...prev, projectId: e.target.value }))}
                            >
                                <option value="">Select a project</option>
                                {data.projects.map((project) => (
                                    <option key={project.id} value={project.id}>{project.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">DFC type</label>
                            <select
                                className="form-select"
                                value={slaForm.typeDFC}
                                onChange={(e) => setSlaForm((prev) => ({ ...prev, typeDFC: e.target.value }))}
                            >
                                <option value="">All types</option>
                                <option value="T1">T1</option>
                                <option value="T2">T2</option>
                                <option value="T3">T3</option>
                                <option value="MISTAKED">Mistaked</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Delay (days)</label>
                            <input
                                type="number"
                                min={1}
                                max={30}
                                className="form-input"
                                value={slaForm.delayDays}
                                onChange={(e) => setSlaForm((prev) => ({ ...prev, delayDays: e.target.value }))}
                            />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            {editingSlaId && (
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setEditingSlaId(null);
                                        setSlaForm({ projectId: "", typeDFC: "", delayDays: "3", active: true });
                                    }}
                                    disabled={savingSla}
                                    type="button"
                                >
                                    Cancel
                                </button>
                            )}
                            <button className="btn btn-primary" onClick={handleSaveSlaRule} disabled={savingSla} type="button">
                                {savingSla ? "Saving..." : editingSlaId ? "Update" : "Save"}
                            </button>
                        </div>
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                        <input
                            type="checkbox"
                            checked={slaForm.active}
                            onChange={(e) => setSlaForm((prev) => ({ ...prev, active: e.target.checked }))}
                        />
                        <span style={{ fontSize: 14 }}>Rule active</span>
                    </label>

                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Project</th>
                                    <th>DFC type</th>
                                    <th>Delay (days)</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {slaRules.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: "center", padding: 18 }}>
                                            No SLA rules configured
                                        </td>
                                    </tr>
                                ) : (
                                    slaRules.map((rule) => (
                                        <tr key={rule.id}>
                                            <td>{rule.project.name}</td>
                                            <td>{rule.typeDFC || "All"}</td>
                                            <td>{rule.delayDays}</td>
                                            <td>
                                                <span className={`badge ${rule.active ? "badge-success" : "badge-neutral"}`}>
                                                    {rule.active ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", gap: 8 }}>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingSlaId(rule.id);
                                                            setSlaForm({
                                                                projectId: rule.projectId,
                                                                typeDFC: rule.typeDFC || "",
                                                                delayDays: String(rule.delayDays),
                                                                active: rule.active,
                                                            });
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        type="button"
                                                        onClick={() => handleDeleteSlaRule(rule)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
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

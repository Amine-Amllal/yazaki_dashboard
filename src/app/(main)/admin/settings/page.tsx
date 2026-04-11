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

export default function AdminSettingsPage() {
    const { notify, confirm, prompt } = useFeedback();
    const [data, setData] = useState<RefData>({ projects: [], families: [], phases: [] });
    const [loading, setLoading] = useState(true);
    const [newItem, setNewItem] = useState({ type: "", name: "" });
    const [saving, setSaving] = useState(false);
    const [openMenu, setOpenMenu] = useState<{ type: string, id: string } | null>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenu(null);
        window.addEventListener("click", handleClickOutside);
        return () => window.removeEventListener("click", handleClickOutside);
    }, []);

    const fetchData = async () => {
        const res = await fetch("/api/reference");
        const d = await res.json();
        setData(d);
        setLoading(false);
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
            </div>
        </>
    );
}

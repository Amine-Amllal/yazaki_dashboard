"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useFeedback } from "@/components/ui/feedback-provider";
import { FiPlus, FiEdit, FiUserX, FiUserCheck, FiSearch, FiKey, FiClock, FiUser } from "react-icons/fi";

interface User {
    id: string;
    matricule: string;
    nom: string;
    prenom: string;
    email: string;
    fonction: string;
    role: string;
    active: boolean;
    image: string | null;
    createdAt: string;
}

export default function AdminUsersPage() {
    const router = useRouter();
    const { notify, prompt } = useFeedback();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [fonctionFilter, setFonctionFilter] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [statutFilter, setStatutFilter] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        matricule: "",
        nom: "",
        prenom: "",
        email: "",
        password: "",
        fonction: "PP_RESPONSIBLE",
        role: "USER",
    });

    const fetchUsers = async () => {
        const res = await fetch("/api/users");
        const data = await res.json();
        setUsers(data);
        setLoading(false);
    };

    useEffect(() => { fetchUsers(); }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    };

    const openCreate = () => {
        setEditingUser(null);
        setForm({ matricule: "", nom: "", prenom: "", email: "", password: "", fonction: "PP_RESPONSIBLE", role: "USER" });
        setShowModal(true);
    };

    const openEdit = (user: User) => {
        setEditingUser(user);
        setForm({
            matricule: user.matricule,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            password: "",
            fonction: user.fonction,
            role: user.role,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editingUser) {
                const body: Record<string, unknown> = { ...form };
                if (!form.password) delete body.password;
                const res = await fetch(`/api/users/${editingUser.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const err = await res.json();
                    notify.error(err.error || "Failed to update user");
                    return;
                }
                notify.success("User updated successfully");
            } else {
                const res = await fetch("/api/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form),
                });
                if (!res.ok) {
                    const err = await res.json();
                    notify.error(err.error || "Failed to create user");
                    return;
                }
                notify.success("User created successfully");
            }
            setShowModal(false);
            fetchUsers();
        } catch {
            notify.error("Connection error");
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (user: User) => {
        try {
            const res = await fetch(`/api/users/${user.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: !user.active }),
            });
            if (!res.ok) {
                const err = await res.json();
                notify.error(err.error || "Failed to change status");
                return;
            }
            notify.success(user.active ? "User deactivated" : "User reactivated");
            fetchUsers();
        } catch {
            notify.error("Connection error");
        }
    };

    const resetPassword = async (userId: string) => {
        const newPwd = await prompt({
            title: "Reset password",
            message: "Enter the new password:",
            placeholder: "New password",
            confirmText: "Reset",
            cancelText: "Cancel",
        });
        if (!newPwd) return;
        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: newPwd }),
            });
            if (!res.ok) {
                const err = await res.json();
                notify.error(err.error || "Failed to reset password");
                return;
            }
            notify.success("Password reset successfully");
        } catch {
            notify.error("Connection error");
        }
    };

    const fonctionLabel = (f: string) =>
        f === "PP_RESPONSIBLE" ? "PP Responsible" :
            f === "PP_TECHNICIAN" ? "PP Technician" : "PP Coordinator";

    const filteredUsers = users.filter((u) => {
        const matchSearch = !search || u.nom.toLowerCase().includes(search.toLowerCase()) ||
            u.prenom.toLowerCase().includes(search.toLowerCase()) ||
            u.matricule.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase());
        const matchFonction = !fonctionFilter || u.fonction === fonctionFilter;
        const matchRole = !roleFilter || u.role === roleFilter;
        const matchStatut = !statutFilter ||
            (statutFilter === "active" && u.active) ||
            (statutFilter === "inactive" && !u.active);
        return matchSearch && matchFonction && matchRole && matchStatut;
    });

    return (
        <>
            <Header title="User management" subtitle={`${users.length} users`} />
            <div className="page-content animate-in">
                <div className="filters-bar">
                    <div className="search-input">
                        <FiSearch />
                        <input
                            type="text"
                            placeholder="Search by name, employee ID, email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select className="filter-select" value={fonctionFilter} onChange={(e) => setFonctionFilter(e.target.value)}>
                        <option value="">All functions</option>
                        <option value="PP_RESPONSIBLE">PP Responsible</option>
                        <option value="PP_TECHNICIAN">PP Technician</option>
                        <option value="PP_COORDINATOR">PP Coordinator</option>
                    </select>
                    <select className="filter-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                        <option value="">All roles</option>
                        <option value="USER">User</option>
                        <option value="ADMIN">Administrator</option>
                    </select>
                    <select className="filter-select" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
                        <option value="">All statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <button className="btn btn-primary" onClick={openCreate}>
                        <FiPlus /> New user
                    </button>
                </div>

                <div className="table-card">
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Employee ID</th>
                                    <th>User</th>
                                    <th>Email</th>
                                    <th>Function</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <tr key={i}>
                                            {Array.from({ length: 7 }).map((_, j) => (
                                                <td key={j}><div className="skeleton" style={{ height: 16, width: "80%" }} /></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: "center", padding: 40 }}>No user found</td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <tr key={user.id}>
                                            <td><strong>{user.matricule}</strong></td>
                                            <td>
                                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                    <div style={{
                                                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                                                        background: user.image ? `url(${user.image}) center/cover` : "var(--primary-100)",
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        fontSize: 16, color: "var(--primary)",
                                                        border: "1px solid var(--border)"
                                                    }}>
                                                        {!user.image && <FiUser />}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>{user.nom}</div>
                                                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{user.prenom}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{user.email}</td>
                                            <td>{fonctionLabel(user.fonction)}</td>
                                            <td>
                                                <span className={`badge ${user.role === "ADMIN" ? "badge-info" : "badge-neutral"}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge ${user.active ? "badge-success" : "badge-danger"}`}>
                                                    {user.active ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", gap: 4 }}>
                                                    <button className="btn btn-secondary btn-sm btn-icon" title="Edit" onClick={() => openEdit(user)}>
                                                        <FiEdit />
                                                    </button>
                                                    <button className="btn btn-secondary btn-sm btn-icon" title={user.active ? "Deactivate" : "Reactivate"} onClick={() => toggleActive(user)}>
                                                        {user.active ? <FiUserX /> : <FiUserCheck />}
                                                    </button>
                                                    <button className="btn btn-secondary btn-sm btn-icon" title="Reset password" onClick={() => resetPassword(user.id)}>
                                                        <FiKey />
                                                    </button>
                                                    <button className="btn btn-secondary btn-sm btn-icon" title="History" onClick={() => router.push(`/admin/users/${user.id}/history`)}>
                                                        <FiClock />
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

                {/* Modal */}
                {showModal && (
                    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
                        <div className="modal-content">
                            <div className="modal-header">
                                <h3 className="modal-title">{editingUser ? "Edit user" : "New user"}</h3>
                                <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Employee ID</label>
                                <input type="text" name="matricule" className="form-input" value={form.matricule} onChange={handleChange} required />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">Last name</label>
                                    <input type="text" name="nom" className="form-input" value={form.nom} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">First name</label>
                                    <input type="text" name="prenom" className="form-input" value={form.prenom} onChange={handleChange} required />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input type="email" name="email" className="form-input" value={form.email} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{editingUser ? "New password (leave empty to keep current)" : "Password"}</label>
                                <input type="password" name="password" className="form-input" value={form.password} onChange={handleChange} required={!editingUser} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">Fonction</label>
                                    <select name="fonction" className="form-select" value={form.fonction} onChange={handleChange}>
                                        <option value="PP_RESPONSIBLE">PP Responsible</option>
                                        <option value="PP_TECHNICIAN">PP Technician</option>
                                        <option value="PP_COORDINATOR">PP Coordinator</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Role</label>
                                    <select name="role" className="form-select" value={form.role} onChange={handleChange}>
                                        <option value="USER">User</option>
                                        <option value="ADMIN">Administrator</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-actions">
                                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                    {saving ? <><span className="loading-spinner" /> Saving...</> : editingUser ? "Update" : "Create"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

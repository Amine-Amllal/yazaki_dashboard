"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
    FiHome,
    FiFileText,
    FiPlusCircle,
    FiUsers,
    FiSettings,
    FiBarChart2,
    FiLogOut,
    FiDatabase,
    FiChevronLeft,
    FiChevronRight,
    FiClock,
} from "react-icons/fi";

export interface SidebarProps {
    collapsed: boolean;
    toggle: () => void;
}

export default function Sidebar({ collapsed, toggle }: SidebarProps) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const isAdmin = session?.user?.role === "ADMIN";

    const userLinks = [
        { href: "/dashboard", label: "Dashboard", icon: <FiHome /> },
        { href: "/dfc", label: "Liste des DFC", icon: <FiFileText /> },
        { href: "/dfc/new", label: "Nouveau DFC", icon: <FiPlusCircle /> },
    ];

    const adminLinks = [
        { href: "/admin/dashboard", label: "Dashboard Admin", icon: <FiBarChart2 /> },
        { href: "/admin/users", label: "Utilisateurs", icon: <FiUsers /> },
        { href: "/admin/settings", label: "Données de référence", icon: <FiDatabase /> },
        { href: "/admin/history", label: "Historique Global", icon: <FiClock /> },
    ];

    return (
        <aside
            className="sidebar"
            style={{
                width: collapsed ? 80 : 260,
                transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                overflowX: "hidden",
            }}
        >
            <div className="sidebar-header" style={{ padding: collapsed ? "16px 8px" : "24px", justifyContent: collapsed ? "center" : "flex-start" }}>
                {collapsed ? (
                    <img
                        src="/yazaki-icon.svg"
                        alt="Yazaki"
                        style={{ width: 34, height: 'auto' }}
                    />
                ) : (
                    <img
                        src="/yazaki-logo-white.svg"
                        alt="Yazaki"
                        style={{ height: 32, width: 'auto', minWidth: 120 }}
                    />
                )}
            </div>

            <nav className="sidebar-nav" style={{ padding: "0 12px" }}>
                {!collapsed && <div className="sidebar-section-title">Navigation</div>}

                {userLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`sidebar-link ${pathname === link.href ? "active" : ""}`}
                        style={{ justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? "12px 0" : "12px 16px" }}
                        title={collapsed ? link.label : ""}
                    >
                        <span style={{ fontSize: 20 }}>{link.icon}</span>
                        {!collapsed && <span style={{ marginLeft: 12 }}>{link.label}</span>}
                    </Link>
                ))}

                {isAdmin && (
                    <>
                        {!collapsed && (
                            <div className="sidebar-section-title" style={{ marginTop: 16 }}>
                                Administration
                            </div>
                        )}
                        {collapsed && <div style={{ height: 16 }} />}

                        {adminLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`sidebar-link ${pathname === link.href ? "active" : ""}`}
                                style={{ justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? "12px 0" : "12px 16px" }}
                                title={collapsed ? link.label : ""}
                            >
                                <span style={{ fontSize: 20 }}>{link.icon}</span>
                                {!collapsed && <span style={{ marginLeft: 12 }}>{link.label}</span>}
                            </Link>
                        ))}
                    </>
                )}
            </nav>

            <div className="sidebar-footer" style={{ padding: "16px 12px" }}>
                {/* Toggle Button */}
                <button
                    onClick={toggle}
                    className="sidebar-link"
                    style={{
                        width: "100%", border: "none", background: "rgba(255,255,255,0.05)",
                        cursor: "pointer", justifyContent: "center", marginBottom: 8
                    }}
                >
                    {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
                    {!collapsed && <span style={{ marginLeft: 12 }}>Réduire</span>}
                </button>

                <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="sidebar-link"
                    style={{ width: "100%", border: "none", background: "none", cursor: "pointer", justifyContent: collapsed ? "center" : "flex-start" }}
                    title={collapsed ? "Déconnexion" : ""}
                >
                    <span style={{ fontSize: 20 }}><FiLogOut /></span>
                    {!collapsed && <span style={{ marginLeft: 12 }}>Déconnexion</span>}
                </button>
            </div>
        </aside>
    );
}

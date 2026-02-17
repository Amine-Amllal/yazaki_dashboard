"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

interface HeaderProps {
    title: string;
    subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
    const { data: session } = useSession();
    const user = session?.user;
    const initials = user?.name
        ? user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
        : "?";

    return (
        <header className="header">
            <div className="header-left">
                <h1>{title}</h1>
                {subtitle && <p>{subtitle}</p>}
            </div>
            <div className="header-right">
                <Link href="/profile" style={{ textDecoration: "none" }}>
                    <div className="header-user">
                        {user?.image ? (
                            <img
                                src={user.image}
                                alt="Profile"
                                className="header-avatar"
                                style={{ objectFit: "cover" }}
                            />
                        ) : (
                            <div className="header-avatar">{initials}</div>
                        )}
                        <div className="header-user-info">
                            <div className="header-user-name">{user?.name || "Utilisateur"}</div>
                            <div className="header-user-role">
                                {(user as Record<string, unknown>)?.fonction === "PP_RESPONSIBLE"
                                    ? "PP Responsible"
                                    : (user as Record<string, unknown>)?.fonction === "PP_TECHNICIAN"
                                        ? "PP Technician"
                                        : (user as Record<string, unknown>)?.fonction === "PP_COORDINATOR"
                                            ? "PP Coordinator"
                                            : "Utilisateur"}
                            </div>
                        </div>
                    </div>
                </Link>
            </div>
        </header>
    );
}

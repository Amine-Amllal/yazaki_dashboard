"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface HeaderProps {
    title: string;
    subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
    const { data: session } = useSession();
    const user = session?.user;
    const [profileImage, setProfileImage] = useState<string | null>(null);

    // Charger l'image depuis l'API (pas depuis le JWT pour éviter HTTP 431)
    useEffect(() => {
        if (user) {
            fetch("/api/profile")
                .then((res) => res.json())
                .then((data) => {
                    if (data.image) setProfileImage(data.image);
                })
                .catch(() => {});
        }
    }, [user]);

    const initials = user?.name
        ? user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
        : "?";

    const fonctionLabel = (() => {
        const fonction = user?.fonction;
        if (fonction === "PP_RESPONSIBLE") return "PP Responsible";
        if (fonction === "PP_TECHNICIAN") return "PP Technician";
        if (fonction === "PP_COORDINATOR") return "PP Coordinator";
        return "User";
    })();

    return (
        <header className="header">
            <div className="header-left">
                <h1>{title}</h1>
                {subtitle && <p>{subtitle}</p>}
            </div>
            <div className="header-right">
                <Link href="/profile" style={{ textDecoration: "none" }}>
                    <div className="header-user">
                        {profileImage ? (
                            <img
                                src={profileImage}
                                alt="Profile"
                                className="header-avatar"
                                style={{ objectFit: "cover" }}
                            />
                        ) : (
                            <div className="header-avatar">{initials}</div>
                        )}
                        <div className="header-user-info">
                            <div className="header-user-name">{user?.name || "User"}</div>
                            <div className="header-user-role">
                                {fonctionLabel}
                            </div>
                        </div>
                    </div>
                </Link>
            </div>
        </header>
    );
}

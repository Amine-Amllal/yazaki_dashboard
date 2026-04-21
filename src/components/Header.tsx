"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { FiBell, FiCheck } from "react-icons/fi";

interface HeaderProps {
    title: string;
    subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
    const { data: session } = useSession();
    const user = session?.user;
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Array<{
        id: string;
        type: string;
        message: string;
        readAt: string | null;
        createdAt: string;
        dfcId: string | null;
        dfc: { numero: number } | null;
    }>>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const notificationRef = useRef<HTMLDivElement | null>(null);

    // Charger l'image depuis l'API (pas depuis le JWT pour éviter HTTP 431)
    useEffect(() => {
        if (user) {
            fetch("/api/profile")
                .then((res) => res.json())
                .then((data) => {
                    if (data.image) setProfileImage(data.image);
                })
                .catch(() => {});

            fetch("/api/notifications?limit=8")
                .then((res) => res.json())
                .then((data) => {
                    setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
                    setUnreadCount(Number(data.unreadCount) || 0);
                })
                .catch(() => {});
        }
    }, [user]);

    useEffect(() => {
        const onPointerDown = (event: MouseEvent) => {
            if (!notificationRef.current) return;
            if (!notificationRef.current.contains(event.target as Node)) {
                setNotificationsOpen(false);
            }
        };

        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, []);

    const markAsRead = async (id: string) => {
        await fetch(`/api/notifications/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ read: true }),
        });

        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
        setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    const markAllAsRead = async () => {
        const unread = notifications.filter((item) => !item.readAt);
        if (unread.length === 0) return;

        await Promise.all(
            unread.map((item) =>
                fetch(`/api/notifications/${item.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ read: true }),
                })
            )
        );

        const nowIso = new Date().toISOString();
        setNotifications((prev) => prev.map((item) => ({ ...item, readAt: nowIso })));
        setUnreadCount(0);
    };

    const formatNotificationDate = (value: string) => {
        const date = new Date(value);
        return new Intl.DateTimeFormat("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        }).format(date);
    };

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
                <div className="header-notifications" ref={notificationRef}>
                    <button
                        type="button"
                        className={`header-bell-btn ${notificationsOpen ? "active" : ""}`}
                        onClick={() => setNotificationsOpen((prev) => !prev)}
                        aria-label="Open notifications"
                        aria-expanded={notificationsOpen}
                    >
                        <FiBell />
                        {unreadCount > 0 && (
                            <span className="header-bell-count">
                                {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                        )}
                    </button>

                    {notificationsOpen && (
                        <div className="header-notifications-panel">
                            <div className="header-notifications-header">
                                <h4>Notifications</h4>
                                <button
                                    type="button"
                                    className="header-notifications-markall"
                                    onClick={markAllAsRead}
                                    disabled={unreadCount === 0}
                                >
                                    <FiCheck size={14} /> Mark all
                                </button>
                            </div>
                            {notifications.length === 0 ? (
                                <div className="header-notifications-empty">
                                    No notifications
                                </div>
                            ) : (
                                <div className="header-notifications-list">
                                    {notifications.map((item) => (
                                        <div
                                            key={item.id}
                                            className={`header-notification-item ${item.readAt ? "" : "unread"} ${item.type === "DFC_OVERDUE_OPEN" ? "type-overdue" : ""}`}
                                        >
                                            <div className="header-notification-message">{item.message}</div>
                                            <div className="header-notification-meta">
                                                <div className="header-notification-time">
                                                    {formatNotificationDate(item.createdAt)}
                                                </div>
                                                {!item.readAt && (
                                                    <button
                                                        type="button"
                                                        className="header-notification-action"
                                                        onClick={() => markAsRead(item.id)}
                                                    >
                                                        Mark read
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

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

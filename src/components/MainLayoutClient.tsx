"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";

export default function MainLayoutClient({
    children,
}: {
    children: React.ReactNode;
}) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="app-layout">
            <Sidebar collapsed={collapsed} toggle={() => setCollapsed(!collapsed)} />
            <main
                className="main-content"
                style={{
                    marginLeft: collapsed ? 80 : 260,
                    width: collapsed ? "calc(100% - 80px)" : "calc(100% - 260px)",
                    transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
            >
                {children}
            </main>
        </div>
    );
}

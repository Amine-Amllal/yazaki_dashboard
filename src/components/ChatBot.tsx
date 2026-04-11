"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    FiMessageSquare,
    FiX,
    FiSend,
    FiRotateCw,
    FiDatabase,
    FiCpu,
} from "react-icons/fi";
import { APP_LOCALE } from "@/lib/i18n/messages";

interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    sources?: string[];
    timestamp: Date;
}

const SUGGESTIONS = [
    "How many DFCs do we have in total?",
    "Which DFCs are still in feasibility review?",
    "Give me the full list of DFCs",
    "Which projects have the most DFCs?",
];

export default function ChatBot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "system",
            content:
                "Hello! I am the YECMS AI assistant. Ask me anything about DFCs, projects, or statistics.",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Scroll vers le bas automatiquement
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Focus input quand le chat s'ouvre
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    // Vérifier la connexion au service RAG
    const checkConnection = useCallback(async () => {
        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: "", healthCheck: true }),
            });
            setIsConnected(res.status !== 502 && res.status !== 503);
        } catch {
            setIsConnected(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen && isConnected === null) {
            checkConnection();
        }
    }, [isOpen, isConnected, checkConnection]);

    const sendMessage = async (text?: string) => {
        const question = (text || input).trim();
        if (!question || isLoading) return;

        const userMsg: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: question,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question }),
            });

            const data = await res.json();

            if (res.ok && data.answer) {
                const aiMsg: Message = {
                    id: `ai-${Date.now()}`,
                    role: "assistant",
                    content: data.answer,
                    sources: data.sources,
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, aiMsg]);
                setIsConnected(true);
            } else {
                const errMsg: Message = {
                    id: `err-${Date.now()}`,
                    role: "system",
                    content:
                        data.error ||
                        "An error occurred. Check that the RAG service is running.",
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, errMsg]);
                if (res.status >= 500) setIsConnected(false);
            }
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: `err-${Date.now()}`,
                    role: "system",
                    content:
                        "Unable to reach the AI service. Start the Flask server (python rag.py).",
                    timestamp: new Date(),
                },
            ]);
            setIsConnected(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setMessages([
            {
                id: "welcome",
                role: "system",
                content:
                    "Conversation cleared. Ask me a new question!",
                timestamp: new Date(),
            },
        ]);
    };

    const formatContent = (content: string) => {
        // Convertir les listes à puces markdown simples
        return content.split("\n").map((line, i) => {
            if (line.startsWith("- ") || line.startsWith("• ")) {
                return (
                    <div key={i} className="chatbot-list-item">
                        <span className="chatbot-bullet">•</span>
                        <span>{line.slice(2)}</span>
                    </div>
                );
            }
            if (line.startsWith("**") && line.endsWith("**")) {
                return (
                    <strong key={i} style={{ display: "block", marginTop: 4 }}>
                        {line.replace(/\*\*/g, "")}
                    </strong>
                );
            }
            if (line.trim() === "") return <br key={i} />;
            return <p key={i} style={{ margin: "2px 0" }}>{line}</p>;
        });
    };

    return (
        <>
            {/* Floating button */}
            <button
                className={`chatbot-fab ${isOpen ? "chatbot-fab-hidden" : ""}`}
                onClick={() => setIsOpen(true)}
                title="YECMS AI Assistant"
            >
                <FiMessageSquare size={22} />
                <span className="chatbot-fab-pulse" />
            </button>

            {/* Chat panel */}
            <div className={`chatbot-panel ${isOpen ? "chatbot-panel-open" : ""}`}>
                {/* Header */}
                <div className="chatbot-header">
                    <div className="chatbot-header-left">
                        <div className="chatbot-header-icon">
                            <FiCpu size={18} />
                        </div>
                        <div>
                            <div className="chatbot-header-title">
                                AI Assistant
                            </div>
                            <div className="chatbot-header-status">
                                <span
                                    className={`chatbot-status-dot ${
                                        isConnected === true
                                            ? "connected"
                                            : isConnected === false
                                            ? "disconnected"
                                            : "checking"
                                    }`}
                                />
                                {isConnected === true
                                    ? "Connected"
                                    : isConnected === false
                                    ? "Disconnected"
                                    : "Checking..."}
                            </div>
                        </div>
                    </div>
                    <div className="chatbot-header-actions">
                        <button
                            className="chatbot-header-btn"
                            onClick={clearChat}
                            title="Clear conversation"
                        >
                            <FiRotateCw size={14} />
                        </button>
                        <button
                            className="chatbot-header-btn"
                            onClick={() => setIsOpen(false)}
                            title="Close"
                        >
                            <FiX size={16} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="chatbot-messages">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`chatbot-msg chatbot-msg-${msg.role}`}
                        >
                            {msg.role === "assistant" && (
                                <div className="chatbot-msg-avatar">
                                    <FiCpu size={14} />
                                </div>
                            )}
                            <div className={`chatbot-msg-bubble chatbot-msg-bubble-${msg.role}`}>
                                <div className="chatbot-msg-content">
                                    {formatContent(msg.content)}
                                </div>
                                {msg.sources && msg.sources.length > 0 && (
                                    <div className="chatbot-msg-sources">
                                        <FiDatabase size={11} />
                                        <span>
                                            {msg.sources.length} source
                                            {msg.sources.length > 1 ? "s" : ""}{" "}
                                            checked
                                            {msg.sources.length > 1 ? "s" : ""}
                                        </span>
                                    </div>
                                )}
                                <div className="chatbot-msg-time">
                                    {msg.timestamp.toLocaleTimeString(APP_LOCALE, {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="chatbot-msg chatbot-msg-assistant">
                            <div className="chatbot-msg-avatar">
                                <FiCpu size={14} />
                            </div>
                            <div className="chatbot-msg-bubble chatbot-msg-bubble-assistant">
                                <div className="chatbot-typing">
                                    <span />
                                    <span />
                                    <span />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Suggestions */}
                {messages.length <= 1 && (
                    <div className="chatbot-suggestions">
                        {SUGGESTIONS.map((s, i) => (
                            <button
                                key={i}
                                className="chatbot-suggestion-btn"
                                onClick={() => sendMessage(s)}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input */}
                <div className="chatbot-input-area">
                    <input
                        ref={inputRef}
                        type="text"
                        className="chatbot-input"
                        placeholder="Ask your question..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                    />
                    <button
                        className="chatbot-send-btn"
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || isLoading}
                    >
                        <FiSend size={16} />
                    </button>
                </div>
            </div>

            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="chatbot-overlay"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}

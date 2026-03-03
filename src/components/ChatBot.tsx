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

interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    sources?: string[];
    timestamp: Date;
}

const SUGGESTIONS = [
    "Combien de DFC avons-nous au total ?",
    "Quels DFC sont en cours de faisabilité ?",
    "Donne-moi la liste de tous les DFC",
    "Quels projets ont le plus de DFC ?",
];

export default function ChatBot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "system",
            content:
                "Bonjour ! Je suis l'assistant IA de YECMS. Posez-moi une question sur les DFC, les projets, ou les statistiques.",
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
                        "Une erreur est survenue. Vérifiez que le service RAG est démarré.",
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
                        "Impossible de contacter le service IA. Démarrez le serveur Flask (python rag.py).",
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
                    "Conversation effacée. Posez-moi une nouvelle question !",
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
            {/* Bouton flottant */}
            <button
                className={`chatbot-fab ${isOpen ? "chatbot-fab-hidden" : ""}`}
                onClick={() => setIsOpen(true)}
                title="Assistant IA YECMS"
            >
                <FiMessageSquare size={22} />
                <span className="chatbot-fab-pulse" />
            </button>

            {/* Panneau de chat */}
            <div className={`chatbot-panel ${isOpen ? "chatbot-panel-open" : ""}`}>
                {/* Header */}
                <div className="chatbot-header">
                    <div className="chatbot-header-left">
                        <div className="chatbot-header-icon">
                            <FiCpu size={18} />
                        </div>
                        <div>
                            <div className="chatbot-header-title">
                                Assistant IA
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
                                    ? "Connecté"
                                    : isConnected === false
                                    ? "Déconnecté"
                                    : "Vérification..."}
                            </div>
                        </div>
                    </div>
                    <div className="chatbot-header-actions">
                        <button
                            className="chatbot-header-btn"
                            onClick={clearChat}
                            title="Effacer la conversation"
                        >
                            <FiRotateCw size={14} />
                        </button>
                        <button
                            className="chatbot-header-btn"
                            onClick={() => setIsOpen(false)}
                            title="Fermer"
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
                                            consultée
                                            {msg.sources.length > 1 ? "s" : ""}
                                        </span>
                                    </div>
                                )}
                                <div className="chatbot-msg-time">
                                    {msg.timestamp.toLocaleTimeString("fr-FR", {
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
                        placeholder="Posez votre question..."
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

            {/* Overlay mobile */}
            {isOpen && (
                <div
                    className="chatbot-overlay"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}

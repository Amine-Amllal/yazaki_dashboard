"use client";

import { useState, useRef, useCallback } from "react";
import { FiUpload, FiFile, FiCheckCircle, FiAlertCircle, FiX } from "react-icons/fi";

interface FileImportUploaderProps {
    onExtracted: (data: Record<string, string>) => void;
}

type UploadStatus = "idle" | "dragging" | "uploading" | "success" | "error";

export default function FileImportUploader({ onExtracted }: FileImportUploaderProps) {
    const [status, setStatus] = useState<UploadStatus>("idle");
    const [fileName, setFileName] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [extractPreview, setExtractPreview] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(async (file: File) => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!["pdf", "xlsx", "csv"].includes(ext || "")) {
            setStatus("error");
            setErrorMsg("Format non supporté. Utilisez PDF, XLSX ou CSV.");
            return;
        }

        setFileName(file.name);
        setStatus("uploading");
        setErrorMsg("");

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/dfc/import", {
                method: "POST",
                body: formData,
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || "Erreur inconnue");
            }

            setStatus("success");
            setExtractPreview(result.extractedText || "");
            onExtracted(result.data);
        } catch (err) {
            setStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "Erreur lors du traitement");
        }
    }, [onExtracted]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setStatus("idle");

        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setStatus("dragging");
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setStatus("idle");
    }, []);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const reset = () => {
        setStatus("idle");
        setFileName("");
        setErrorMsg("");
        setExtractPreview("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="form-card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 className="form-card-title">
                    <FiUpload style={{ marginRight: 8, verticalAlign: "middle" }} />
                    Méthode 2 : Import automatique
                </h3>
                {status !== "idle" && status !== "dragging" && (
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={reset}
                        style={{ fontSize: 12 }}
                    >
                        <FiX /> Réinitialiser
                    </button>
                )}
            </div>

            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                Glissez-déposez un fichier (PDF, Excel, CSV) pour pré-remplir le formulaire automatiquement.
            </p>

            <div
                className={`upload-zone ${status === "dragging" ? "upload-zone--dragover" : ""} ${status === "success" ? "upload-zone--success" : ""
                    } ${status === "error" ? "upload-zone--error" : ""}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => status !== "uploading" && fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xlsx,.csv"
                    onChange={handleInputChange}
                    style={{ display: "none" }}
                />

                {status === "uploading" ? (
                    <div className="upload-zone__content">
                        <span className="loading-spinner" style={{ width: 32, height: 32, marginBottom: 12 }} />
                        <p className="upload-zone__title">Analyse en cours...</p>
                        <p className="upload-zone__subtitle">
                            Extraction et analyse IA du fichier <strong>{fileName}</strong>
                        </p>
                    </div>
                ) : status === "success" ? (
                    <div className="upload-zone__content">
                        <FiCheckCircle size={32} style={{ color: "var(--success)", marginBottom: 12 }} />
                        <p className="upload-zone__title" style={{ color: "var(--success)" }}>
                            Extraction réussie !
                        </p>
                        <p className="upload-zone__subtitle">
                            <FiFile style={{ marginRight: 4 }} />
                            {fileName} — Le formulaire a été pré-rempli.
                        </p>
                    </div>
                ) : status === "error" ? (
                    <div className="upload-zone__content">
                        <FiAlertCircle size={32} style={{ color: "var(--danger)", marginBottom: 12 }} />
                        <p className="upload-zone__title" style={{ color: "var(--danger)" }}>
                            Erreur d&apos;extraction
                        </p>
                        <p className="upload-zone__subtitle">{errorMsg}</p>
                        <p className="upload-zone__hint">Cliquez pour réessayer avec un autre fichier</p>
                    </div>
                ) : (
                    <div className="upload-zone__content">
                        <FiUpload size={32} style={{ color: "var(--primary)", marginBottom: 12 }} />
                        <p className="upload-zone__title">
                            Glissez votre fichier ici ou cliquez pour parcourir
                        </p>
                        <p className="upload-zone__subtitle">PDF, XLSX, CSV — Max 10 Mo</p>
                    </div>
                )}
            </div>

            {status === "success" && (
                <div className="upload-notice">
                    <FiCheckCircle style={{ flexShrink: 0, color: "var(--success)" }} />
                    <span>
                        Formulaire pré-rempli automatiquement. <strong>Vérifiez les données</strong> avant de valider.
                    </span>
                </div>
            )}

            {extractPreview && status === "success" && (
                <details style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>
                    <summary style={{ cursor: "pointer", fontWeight: 600 }}>Aperçu du texte extrait</summary>
                    <pre style={{
                        marginTop: 8,
                        padding: 12,
                        background: "var(--bg-secondary)",
                        borderRadius: 8,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: 150,
                        overflow: "auto",
                        fontSize: 11,
                    }}>
                        {extractPreview}
                    </pre>
                </details>
            )}
        </div>
    );
}

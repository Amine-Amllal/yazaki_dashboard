"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiDownload, FiPaperclip, FiTrash2, FiUpload } from "react-icons/fi";
import { useFeedback } from "@/components/ui/feedback-provider";
import { formatDateTime } from "@/lib/i18n/format";

interface DFCFileRecord {
    id: string;
    dfcId: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
    uploadedBy: {
        nom: string;
        prenom: string;
        matricule: string;
    };
}

interface DFCFileManagerProps {
    dfcId: string;
}

function formatFileSize(sizeBytes: number) {
    if (sizeBytes < 1024) return `${sizeBytes} B`;
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DFCFileManager({ dfcId }: DFCFileManagerProps) {
    const { notify, confirm } = useFeedback();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<DFCFileRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const fetchFiles = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/dfc/${dfcId}/files`);
            const data = await res.json();
            if (!res.ok) {
                notify.error(data.error || "Failed to load files");
                return;
            }
            setFiles(data.files || []);
        } catch {
            notify.error("Connection error while loading files");
        } finally {
            setLoading(false);
        }
    }, [dfcId, notify]);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    const handleUpload = async (selectedFiles: FileList | null) => {
        if (!selectedFiles || selectedFiles.length === 0) {
            return;
        }

        setUploading(true);

        try {
            const formData = new FormData();
            Array.from(selectedFiles).forEach((file) => formData.append("files", file));

            const res = await fetch(`/api/dfc/${dfcId}/files`, {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) {
                notify.error(data.error || "Failed to upload files");
                return;
            }

            notify.success(`${data.files?.length || 0} file(s) uploaded successfully`);
            setFiles((prev) => [...(data.files || []), ...prev]);
        } catch {
            notify.error("Connection error while uploading files");
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDelete = async (file: DFCFileRecord) => {
        const accepted = await confirm({
            title: "Delete file",
            message: `Delete \"${file.originalName}\"?`,
            confirmText: "Delete",
            cancelText: "Cancel",
            danger: true,
        });

        if (!accepted) return;

        try {
            const res = await fetch(`/api/dfc/${dfcId}/files/${file.id}`, {
                method: "DELETE",
            });

            const data = await res.json();
            if (!res.ok) {
                notify.error(data.error || "Failed to delete file");
                return;
            }

            setFiles((prev) => prev.filter((item) => item.id !== file.id));
            notify.success("File deleted successfully");
        } catch {
            notify.error("Connection error while deleting file");
        }
    };

    return (
        <div className="form-card" style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 className="form-card-title" style={{ marginBottom: 0 }}>
                    <FiPaperclip style={{ marginRight: 8, verticalAlign: "middle" }} />
                    Feasibility files
                </h3>
                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.xlsx,.csv,.doc,.docx,.png,.jpg,.jpeg"
                        style={{ display: "none" }}
                        onChange={(e) => handleUpload(e.target.files)}
                    />
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        {uploading ? <><span className="loading-spinner" /> Uploading...</> : <><FiUpload /> Add files</>}
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Loading files...</div>
            ) : files.length === 0 ? (
                <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>No files linked to this DFC.</div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Size</th>
                                <th>Uploaded by</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map((file) => (
                                <tr key={file.id}>
                                    <td>{file.originalName}</td>
                                    <td>{file.mimeType}</td>
                                    <td>{formatFileSize(file.sizeBytes)}</td>
                                    <td>{`${file.uploadedBy.prenom} ${file.uploadedBy.nom}`}</td>
                                    <td>{formatDateTime(file.createdAt)}</td>
                                    <td>
                                        <div style={{ display: "flex", gap: 6 }}>
                                            <a
                                                className="btn btn-secondary btn-sm btn-icon"
                                                href={`/api/dfc/${dfcId}/files/${file.id}/download`}
                                                title="Download"
                                            >
                                                <FiDownload />
                                            </a>
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm btn-icon"
                                                title="Delete"
                                                onClick={() => handleDelete(file)}
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

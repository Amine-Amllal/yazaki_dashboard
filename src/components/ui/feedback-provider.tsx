"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX, FiHelpCircle } from "react-icons/fi";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface PromptOptions {
  title?: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

type DialogState =
  | ({ kind: "confirm" } & Required<ConfirmOptions>)
  | ({ kind: "prompt"; value: string } & Required<Omit<PromptOptions, "defaultValue">>);

interface FeedbackContextType {
  notify: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
  };
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const FeedbackContext = createContext<FeedbackContextType | null>(null);

const TOAST_TIMEOUT = 4200;

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const idRef = useRef(1);
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const promptResolverRef = useRef<((value: string | null) => void) | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (type: ToastType, message: string) => {
      const id = idRef.current++;
      setToasts((prev) => [...prev, { id, type, message }]);
      window.setTimeout(() => removeToast(id), TOAST_TIMEOUT);
    },
    [removeToast]
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      promptResolverRef.current = null;
      setDialog({
        kind: "confirm",
        title: options.title ?? "Confirmation",
        message: options.message,
        confirmText: options.confirmText ?? "Confirmer",
        cancelText: options.cancelText ?? "Annuler",
        danger: options.danger ?? false,
      });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      promptResolverRef.current = resolve;
      confirmResolverRef.current = null;
      setDialog({
        kind: "prompt",
        title: options.title ?? "Saisie requise",
        message: options.message ?? "",
        confirmText: options.confirmText ?? "Valider",
        cancelText: options.cancelText ?? "Annuler",
        danger: options.danger ?? false,
        placeholder: options.placeholder ?? "",
        value: options.defaultValue ?? "",
      });
    });
  }, []);

  const closeDialog = useCallback((value: boolean | string | null) => {
    if (dialog?.kind === "confirm") {
      confirmResolverRef.current?.(Boolean(value));
      confirmResolverRef.current = null;
    }

    if (dialog?.kind === "prompt") {
      promptResolverRef.current?.(typeof value === "string" ? value : null);
      promptResolverRef.current = null;
    }

    setDialog(null);
  }, [dialog]);

  const contextValue = useMemo<FeedbackContextType>(
    () => ({
      notify: {
        success: (message: string) => pushToast("success", message),
        error: (message: string) => pushToast("error", message),
        info: (message: string) => pushToast("info", message),
        warning: (message: string) => pushToast("warning", message),
      },
      confirm,
      prompt,
    }),
    [confirm, prompt, pushToast]
  );

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}

      <div className="app-toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          const icon =
            toast.type === "success" ? (
              <FiCheckCircle />
            ) : toast.type === "error" ? (
              <FiAlertCircle />
            ) : toast.type === "warning" ? (
              <FiHelpCircle />
            ) : (
              <FiInfo />
            );

          return (
            <div key={toast.id} className={`app-toast app-toast-${toast.type}`} role="status">
              <div className="app-toast-icon">{icon}</div>
              <div className="app-toast-message">{toast.message}</div>
              <button
                type="button"
                className="app-toast-close"
                onClick={() => removeToast(toast.id)}
                aria-label="Fermer la notification"
              >
                <FiX />
              </button>
            </div>
          );
        })}
      </div>

      {dialog && (
        <div className="app-dialog-overlay" onClick={() => closeDialog(dialog.kind === "confirm" ? false : null)}>
          <div className="app-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="app-dialog-title">{dialog.title}</h3>
            {dialog.message && <p className="app-dialog-text">{dialog.message}</p>}

            {dialog.kind === "prompt" && (
              <input
                className="form-input"
                type="text"
                value={dialog.value}
                placeholder={dialog.placeholder}
                onChange={(e) => setDialog((prev) => (prev && prev.kind === "prompt" ? { ...prev, value: e.target.value } : prev))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    closeDialog(dialog.value.trim() ? dialog.value : null);
                  }
                }}
                autoFocus
              />
            )}

            <div className="app-dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => closeDialog(dialog.kind === "confirm" ? false : null)}>
                {dialog.cancelText}
              </button>
              <button
                type="button"
                className={`btn ${dialog.danger ? "btn-danger" : "btn-primary"}`}
                onClick={() => {
                  if (dialog.kind === "confirm") {
                    closeDialog(true);
                  } else {
                    closeDialog(dialog.value.trim() ? dialog.value.trim() : null);
                  }
                }}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error("useFeedback must be used within FeedbackProvider");
  }
  return ctx;
}

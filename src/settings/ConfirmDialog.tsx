import { useEffect, useRef, type ReactNode } from "react";
import { Tumbler } from "../components/Tumbler";

/**
 * Tumbli's own yes/no dialog, in place of the browser's `confirm()` (which shows a plain
 * system box titled "tauri.localhost says"). Esc or a click outside cancels.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  fill = 0.5,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** how full Tumbli looks in the dialog */
  fill?: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // the safe choice has the focus, so Enter never wipes anything by accident
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-body">
        <div className="dialog-face" aria-hidden>
          <Tumbler fill={fill} size={58} />
        </div>
        <h2 id="dialog-title">{title}</h2>
        <div id="dialog-body" className="dialog-body">
          {children}
        </div>
        <div className="dialog-actions">
          <button ref={cancelRef} className="pill" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="pill danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

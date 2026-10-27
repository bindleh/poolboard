import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Item } from "../types";
import { mediumImage } from "../util";

type Variant = "primary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[#1e1e1e] text-white hover:bg-black disabled:bg-neutral-400",
  ghost: "bg-white text-[#1e1e1e] border border-[#1e1e1e] hover:bg-neutral-100 disabled:opacity-40",
  danger: "bg-white text-red-700 border border-red-700 hover:bg-red-50 disabled:opacity-40",
};

export function Button({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function ItemImage({
  item,
  size = "small",
  className = "",
}: {
  item: Item;
  size?: "small" | "medium";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (item.removed) {
    return (
      <div className={`flex items-center justify-center bg-neutral-200 text-neutral-500 text-xs text-center p-2 ${className}`}>
        entfernt
      </div>
    );
  }
  const src = size === "medium" && !failed ? mediumImage(item.previewImage) : item.previewImage;
  return (
    <img
      src={src}
      alt={item.title}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover bg-neutral-200 ${className}`}
    />
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white max-h-[92vh] w-full max-w-4xl overflow-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  text: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional third choice, shown as a red button between Abbrechen and the main button. */
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-white max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-sm text-neutral-700 mb-5">{text}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onCancel}>Abbrechen</Button>
          {secondaryLabel && onSecondary && (
            <Button variant="danger" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          )}
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

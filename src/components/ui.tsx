import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Item } from "../types";
import { mediumImage } from "../util";

type Variant = "primary" | "dark" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-green text-ink border-2 border-brand-green hover:brightness-95 disabled:opacity-40",
  dark: "bg-ink text-white border-2 border-ink hover:bg-black disabled:opacity-40",
  ghost: "bg-white text-ink border-2 border-ink hover:bg-neutral-100 disabled:opacity-40",
  danger: "bg-white text-ink border-2 border-brand-pink hover:bg-pink-50 disabled:opacity-40",
};

/** "pool[______]board": bold wordmark with a green underline. */
export function Logo({ className = "" }: { className?: string }) {
  return <img src="/logo.png" alt="poolboard" className={`block w-auto ${className}`} />;
}

export function Button({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`rounded-xl px-4 py-2 text-[15px] font-medium transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function ItemImage({
  item,
  size = "small",
  className = "",
  onLoad,
}: {
  item: Item;
  size?: "small" | "medium";
  className?: string;
  onLoad?: (img: HTMLImageElement) => void;
}) {
  const [failed, setFailed] = useState(false);
  if (item.removed) {
    return (
      <div className={`flex items-center justify-center bg-tile text-neutral-500 text-xs text-center p-2 ${className}`}>
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
      onLoad={onLoad && ((e) => onLoad(e.currentTarget))}
      className={`object-cover bg-tile ${className}`}
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
        className="bg-white max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl shadow-xl"
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
      <div className="bg-white max-w-md w-full p-6 rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
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

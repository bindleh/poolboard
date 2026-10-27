import type { ReactNode } from "react";
import type { Item } from "../types";
import { formatDating } from "../util";
import { Button, ItemImage, Modal } from "./ui";

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-sm py-1.5 border-b border-neutral-200">
      <dt className="text-neutral-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function ItemDetail({
  item,
  onClose,
  actions,
}: {
  item: Item;
  onClose: () => void;
  actions?: ReactNode;
}) {
  return (
    <Modal onClose={onClose}>
      <div className="grid md:grid-cols-[1.2fr_1fr]">
        <ItemImage item={item} size="medium" className="w-full h-72 md:h-full max-h-[80vh] !object-contain" />
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-3">{item.title}</h2>
          {item.removed ? (
            <p className="text-sm text-neutral-600">
              Dieses Objekt ist bei Kulturpool nicht mehr verfügbar.
            </p>
          ) : (
            <dl>
              <Row label="Künstler:in">{item.creators.join("; ")}</Row>
              <Row label="Datierung">{formatDating(item)}</Row>
              <Row label="Institution">{item.institution}</Row>
              <Row label="Objekttyp">{item.types.join("; ")}</Row>
              <Row label="Beschreibung">{item.description[0]}</Row>
              <Row label="Lizenz">
                {[item.rightsName.join(", "), item.reusePolicy.length ? `(${item.reusePolicy.join(", ")})` : ""]
                  .filter(Boolean)
                  .join(" ")}
              </Row>
              <Row label="Rechteinhaber">{item.rightsHolder.join("; ")}</Row>
              <Row label="Links">
                <span className="flex gap-4">
                  {item.sourceUrl && (
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                      Institution
                    </a>
                  )}
                  <a href={item.kulturpoolUrl} target="_blank" rel="noopener noreferrer">
                    Kulturpool
                  </a>
                </span>
              </Row>
            </dl>
          )}
          <div className="flex gap-2 mt-5">
            {actions}
            <Button onClick={onClose}>Schließen</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

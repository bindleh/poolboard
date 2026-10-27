export type Side = "l" | "r" | "t" | "b";

export interface NodeSlot {
  x: number;
  y: number;
  row: number;
  col: number;
}

export const NODE_WIDTH = 200;
export const COL_PITCH = 360;
export const ROW_PITCH = 340;
export const COLUMNS = 4;

/** Snake layout: left to right on even rows, right to left on odd rows. */
export function snakeSlots(count: number, columns = COLUMNS): NodeSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / columns);
    const pos = i % columns;
    const col = row % 2 === 0 ? pos : columns - 1 - pos;
    return { x: col * COL_PITCH, y: row * ROW_PITCH, row, col };
  });
}

/** Which sides of two consecutive slots the connecting edge should use. */
export function edgeSides(from: NodeSlot, to: NodeSlot): { source: Side; target: Side } {
  if (from.row !== to.row) return { source: "b", target: "t" };
  return to.col > from.col ? { source: "r", target: "l" } : { source: "l", target: "r" };
}

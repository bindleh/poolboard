import {
  BaseEdge,
  Background,
  Controls,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState } from "react";
import { fetchExistingIds } from "../api/client";
import { ItemDetail } from "../components/ItemDetail";
import { Button, ItemImage } from "../components/ui";
import { edgeSides, snakeSlots, type Side } from "../journey/layout";
import { exportBoardsHtml, exportFilename } from "../exchange/kulturpoolHtml";
import type { Board, Item } from "../types";
import { downloadFile, linkLabel } from "../util";

const POSITIONS: Record<Side, Position> = {
  l: Position.Left,
  r: Position.Right,
  t: Position.Top,
  b: Position.Bottom,
};

type CardData = { item: Item; index: number };

function CardNode({ data }: NodeProps<Node<CardData>>) {
  const { item, index } = data;
  return (
    <div
      className={`w-[200px] bg-white p-2 shadow-sm cursor-pointer ${
        item.removed ? "border border-dashed border-neutral-400" : "border border-neutral-300"
      }`}
    >
      {(Object.keys(POSITIONS) as Side[]).flatMap((side) => [
        <Handle key={`s${side}`} id={`s-${side}`} type="source" position={POSITIONS[side]} className="!opacity-0" />,
        <Handle key={`t${side}`} id={`t-${side}`} type="target" position={POSITIONS[side]} className="!opacity-0" />,
      ])}
      <div className="relative">
        <ItemImage item={item} className="w-full h-36" />
        <span className="absolute left-0 top-0 bg-[#1e1e1e] text-white text-[11px] px-1.5 py-0.5">{index + 1}</span>
      </div>
      <div className="text-[13px] font-semibold leading-snug mt-2 line-clamp-2">{item.title}</div>
      <div className="text-[11px] text-neutral-500 truncate">{item.removed ? "" : item.institution}</div>
    </div>
  );
}

type EdgeData = { label: string };

function LinkEdge(props: EdgeProps<Edge<EdgeData>>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });
  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={{ stroke: "#1e1e1e", strokeWidth: 1.5 }} />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          className="absolute max-w-[130px] bg-[#f5f5f5] px-1 py-0.5 text-[10px] leading-tight text-center text-neutral-700 pointer-events-none"
        >
          {props.data?.label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const nodeTypes = { card: CardNode };
const edgeTypes = { link: LinkEdge };

function removedPlaceholder(item: Item): Item {
  return { ...item, title: "Dieses Objekt wurde entfernt", removed: true, creators: [], description: [] };
}

interface Props {
  board: Board;
  onBack: () => void;
  onRename: (title: string) => void;
}

export function BoardPage({ board, onBack, onRename }: Props) {
  const [items, setItems] = useState<Item[]>(board.items);
  const [selected, setSelected] = useState<Item | null>(null);
  const [title, setTitle] = useState(board.title);

  useEffect(() => {
    setItems(board.items);
    setTitle(board.title);
    let cancelled = false;
    fetchExistingIds(board.items.map((i) => i.id))
      .then((existing) => {
        if (cancelled) return;
        setItems(board.items.map((i) => (existing.has(i.id) ? i : removedPlaceholder(i))));
      })
      .catch(() => {
        /* offline or API down: keep the saved snapshot */
      });
    return () => {
      cancelled = true;
    };
  }, [board]);

  const { nodes, edges } = useMemo(() => {
    const slots = snakeSlots(items.length);
    const nodes: Node<CardData>[] = items.map((item, index) => ({
      id: item.id,
      type: "card",
      position: { x: slots[index].x, y: slots[index].y },
      data: { item, index },
      draggable: true,
    }));
    const edges: Edge<EdgeData>[] = board.links.slice(0, items.length - 1).map((link, i) => {
      const sides = edgeSides(slots[i], slots[i + 1]);
      return {
        id: `e${i}`,
        type: "link",
        source: items[i].id,
        target: items[i + 1].id,
        sourceHandle: `s-${sides.source}`,
        targetHandle: `t-${sides.target}`,
        markerEnd: { type: MarkerType.ArrowClosed, color: "#1e1e1e" },
        data: { label: linkLabel(link) },
      };
    });
    return { nodes, edges };
  }, [items, board.links]);

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-neutral-300 bg-white">
        <Button onClick={onBack}>← History</Button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const t = title.trim() || board.title;
            setTitle(t);
            if (t !== board.title) onRename(t);
          }}
          aria-label="Board-Titel"
          className="flex-1 min-w-[200px] text-lg font-semibold bg-transparent border-b border-dashed border-neutral-400 focus:outline-none focus:border-[#1e1e1e]"
        />
        <span className="text-sm text-neutral-500">{board.items.length} Objekte</span>
        <Button onClick={() => downloadFile(exportFilename(), exportBoardsHtml([board]))}>Als HTML exportieren</Button>
      </div>
      <div className="flex-1 bg-[#f5f5f5]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          onNodeClick={(_, n) => setSelected((n.data as CardData).item)}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} color="#d4d4d4" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {selected && <ItemDetail item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

import { useTaskGraphStore } from "stores/taskGraphStore";
import { SerialisedNodes } from "stores/applicationStore";


/**
 * Liefert das transferToCollab-Array des (ersten) Collaboration-Nodes.
 * Default: ["fieldValue"]  – falls nichts konfiguriert.
 */
export function getTransferKeys(): string[] {
  const tgs = useTaskGraphStore();
  const nodes = tgs.getProperty("$.nodes") as SerialisedNodes;
  const collabNode = Object.values(nodes).find(
    (n) => n.collaboration?.mode === "collaboration"
  );
  return collabNode?.collaboration?.transferToCollab?.length
    ? [...collabNode.collaboration.transferToCollab]
    : ["fieldValue"]; // Fallback
}

/** true, wenn der übergebene Pfad einen der Transfer-Keys enthält */
export function isTransferablePath(path: string): boolean {
  const keys = getTransferKeys();
  return keys.some((k) => path.endsWith(`.${k}`) || path.includes(k));
}

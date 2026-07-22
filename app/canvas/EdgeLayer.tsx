import { AnimatePresence, motion } from "motion/react";
import type { EdgeGeometry } from "./types";

interface EdgeLayerProps {
  edges: EdgeGeometry[];
}

export function EdgeLayer({ edges }: EdgeLayerProps) {
  return (
    <svg aria-hidden="true" className="canvas-edges">
      <AnimatePresence>
        {edges.map((edge) => (
          <motion.path
            animate={{ opacity: 1, pathLength: 1 }}
            className="canvas-edge"
            d={edge.path}
            exit={{ opacity: 0, pathLength: 0 }}
            initial={{ opacity: 0, pathLength: 0 }}
            key={edge.id}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </AnimatePresence>
    </svg>
  );
}

import { useEffect, useRef, useState } from "react";
import { CurrentNodeIcon, FitIcon, MinusIcon, PlusIcon } from "./Icons";

const PRESET_SCALES = [0.5, 0.75, 1, 1.25, 1.5];

interface CanvasHudProps {
  onCurrent: () => void;
  onFit: () => void;
  onZoomPreset: (scale: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  scale: number;
}

interface IconButtonProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}

function IconButton({ children, label, onClick }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className="canvas-hud__button"
      data-tooltip={label}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

export function CanvasHud({
  onCurrent,
  onFit,
  onZoomPreset,
  onZoomIn,
  onZoomOut,
  scale,
}: CanvasHudProps) {
  const [presetsOpen, setPresetsOpen] = useState(false);
  const scaleControlRef = useRef<HTMLDivElement>(null);
  const percentage = Math.round(scale * 100);

  useEffect(() => {
    if (!presetsOpen) {
      return;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!scaleControlRef.current?.contains(event.target as Node)) {
        setPresetsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPresetsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [presetsOpen]);

  return (
    <nav aria-label="画布控制" className="canvas-hud">
      <IconButton label="回到当前节点" onClick={onCurrent}>
        <CurrentNodeIcon />
      </IconButton>
      <IconButton label="显示全部节点" onClick={onFit}>
        <FitIcon />
      </IconButton>
      <span aria-hidden="true" className="canvas-hud__divider" />
      <IconButton label="缩小" onClick={onZoomOut}>
        <MinusIcon />
      </IconButton>
      <div className="canvas-hud__scale-control" ref={scaleControlRef}>
        {presetsOpen ? (
          <div
            aria-label="预置缩放比例"
            className="canvas-hud__scale-presets"
            role="group"
          >
            {PRESET_SCALES.map((preset) => {
              const presetPercentage = Math.round(preset * 100);
              return (
                <button
                  aria-label={`缩放到 ${presetPercentage}%`}
                  aria-pressed={percentage === presetPercentage}
                  className="canvas-hud__scale-preset"
                  key={preset}
                  onClick={() => {
                    onZoomPreset(preset);
                    setPresetsOpen(false);
                  }}
                  type="button"
                >
                  {presetPercentage}%
                </button>
              );
            })}
          </div>
        ) : null}
        <button
          aria-expanded={presetsOpen}
          aria-label={`当前缩放 ${percentage}%，显示预置比例`}
          className="canvas-hud__scale-value"
          onClick={() => setPresetsOpen((open) => !open)}
          type="button"
        >
          {percentage}%
        </button>
      </div>
      <IconButton label="放大" onClick={onZoomIn}>
        <PlusIcon />
      </IconButton>
    </nav>
  );
}

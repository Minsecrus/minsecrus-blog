import { useEffect, useRef, useState } from "react";
import { CloseIcon, GitHubIcon, InfoIcon } from "./Icons";

export function CanvasInfo() {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="显示站点信息"
        className="canvas-info-island canvas-island-button"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <InfoIcon />
      </button>

      <dialog
        aria-labelledby="canvas-info-title"
        className="canvas-info-dialog"
        onCancel={(event) => {
          event.preventDefault();
          setIsOpen(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setIsOpen(false);
          }
        }}
        onClose={() => setIsOpen(false)}
        ref={dialogRef}
      >
        <button
          aria-label="关闭信息"
          className="canvas-info-dialog__close"
          onClick={() => setIsOpen(false)}
          type="button"
        >
          <CloseIcon />
        </button>
        <h2 id="canvas-info-title">
          {"Minsecrus' "}
          <span>Blog</span>
        </h2>
        <p>一个以 Markdown 为内容、以认知关系组织的画布式博客。</p>
        <p>拖拽移动画布，滚轮缩放，点击正文标记展开或收起内容。</p>
        <a
          className="canvas-info-dialog__github"
          href="https://github.com/Minsecrus/minsecrus-blog"
          rel="noreferrer"
          target="_blank"
        >
          <GitHubIcon />
          <span>Minsecrus/minsecrus-blog</span>
        </a>
        <p className="canvas-info-dialog__license">MIT License</p>
      </dialog>
    </>
  );
}

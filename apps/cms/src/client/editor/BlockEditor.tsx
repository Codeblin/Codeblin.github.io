import { BLOCK_TYPES, emptyBlock, type Block, type BlockType } from '@codeblin/content/client';
import { useRef, useState, type DragEvent, type ReactElement } from 'react';

import { BlockForm, type MediaContext } from './BlockForm.tsx';

interface Props {
  blocks: Block[];
  selected: number;
  onSelect: (index: number) => void;
  onChange: (blocks: Block[]) => void;
  onSlash: () => void;
  onInsertBelow: (index: number) => void;
  media?: MediaContext;
}

export function BlockEditor({
  blocks,
  selected,
  onSelect,
  onChange,
  onSlash,
  onInsertBelow,
  media,
}: Props): ReactElement {
  const dragFrom = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const update = (index: number, next: Block): void => {
    const copy = [...blocks];
    copy[index] = next;
    onChange(copy);
  };

  const move = (index: number, delta: number): void => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    reorder(index, target);
  };

  const reorder = (from: number, to: number): void => {
    if (from === to) return;
    const copy = [...blocks];
    const [item] = copy.splice(from, 1);
    if (!item) return;
    copy.splice(to, 0, item);
    onChange(copy);
    onSelect(to);
  };

  const duplicate = (index: number): void => {
    const source = blocks[index];
    if (!source) return;
    const copy = structuredClone(source) as Block;
    copy.id = emptyBlock(copy.type).id;
    const next = [...blocks];
    next.splice(index + 1, 0, copy);
    onChange(next);
    onSelect(index + 1);
  };

  const remove = (index: number): void => {
    if (blocks.length === 1) {
      onChange([emptyBlock('prose')]);
      onSelect(0);
      return;
    }
    onChange(blocks.filter((_, i) => i !== index));
    onSelect(Math.max(0, index - 1));
  };

  const onDragStart = (index: number, event: DragEvent<HTMLButtonElement>): void => {
    dragFrom.current = index;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    event.dataTransfer.setData('application/x-codeblin-block', String(index));
  };

  const onDragOver = (index: number, event: DragEvent<HTMLElement>): void => {
    if (dragFrom.current === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (over !== index) setOver(index);
  };

  const onDrop = (index: number, event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    const from = dragFrom.current;
    dragFrom.current = null;
    setOver(null);
    if (from === null) return;
    reorder(from, index);
  };

  return (
    <div className="blocks">
      {blocks.map((block, index) => (
        <article
          key={block.id}
          className="block"
          data-selected={index === selected ? '' : undefined}
          data-drop={over === index ? '' : undefined}
          onClick={() => onSelect(index)}
          onDragOver={(event) => onDragOver(index, event)}
          onDragLeave={() => {
            if (over === index) setOver(null);
          }}
          onDrop={(event) => onDrop(index, event)}
        >
          <div className="block__bar">
            <button
              type="button"
              className="block__grip"
              draggable
              aria-label="Drag to reorder"
              onDragStart={(event) => onDragStart(index, event)}
              onDragEnd={() => {
                dragFrom.current = null;
                setOver(null);
              }}
            >
              ⋮⋮
            </button>
            <span>{block.type}</span>
            <span style={{ marginInlineStart: 'auto' }} />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                move(index, -1);
              }}
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                move(index, 1);
              }}
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onInsertBelow(index);
              }}
              aria-label="Insert block below"
            >
              +
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                duplicate(index);
              }}
            >
              Dup
            </button>
            <button
              type="button"
              className="danger"
              onClick={(event) => {
                event.stopPropagation();
                remove(index);
              }}
            >
              Del
            </button>
          </div>
          <div className="block__body">
            <BlockForm
              block={block}
              onChange={(next) => update(index, next)}
              onSlash={index === selected ? onSlash : undefined}
              media={media}
            />
          </div>
        </article>
      ))}
      <button
        type="button"
        onClick={() => onInsertBelow(Math.max(0, blocks.length - 1))}
      >
        + Block
      </button>
    </div>
  );
}

export function InsertPalette({
  onPick,
  onClose,
}: {
  onPick: (type: BlockType) => void;
  onClose: () => void;
}): ReactElement {
  return (
    <div className="palette" role="listbox">
      {BLOCK_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => {
            onPick(type);
            onClose();
          }}
        >
          {type}
        </button>
      ))}
      <button type="button" onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}

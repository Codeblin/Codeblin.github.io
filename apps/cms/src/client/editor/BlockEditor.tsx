import { BLOCK_TYPES, emptyBlock, type Block, type BlockType } from '@codeblin/content';

import { BlockForm } from './BlockForm.tsx';

interface Props {
  blocks: Block[];
  selected: number;
  onSelect: (index: number) => void;
  onChange: (blocks: Block[]) => void;
  onSlash: () => void;
}

export function BlockEditor({ blocks, selected, onSelect, onChange, onSlash }: Props): React.ReactElement {
  const update = (index: number, next: Block): void => {
    const copy = [...blocks];
    copy[index] = next;
    onChange(copy);
  };

  const move = (index: number, delta: number): void => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const copy = [...blocks];
    const [item] = copy.splice(index, 1);
    if (!item) return;
    copy.splice(target, 0, item);
    onChange(copy);
    onSelect(target);
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
    const next = blocks.filter((_, i) => i !== index);
    onChange(next);
    onSelect(Math.max(0, index - 1));
  };

  return (
    <div>
      {blocks.map((block, index) => (
        <article
          key={block.id}
          className="block"
          data-selected={index === selected ? '' : undefined}
          onClick={() => onSelect(index)}
        >
          <div className="block__bar">
            <span>{block.type}</span>
            <span style={{ marginInlineStart: 'auto' }} />
            <button type="button" onClick={() => move(index, -1)} aria-label="Move up">
              ↑
            </button>
            <button type="button" onClick={() => move(index, 1)} aria-label="Move down">
              ↓
            </button>
            <button type="button" onClick={() => duplicate(index)}>
              Dup
            </button>
            <button type="button" className="danger" onClick={() => remove(index)}>
              Del
            </button>
          </div>
          <div className="block__body">
            <BlockForm
              block={block}
              onChange={(next) => update(index, next)}
              onSlash={index === selected ? onSlash : undefined}
            />
          </div>
        </article>
      ))}
      <button
        type="button"
        onClick={() => {
          onChange([...blocks, emptyBlock('prose')]);
          onSelect(blocks.length);
        }}
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
}): React.ReactElement {
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

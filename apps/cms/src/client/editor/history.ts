import type { Block } from '@codeblin/content/client';

export interface Snapshot<T> {
  frontmatter: T;
  blocks: Block[];
}

export class HistoryStack<T> {
  private past: Snapshot<T>[] = [];
  private future: Snapshot<T>[] = [];
  private lastCoalesce = 0;

  push(snapshot: Snapshot<T>, coalesce = false): void {
    const now = Date.now();
    if (coalesce && now - this.lastCoalesce < 500 && this.past.length > 0) {
      this.past[this.past.length - 1] = structuredClone(snapshot);
    } else {
      this.past.push(structuredClone(snapshot));
      if (this.past.length > 80) this.past.shift();
    }
    this.future = [];
    this.lastCoalesce = now;
  }

  undo(current: Snapshot<T>): Snapshot<T> | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(structuredClone(current));
    return previous;
  }

  redo(current: Snapshot<T>): Snapshot<T> | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(structuredClone(current));
    return next;
  }
}

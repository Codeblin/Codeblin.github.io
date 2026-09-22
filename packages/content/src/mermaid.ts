/**
 * Mermaid diagrams share the `diagram` block type with ASCII art. The fence
 * language is `mermaid` when the source looks like Mermaid, `diagram` otherwise,
 * so existing ASCII figures keep their round-trip.
 */
const MERMAID_START =
  /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|mindmap|gitGraph|journey|C4Context|timeline|quadrantChart|requirementDiagram|sankey-beta|xychart-beta|block-beta|packet-beta)\b/;

export function looksLikeMermaid(source: string): boolean {
  const first = source
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('%%'));
  return first !== undefined && MERMAID_START.test(first);
}

/** Strip script and event handlers from a Mermaid SVG before inlining it. */
export function sanitizeMermaidSvg(svg: string): string {
  if (!/<svg[\s>]/i.test(svg)) return '';
  return svg
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

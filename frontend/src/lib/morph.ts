export interface MorphSource {
  x: number;
  y: number;
  width: number;
  height: number;
}

let source: MorphSource | null = null;

export function setMorphSource(rect: DOMRect) {
  source = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

export function consumeMorphSource(): MorphSource | null {
  const s = source;
  source = null;
  return s;
}
const DEFAULT_MAX_CHARS = 5200;

function splitOversizedBlock(block: string, maxChars: number) {
  if (block.length <= maxChars) return [block];
  const sentences = block.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (!sentence) continue;
    if (current && current.length + 1 + sentence.length > maxChars) {
      chunks.push(current);
      current = sentence;
    } else {
      current += `${current ? " " : ""}${sentence}`;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [block];
}

export function chunkProtectedText(text: string, maxChars = DEFAULT_MAX_CHARS) {
  if (text.length <= maxChars) return [text];

  const blocks = text.split(/\n\s*\n/).flatMap((block) => splitOversizedBlock(block, maxChars));
  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    if (!block) continue;
    if (current && current.length + 2 + block.length > maxChars) {
      chunks.push(current);
      current = block;
    } else {
      current += `${current ? "\n\n" : ""}${block}`;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

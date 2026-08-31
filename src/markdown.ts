const ANSI = "\u001b[";

function style(enabled: boolean, code: string, value: string): string {
  return enabled ? `${ANSI}${code}m${value}${ANSI}0m` : value;
}

function inlineMarkdown(line: string, color: boolean): string {
  const tokens: string[] = [];
  const protectedLine = line.replace(/`([^`]+)`/g, (_match, code: string) => {
    tokens.push(style(color, "36", code));
    return `\u0000${tokens.length - 1}\u0000`;
  });
  const styled = protectedLine
    .replace(/\*\*([^*]+)\*\*/g, (_match, value: string) => style(color, "1", value))
    .replace(/__([^_]+)__/g, (_match, value: string) => style(color, "1", value))
    .replace(/\*([^*]+)\*/g, (_match, value: string) => style(color, "3", value))
    .replace(/_([^_]+)_/g, (_match, value: string) => style(color, "3", value));
  return styled.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => tokens[Number(index)] ?? "");
}

export function ensureMarkdown(text: string, intent: "WHY" | "HOW" | "MIX"): string {
  const value = text.trim();
  if (!value) return "";
  if (/^(#{1,6}\s|[-*+]\s|\d+\.\s|```|>\s)/m.test(value)) return value;
  const heading = intent === "WHY" ? "Why" : intent === "HOW" ? "How" : "Answer";
  return `## ${heading}\n\n${value}`;
}

export function renderMarkdown(text: string, intent: "WHY" | "HOW" | "MIX", color = false): string {
  const markdown = ensureMarkdown(text, intent);
  let fenced = false;
  return markdown.split("\n").map((line) => {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      return style(color, "2;36", line.trim());
    }
    if (fenced) return style(color, "2", line);
    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (heading) return style(color, "1;36", `${heading[1]} ${inlineMarkdown(heading[2], color)}`);
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) return style(color, "2", "────────────────────────────────────────");
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bullet) return `  ${style(color, "33", "•")} ${inlineMarkdown(bullet[1], color)}`;
    const numbered = line.match(/^\s*(\d+[.)])\s+(.+)$/);
    if (numbered) return `  ${style(color, "33", numbered[1])} ${inlineMarkdown(numbered[2], color)}`;
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) return style(color, "2", `│ ${inlineMarkdown(quote[1], color)}`);
    return inlineMarkdown(line, color);
  }).join("\n");
}

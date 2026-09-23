/**
 * 轻量 Markdown 子集渲染（前端优化批二 · 2026-09-22）
 *
 * 背景：对话页原先把学长回复按纯文本渲染（whitespace-pre-wrap）。接入真实大模型后，
 * 模型输出常带 **加粗**、有序/无序列表，裸符号直接显示会很生硬。
 *
 * 范围（刻意只做子集，不引 md 库）：
 *   - 行内：**加粗**、`行内代码`
 *   - 块级：有序列表（1. / 1、/ 1)）、无序列表（- / * / ·）、段落（段内换行保留）
 *   - 不支持的语法（标题、表格、链接、图片）按原样文本显示，不吞内容
 *
 * 安全：全部走 React 元素渲染，不使用 dangerouslySetInnerHTML —— 模型输出不进入 HTML 解析路径。
 */

import type { ReactElement, ReactNode } from 'react';

/** 行内标记：**加粗** 或 `代码`（非贪婪，逐段推进）。 */
const INLINE_MARK = /\*\*([^*]+)\*\*|`([^`]+)`/g;
/**
 * 有序列表项。ASCII 分隔符（. / )）要求后面有空格——避免把「1.5 是答案」这类小数误判成列表项；
 * 中文顿号「、」本身不是小数点，允许紧跟内容（更符合中文书写习惯）。
 */
const ORDERED_ITEM = /^\s*(?:\d+\s*[.)]\s+|\d+\s*、\s*)(.+)$/;
const UNORDERED_ITEM = /^\s*[-*·]\s+(.*)$/;

type Block =
  | { type: 'p'; text: string }
  | { type: 'ol'; items: string[] }
  | { type: 'ul'; items: string[] };

/** 行内渲染：返回可安全直接放进 JSX 的片段数组。 */
export function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  INLINE_MARK.lastIndex = 0;

  while ((match = INLINE_MARK.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const bold = match[1];
    const code = match[2];
    if (bold !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-b${match.index}`} className="font-medium text-ink">
          {bold}
        </strong>,
      );
    } else if (code !== undefined) {
      nodes.push(
        <code
          key={`${keyPrefix}-c${match.index}`}
          className="rounded bg-canvas px-1 py-0.5 font-mono text-[0.95em] text-ink"
        >
          {code}
        </code>,
      );
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/** 按行切块：连续列表项合并成一个列表块，其余行合并成段落（段内换行保留）。 */
export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let paragraph: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    const text = paragraph.join('\n').replace(/\n{2,}/g, '\n').trim();
    if (text.length > 0) blocks.push({ type: 'p', text });
    paragraph = [];
  };

  for (const line of lines) {
    const ordered = ORDERED_ITEM.exec(line);
    if (ordered) {
      flushParagraph();
      const last = blocks[blocks.length - 1];
      const text = ordered[1].trim();
      if (last?.type === 'ol') last.items.push(text);
      else blocks.push({ type: 'ol', items: [text] });
      continue;
    }
    const unordered = UNORDERED_ITEM.exec(line);
    if (unordered) {
      flushParagraph();
      const last = blocks[blocks.length - 1];
      if (last?.type === 'ul') last.items.push(unordered[1].trim());
      else blocks.push({ type: 'ul', items: [unordered[1].trim()] });
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();

  return blocks;
}

interface RichTextProps {
  text: string;
  /** 段落与列表之间的间距由调用方决定（与气泡内边距配合）。 */
  className?: string;
}

export default function RichText({ text, className }: RichTextProps): ReactElement {
  const blocks = parseBlocks(text);

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === 'p') {
          return (
            <p key={`p${index}`} className="whitespace-pre-wrap">
              {renderInline(block.text, `p${index}`)}
            </p>
          );
        }
        const items = block.items.map((item, itemIndex) => (
          <li key={`i${itemIndex}`}>{renderInline(item, `l${index}-${itemIndex}`)}</li>
        ));
        return block.type === 'ol' ? (
          <ol key={`ol${index}`} className="list-decimal space-y-0.5 pl-5">
            {items}
          </ol>
        ) : (
          <ul key={`ul${index}`} className="list-disc space-y-0.5 pl-5">
            {items}
          </ul>
        );
      })}
    </div>
  );
}

/**
 * 题目卡（单题渲染）——页 4 测评、页 5 试卷确认、页 7 归因验证三处共用。
 *
 * 纪律：
 *   - 只渲染契约白名单字段（item_id/stem/options），answer / solution_steps 永不下发（E5）；
 *   - options 非 null → 单选（radio）；null → 文本作答 + 数学符号快捷面板（2026-10-08：
 *     根式/平方/正负号等字符点按即插入，缓解"公式打不出"的输入门槛；纯 input 事件，
 *     不参与判分语义）；
 *   - **不做对错判定**（D11：三种测评模式一律不即时展示对错；验证题的对错由服务端返回、
 *     页面只显示「验证通过」徽标，不评价）。
 */

import { useRef, type ReactNode } from 'react';

import type { ClientItem } from '../api/types';

export interface ItemCardProps {
  item: ClientItem;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** 头部附加内容（序号、题型、状态徽标等）。 */
  header?: ReactNode;
  /** warn = 需要学生注意（如试卷 unclear 行）。 */
  tone?: 'default' | 'warn';
  /** 作答区提示文案。 */
  placeholder?: string;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** 数学符号快捷面板（纯文本插入，光标位置生效；不含任何判分逻辑）。 */
const MATH_SYMBOLS = ['√', '²', '³', '±', '×', '÷', 'π', '≤', '≥', '≠', 'Δ', '/'] as const;

export default function ItemCard({
  item,
  value,
  onChange,
  disabled = false,
  header,
  tone = 'default',
  placeholder = '把你的作答写在这里（写一步也行）',
}: ItemCardProps) {
  const options = item.options ?? null;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertSymbol(symbol: string): void {
    const element = textareaRef.current;
    if (!element) {
      onChange(value + symbol);
      return;
    }
    const start = element.selectionStart ?? value.length;
    const end = element.selectionEnd ?? value.length;
    const next = value.slice(0, start) + symbol + value.slice(end);
    onChange(next);
    // 插入后把光标放回符号之后（异步等 DOM 更新）
    requestAnimationFrame(() => {
      element.focus();
      const cursor = start + symbol.length;
      element.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div
      className={[
        'rounded-surface border bg-surface p-4',
        tone === 'warn' ? 'border-band-weak' : 'border-line',
      ].join(' ')}
    >
      {header ? <div className="mb-2 text-ui-sm text-ink-soft">{header}</div> : null}

      <p className="whitespace-pre-wrap text-reading leading-relaxed text-ink">{item.stem}</p>

      {options && options.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {options.map((option, index) => {
            const selected = value === option;
            return (
              <li key={`${item.item_id}_${index}`}>
                <label
                  className={[
                    'flex cursor-pointer items-start gap-3 rounded-control border px-3 py-2 text-sm transition-colors',
                    selected ? 'border-accent bg-accent-veil text-ink' : 'border-line hover:bg-raised',
                    disabled ? 'cursor-not-allowed opacity-60' : '',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name={`item_${item.item_id}`}
                    className="mt-1 accent-accent"
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onChange(option)}
                  />
                  <span className="leading-relaxed">
                    <span className="mr-1 text-ink-soft">{OPTION_LABELS[index] ?? index + 1}.</span>
                    {option}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <textarea
            ref={textareaRef}
            className="mt-4 w-full resize-y rounded-control border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            rows={3}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
          {/* 数学符号快捷面板：触控目标 ≥ 32px，禁用态跟随作答区 */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-ui-sm text-ink-soft">插入：</span>
            {MATH_SYMBOLS.map((symbol) => (
              <button
                key={symbol}
                type="button"
                disabled={disabled}
                aria-label={`插入符号 ${symbol}`}
                className="min-h-8 min-w-8 rounded-control border border-line bg-surface px-2 text-sm text-ink transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => insertSymbol(symbol)}
              >
                {symbol}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

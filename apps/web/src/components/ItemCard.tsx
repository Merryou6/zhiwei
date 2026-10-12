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
import MathSymbolPad from './MathSymbolPad';

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
  /** 图号批注位（规范 4.3）：传给迁移页的题卡，未迁移页面不传即零变化。 */
  dwg?: string;
  /**
   * 解答题是否渲染整题作答框 + 符号面板（默认 true，既有使用方零变化）。
   * 2026-10-12：练习页解答题批改只走分步 steps（payload 分流见 PracticePage.submitSteps），
   * 整题框成了「写了不参与批改」的死框，且与 STEP 01 提示文案相同造成误导——
   * 练习页传 false 只留题干；选择题 radio 分支不受此开关影响。
   */
  answerVisible?: boolean;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function ItemCard({
  item,
  value,
  onChange,
  disabled = false,
  header,
  tone = 'default',
  placeholder = '把你的作答写在这里（写一步也行）',
  dwg,
  answerVisible = true,
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
        // style-10 P4（规范 5.4）：双线面板。同色 warn 档只换外框色，内框线不变。
        'bp-panel p-4',
        tone === 'warn' ? 'border-band-weak' : '',
      ].join(' ')}
    >
      {header || dwg ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {/* 图号批注位（规范 4.3 的 `.dwg`）：本项目图号制式 10-xx。 */}
          {dwg ? <span className="num-mono text-mono-xs text-accent-ink">DWG {dwg}</span> : null}
          {header ? <span className="text-ui-sm text-ink-soft">{header}</span> : null}
        </div>
      ) : null}

      <p className="whitespace-pre-wrap text-reading leading-relaxed text-ink">{item.stem}</p>

      {options && options.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {options.map((option, index) => {
            const selected = value === option;
            return (
              <li key={`${item.item_id}_${index}`}>
                <label
                  className={[
                    // 选项是「被勾选的件」：0 圆角 + 选中走 accent 边与面纱（规范 5.16 的 .seg 口径）。
                    'flex cursor-pointer items-start gap-3 rounded-none border px-3 py-2.5 text-sm transition-colors',
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
      ) : answerVisible ? (
        <>
          {/* 无可见标签，用提示文案作可访问名（P2 无障碍） */}
          <textarea
            ref={textareaRef}
            // 与 ui/Input 同一套下划线制式（规范 5.3）：只留 1px 下边框。
            className="bp-field mt-4 w-full resize-y px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            rows={3}
            value={value}
            placeholder={placeholder}
            aria-label={placeholder}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
          {/* 数学符号快捷面板（规范 5.16 的 .sym-pad）：面板本体抽至 MathSymbolPad 共用。 */}
          <div className="mt-2">
            <MathSymbolPad disabled={disabled} onInsert={insertSymbol} />
          </div>
        </>
      ) : null}
    </div>
  );
}

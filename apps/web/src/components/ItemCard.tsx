/**
 * 题目卡（单题渲染）——页 4 测评、页 5 试卷确认、页 7 归因验证三处共用。
 *
 * 纪律：
 *   - 只渲染契约白名单字段（item_id/stem/options），answer / solution_steps 永不下发（E5）；
 *   - options 非 null → 单选（radio）；null → 文本作答；
 *   - **不做对错判定**（D11：三种测评模式一律不即时展示对错；验证题的对错由服务端返回、
 *     页面只显示「验证通过」徽标，不评价）。
 */

import type { ReactNode } from 'react';

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

  return (
    <div
      className={[
        'rounded-xl border bg-white p-4',
        tone === 'warn' ? 'border-band-weak' : 'border-line',
      ].join(' ')}
    >
      {header ? <div className="mb-2 text-[13px] text-ink-soft">{header}</div> : null}

      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{item.stem}</p>

      {options && options.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {options.map((option, index) => {
            const selected = value === option;
            return (
              <li key={`${item.item_id}_${index}`}>
                <label
                  className={[
                    'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm transition-colors',
                    selected ? 'border-primary bg-primary-soft text-ink' : 'border-line hover:bg-canvas',
                    disabled ? 'cursor-not-allowed opacity-60' : '',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name={`item_${item.item_id}`}
                    className="mt-1 accent-primary"
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
        <textarea
          className="mt-4 w-full resize-y rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          rows={3}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

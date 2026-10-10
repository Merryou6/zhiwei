/**
 * Masthead 图签条（style-10 蓝图迁移 P4 / 规范 4.3）
 *
 * 吸顶的「图签条」：品牌位 ⊕ 四项图签（项目 / 图号 / 比例 / 日期）⊕ 右区操作
 * （身份芯片 / 索引开关 / 标注开关 / 全部图纸 / 对话面板开合 / 注入槽位）。
 *
 * 【为什么全部是受控 props】外壳（Layout）负责持状态（含 localStorage 记忆），
 * Masthead 只负责画与转发点击 —— 这样它既能被外壳用，也能在截图走查里被固定态用，
 * 且不需要任何 store 依赖（P4 的目标是「组件先就位，P5 再切外壳」）。
 *
 * 【窄档收掉什么】图签四项整块收掉（原型 [data-tier=md/sm] .mast-meta{display:none}）：
 * 窄屏上它只是装饰性元信息，留着力气给操作按钮；索引 / 标注开关同样只在 ≥900 出现
 * （≤900 时底部 tabbar 与「全部图纸」抽屉承担导航）。
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { Icon } from './icons';

/**
 * 图签条按钮制式（原型的 `.btn.sm`：等宽大写、细边、44px 触控底线）。
 *
 * ⚠ 为什么不直接用 ui/Button：P4 这一批**不改 ui/Button 的既有视觉契约** ——
 * 它被全站 40+ 处调用，未迁移页面（P6 起才逐页换）仍依赖当前形态。
 * 所以新外壳先自带一份薄按钮；页面批走完后由 ui/Button 的 blueprint 规格取代
 * （规范 5.1），届时这个本地件删除、调用点换成原语。
 */
export function bpButtonClass(variant: 'primary' | 'secondary' = 'secondary'): string {
  return cn(
    'inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-control px-3 py-2',
    'font-mono text-ui-sm uppercase tracking-widest transition-colors duration-150 ease-out',
    'disabled:cursor-not-allowed',
    variant === 'primary'
      ? 'border border-accent bg-accent text-on-accent hover:border-accent-ink'
      : 'border border-line bg-transparent text-ink hover:border-accent hover:bg-accent-veil',
  );
}

interface BpButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

function BpButton({
  variant = 'secondary',
  className,
  type = 'button',
  children,
  ...rest
}: BpButtonProps) {
  return (
    <button type={type} className={cn(bpButtonClass(variant), className)} {...rest}>
      {children}
    </button>
  );
}

export interface MastheadMetaItem {
  /** 项名（等宽大写，如 PROJECT / SHEET）。 */
  label: string;
  value: string;
}

export interface MastheadIdentity {
  role: 'guest' | 'student' | 'teacher';
  nickname?: string;
}

export interface MastheadProps {
  meta: MastheadMetaItem[];
  identity: MastheadIdentity;
  railOpen: boolean;
  annosOpen: boolean;
  onRailToggle: () => void;
  onAnnosToggle: () => void;
  onOpenIndex: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  /** 空间胶囊 / 主题钮等注入槽位（外壳给，避免这里依赖 store）。 */
  trailing?: ReactNode;
  className?: string;
}

function identityText(identity: MastheadIdentity): string {
  if (identity.role === 'guest') return '身份 未登录';
  const role = identity.role === 'teacher' ? '教师' : '学生';
  return identity.nickname ? `身份 ${role} · ${identity.nickname}` : `身份 ${role}`;
}

export default function Masthead({
  meta,
  identity,
  railOpen,
  annosOpen,
  onRailToggle,
  onAnnosToggle,
  onOpenIndex,
  panelOpen,
  onTogglePanel,
  trailing,
  className,
}: MastheadProps) {
  const loggedIn = identity.role !== 'guest';

  return (
    <header
      data-print="hide"
      className={cn(
        'sticky top-0 z-nav flex flex-wrap items-stretch border-b border-line bg-surface',
        className,
      )}
    >
      <div className="flex min-h-14 flex-1 items-center gap-3 px-4 py-2">
        <span
          aria-hidden="true"
          // 品牌 sigil 里的图标走 accent-ink 而不是 accent（规范 2.4 / 门禁 ⑧：
          // accent 只做填充与描边，凡是「作为内容被看见的蓝」一律走 accent-ink）。
          className="grid h-[34px] w-[34px] flex-none place-items-center border border-line text-accent-ink"
        >
          <Icon name="graph" className="h-5 w-5" />
        </span>
        <span className="font-disp text-title leading-none tracking-widest text-ink">
          知微
          <small className="mt-1 block font-mono text-mono-xs font-normal uppercase tracking-widest text-ink-soft">
            Zhiwei · Blueprint Rev.A
          </small>
        </span>
      </div>

      {/* 四项图签：≤900 整块收掉（原型 .mast-meta） */}
      <dl aria-label="图签" className="hidden items-center border-l border-line/20 sheet:flex">
        {meta.map((item) => (
          <div
            key={item.label}
            className="border-r border-line/20 px-3 py-1.5 font-mono text-mono-xs uppercase leading-normal tracking-widest text-ink-soft"
          >
            {item.label}
            <b className="mt-0.5 block font-disp text-ui-sm font-semibold normal-case tracking-normal text-ink">
              {item.value}
            </b>
          </div>
        ))}
      </dl>

      <div className="flex items-center gap-2 border-l border-line/20 px-3 py-2">
        <span
          className={cn(
            'inline-flex min-h-[22px] items-center gap-1.5 border px-2 py-0.5 font-mono text-mono-xs uppercase tracking-widest',
            loggedIn ? 'border-accent text-accent-ink' : 'border-line text-ink-soft',
          )}
        >
          {identityText(identity)}
        </span>

        <BpButton
          variant="secondary"
          onClick={onRailToggle}
          aria-expanded={railOpen}
          aria-controls="bp-rail"
          className="hidden sheet:inline-flex"
        >
          <Icon name="list" className="h-4 w-4" />
          {railOpen ? '收起' : '索引'}
        </BpButton>

        <BpButton
          variant="secondary"
          onClick={onAnnosToggle}
          aria-pressed={annosOpen}
          className={cn('hidden annos:inline-flex', annosOpen && 'border-accent text-accent-ink')}
        >
          <Icon name="flag" className="h-4 w-4" />
          {annosOpen ? '标注开' : '标注'}
        </BpButton>

        <BpButton variant="secondary" onClick={onOpenIndex} aria-haspopup="dialog">
          <Icon name="layers" className="h-4 w-4" />
          全部图纸
        </BpButton>

        <BpButton
          variant="primary"
          onClick={onTogglePanel}
          aria-pressed={panelOpen}
          aria-label={panelOpen ? '关闭对话面板' : '打开对话面板'}
        >
          <Icon name="chat" className="h-4 w-4" />
          <span className="hidden sheet:inline">学长</span>
        </BpButton>

        {trailing}
      </div>
    </header>
  );
}

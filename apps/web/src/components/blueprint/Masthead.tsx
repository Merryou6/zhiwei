/**
 * Masthead 图签条（style-10 蓝图迁移 P4 / 规范 4.3；2026-10-13 用户验收修订：
 * 删四项图签「项目/图号/比例/日期」——图纸编号制式信息不上产品界面，
 * 项目/学科信息由空间胶囊承担）
 *
 * 吸顶的顶栏：品牌位 ⊕ 右区操作
 * （身份芯片 / 标注开关 / 对话面板开合 / 注入槽位）。
 * 2026-10-13 用户验收修订：侧栏索引开关移出本条（挪到侧栏原「分层索引」标题行位置，
 * 由 Layout 注入 Rail 的 header 槽）。
 *
 * 【为什么全部是受控 props】外壳（Layout）负责持状态（含 localStorage 记忆），
 * Masthead 只负责画与转发点击 —— 这样它既能被外壳用，也能在截图走查里被固定态用，
 * 且不需要任何 store 依赖（P4 的目标是「组件先就位，P5 再切外壳」）。
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../../lib/cn';
import ZhiweiLogo from '../ZhiweiLogo';
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

export interface MastheadIdentity {
  role: 'guest' | 'student' | 'teacher';
  nickname?: string;
}

export interface MastheadProps {
  identity: MastheadIdentity;
  annosOpen: boolean;
  onAnnosToggle: () => void;
  /**
   * 「全部图纸」抽屉入口（P5 修正）。按钮本体由 `trailing` 槽里的右区操作簇渲染
   * （它需要持 MOBILE_NAV_TOGGLE_ID / MOBILE_NAV_DRAWER_ID 这对跨组件 id，见 TopNav.tsx）；
   * 这里保留回调是为了让 Masthead 仍可单独用于截图走查时传一个假实现。
   * 该 prop 目前不被渲染 —— 留痕见执行报告 P5 偏差。
   */
  onOpenIndex?: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  /** 空间胶囊 / 主题钮 / 全部图纸入口等注入槽位（外壳给，避免这里依赖 store）。 */
  trailing?: ReactNode;
  className?: string;
}

function identityText(identity: MastheadIdentity): string {
  if (identity.role === 'guest') return '身份 未登录';
  const role = identity.role === 'teacher' ? '教师' : '学生';
  return identity.nickname ? `身份 ${role} · ${identity.nickname}` : `身份 ${role}`;
}

export default function Masthead({
  identity,
  annosOpen,
  onAnnosToggle,
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
          // 品牌 sigil（2026-10-13 用户验收：换成项目标识 ZhiweiLogo——
          // 与登录页/门户同一份几何与渐变，Icon graph 退役）。
          className="grid h-[34px] w-[34px] flex-none place-items-center border border-line"
        >
          <ZhiweiLogo size={24} />
        </span>
        <span className="font-disp text-title leading-none tracking-widest text-ink">
          知微
          <small className="mt-1 block font-mono text-mono-xs font-normal uppercase tracking-widest text-ink-soft">
            Zhiwei
          </small>
        </span>
      </div>

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
          onClick={onAnnosToggle}
          aria-pressed={annosOpen}
          className={cn('hidden annos:inline-flex', annosOpen && 'border-accent text-accent-ink')}
        >
          <Icon name="flag" className="h-4 w-4" />
          {annosOpen ? '标注开' : '标注'}
        </BpButton>

        <BpButton
          variant="primary"
          onClick={onTogglePanel}
          aria-pressed={panelOpen}
          aria-label={panelOpen ? '关闭对话面板' : '打开对话面板'}
        >
          <Icon name="chat" className="h-4 w-4" />
          {/* 文案用产品的固定名「对话辅导」（= router.ROUTES 里 /chat 的 label），
              不用昵称「学长」：这一处是**开合面板的开关**，它的可访问名与可见文案
              应当与「面板里是什么」一致；工具链（tools/probe-dock-click.cjs）也按
              这个名字找按钮。窄档只留图标（≤900 面板是全屏覆盖，入口在抽屉底部）。 */}
          <span className="hidden sheet:inline">对话辅导</span>
        </BpButton>

        {trailing}
      </div>
    </header>
  );
}

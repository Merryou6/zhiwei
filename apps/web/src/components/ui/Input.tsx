/**
 * Input / Textarea / Select / FormField（2026-09-25 视觉重构 P1b）
 *
 * 【它替换掉什么】
 * 收敛前输入框有三种各写各的形态，且没有 label 关联：
 *   · AttributionPage `selectClass`  = 'mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent'
 *   · LoginPage       `fieldClass`   = 'min-h-12 rounded-control border bg-dusk-surface px-4 py-3 text-reading'（无 bg 类，靠全局兜底）
 *   · 各处 textarea                  = 又是另一串
 * 三者的圆角、聚焦表达、错误表达都不同；且 label 只做视觉，没有 htmlFor，
 * 点击标签不会聚焦输入框，读屏也不知道这个框叫什么。
 *
 * 【两套 tone 的由来】
 * 登录页是全站唯一的「恒深色」页面（`bg-dusk-base`，不随主题切换）。
 * 它用的是 dusk-* 一族表面令牌，与内页的 canvas/surface 是两套体系。
 * 所以这里必须分 tone，而不是让组件去猜自己在哪个页面。
 *
 * 【顺手修掉的一个真实缺陷（缺陷不是本轮引入的）】
 * 登录页的 placeholder 一直不可读：全局规则把 placeholder 着色为
 * `rgb(var(--c-ink-soft))`，而该变量**跟着用户主题走**。浅色主题下
 * `--c-ink-soft` = #5B6B76 落在 dusk-surface(#111A26) 上只有约 3.15:1，
 * 再乘全局 opacity 0.8 只剩约 2.7:1 —— 几乎看不见。
 * 因此 `onDark` tone 显式指定 `placeholder:text-dusk-muted` 并把 opacity 拉回 1，
 * 实测 4.8:1，达 AA。（Tailwind 的 placeholder: 工具类特异性高于全局
 * `input::placeholder` 规则，能稳定覆盖。）
 *
 * 【2026-10-10 style-10 蓝图迁移 P4：换视觉规格，契约一行不动】
 * value/onChange/error/hint/label/required/id 生成规则/autoComplete 透传全部保留；
 * 视觉换成「下划线刻度制式」（规范 5.3）：1px 下边框 + 两端 7px 刻度脚（挂在
 * FormField 的 .bp-ctl 上）+ 聚焦转 accent + 错误走 role="alert"。
 * 新增 props 仅 `required`（可选，缺省 false —— 旧调用零改动）。
 * ⚠ 未做：select 的原生 caret 定制（规范 5.3 的右侧 12px caret）。原因是它只能用
 *   data-URI SVG，而 data-URI 里无法消费 CSS 变量，必然写死一个 hex ——
 *   与「组件内禁止裸 hex」的纪律冲突，故本轮保留原生 caret，已写进执行报告。
 */

import { cva, type VariantProps } from 'class-variance-authority';
import {
  Children,
  cloneElement,
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '../../lib/cn';

export const fieldVariants = cva(
  // 蓝图下划线刻度制式（规范 5.3）：控件**只留 1px 下边框**（其余三边走
  // `.bp-field` 的 zero 宽度），聚焦时下边框转 accent。上方圆角归零 ——
  // 圆角刻度只有 0 与 2px 两档（规范 2.5），输入框属「承载内容的件」，
  // 但下划线制式本身要求直角，故这里取 r0。
  //
  // ⚠ 两端的 7px「刻度脚」挂在 FormField 的 `.bp-ctl` 容器上而不是控件自己：
  //   `<input>` / `<select>` 是替换元素，伪元素不生效（textarea 可以，但三件套
  //   必须同形，否则同一张表单里两种表达）。裸控件（不套 FormField）因此没有刻度脚，
  //   这是规范 5.3 结构（field-label → .ctl → 控件 → .hint）的应有退化。
  'bp-field w-full outline-none transition-colors duration-150 ease-out ' +
    'disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      tone: {
        /** 内页：跟随主题变量。placeholder 交给 index.css 的全局规则统一处理。 */
        default: 'border-line text-ink focus:border-accent',
        /** 登录页：恒深色表面（dusk-* 一族），自带可读的占位符与品牌色聚焦环。 */
        onDark:
          'border-dusk-line bg-dusk-surface text-dusk-title placeholder:text-dusk-muted ' +
          'placeholder:opacity-100 focus:border-primary-lift focus:ring-2 focus:ring-primary-lift/45',
      },
      /**
       * ⚠ 叫 fieldSize 而不是 size：原生 <input size> / <select size> 是数字型的
       * 「以字符为单位的宽度」属性，与这里的档位同名会导致 TypeScript 直接报
       * TS2320（接口无法同时扩展两个同名不同型的属性）。改名后原生属性仍可用。
       */
      fieldSize: {
        sm: 'min-h-9 px-2 py-1.5 text-ui-sm',
        // 主控件触控底线 44px（规范 2.5）。
        md: 'min-h-11 px-3 py-2 text-sm',
        lg: 'min-h-12 px-4 py-3 text-reading',
      },
      invalid: {
        // 只改下边框：上/左/右本来就是 0 宽度，写 border-danger 会凭空长出三边。
        true: 'border-danger',
        false: '',
      },
    },
    defaultVariants: {
      tone: 'default',
      fieldSize: 'md',
      invalid: false,
    },
  },
);


type FieldBase = VariantProps<typeof fieldVariants>;

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldBase {}
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldBase {}
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldBase {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, tone, fieldSize, invalid, type = 'text', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(fieldVariants({ tone, fieldSize, invalid }), className)}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, tone, fieldSize, invalid, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      // resize-y：只允许纵向拉伸。横向拉会破坏列宽与左基线。
      className={cn(fieldVariants({ tone, fieldSize, invalid }), 'resize-y', className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, tone, fieldSize, invalid, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(fieldVariants({ tone, fieldSize, invalid }), className)}
      {...rest}
    />
  );
});

export interface FormFieldProps {
  /** 可见标签文字。`labelHidden` 为真时只留给读屏。 */
  label: string;
  /** 补充说明，绑到 aria-describedby。 */
  hint?: string;
  /** 错误信息。给了就同时置 aria-invalid 并把边框转成危险色。 */
  error?: string;
  /** 视觉上隐藏标签（登录页用 placeholder 承担标签的场景），但**不**删除关联。 */
  labelHidden?: boolean;
  /** 必填（规范 5.3 的 `.req`）：只加视觉星号与读屏「必填」，不做第二套校验。 */
  required?: boolean;
  className?: string;
  /**
   * 单个表单控件。FormField 会把 id / aria-describedby / aria-invalid 注入到它上面，
   * 所以必须是能透传 props 到原生元素的组件（本文件的 Input/Textarea/Select 都满足）。
   */
  children: ReactNode;
}

/**
 * 标签 + 控件 + 说明/错误的组合，负责把它们用 id 正确关联起来。
 *
 * 为什么用 cloneElement 注入而不是 render prop：调用点数量多（Attribution / Login /
 * SpaceCreateForm / ItemPaper 加起来 10+ 处），render prop 会让每处都写一遍
 * `{(ids) => <Input {...ids} />}`，噪音大且容易漏传。这里换取更短的调用点，
 * 代价是子元素必须是单个控件 —— 传多个子元素会由 Children.only 直接抛错，不会静默。
 */
export function FormField({
  label,
  hint,
  error,
  labelHidden = false,
  required = false,
  className,
  children,
}: FormFieldProps) {
  const generated = useId().replace(/:/g, '');
  const child = Children.only(children) as ReactElement<Record<string, unknown>>;

  // 调用方显式传的 id 优先，避免破坏外部已有的 htmlFor / 表单引用。
  const providedId = child.props.id;
  const controlId =
    typeof providedId === 'string' && providedId.length > 0 ? providedId : `field-${generated}`;

  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const control = cloneElement(child, {
    id: controlId,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    // ⚠ 必须**同时**注入 invalid 变体，不能只注 aria-invalid（2026-09-25 重构 P3 补）。
    // 收敛前这里只注 aria-invalid：读屏能听到「无效」，但边框颜色仍是普通态 ——
    // 也就是「同一件事有两半，只有一半接上了」。调用方还得自己再传一遍 invalid，
    // 漏传就得到一个「有红字错误提示 + 正常边框」的自相矛盾输入框。
    // 现在 error 一个入参同时决定：边框色、aria-invalid、以及错误文案的着色。
    invalid: error ? true : false,
  });

  return (
    <div className={className}>
      {/* 字段名走批注制式（规范 5.3）：等宽大写 + 字距。它是元信息不是正文。 */}
      <label
        htmlFor={controlId}
        className={cn(
          'block font-mono text-tok uppercase tracking-widest text-ink-soft',
          labelHidden && 'sr-only',
          error && 'text-danger',
        )}
      >
        {label}
        {required ? <span aria-hidden="true" className="ml-1 text-danger">*</span> : null}
      </label>
      {/* .bp-ctl：两端 7px 刻度脚的定位容器（规范 5.3）。控件自身的下划线
          由 fieldVariants 的 .bp-field 给。 */}
      <div className={cn('bp-ctl', !labelHidden && 'mt-1.5')}>
        {control}
        {/* 必填星的读屏版：视觉上的 * 是装饰，语义由这里给（不新增可见文案）。 */}
        {required ? <span className="sr-only">必填</span> : null}
      </div>
      {error ? (
        // role="alert"（规范 5.3）：错误文案要在出现时被读屏立即念出，
        // 而不是等用户再次 Tab 到它。
        <p id={errorId} role="alert" className="mt-1.5 text-ui-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 font-mono text-mono-xs tracking-wide text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

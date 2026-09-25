/**
 * UI 原语层出口（2026-09-25 视觉重构 P1b）
 *
 * 只放**与业务无关**的基础原语：颜色、尺寸、圆角、触控、无障碍契约都由它们定死。
 * 判断标准：如果一个东西只在某一个页面成立，它就不属于这里 —— 放页面里。
 *
 * 明确**不放**：
 *   · Box / Flex / Stack / Text 这类万能布局组件 —— 它们只是把 Tailwind 的
 *     className 换成 prop，可读性反而更差，而且会长成第二个 CSS；
 *   · 任何业务卡片（统计块、题卡、章节卡）—— 那是页面的私有版式，不是设计系统。
 *
 * 领域组件（EmptyState / PageSkeleton / ItemCard / ConfirmDialog / Toast /
 * ProgressBar / BandLegend）留在 src/components/ 原地不迁 —— 它们是领域件不是原语，
 * 迁进来会稀释这里的边界，而且改动 import 的收益远小于风险。
 */

export { Badge, badgeVariants, type BadgeProps } from './Badge';
export { Button, buttonVariants, type ButtonProps } from './Button';
export {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  cardVariants,
  type CardHeaderProps,
  type CardProps,
} from './Card';
export { IconButton, iconButtonVariants, type IconButtonProps } from './IconButton';
export {
  fieldVariants,
  FormField,
  Input,
  Select,
  Textarea,
  type FormFieldProps,
  type InputProps,
  type SelectProps,
  type TextareaProps,
} from './Input';
export {
  PageContainer,
  PageHeader,
  type PageContainerProps,
  type PageHeaderProps,
  type PageWidth,
} from './PageContainer';

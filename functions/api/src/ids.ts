/**
 * ID 生成（契约 §0 ID 前缀约定）
 *
 * 用户 `u_`、空间 `sp_`、证据事件 `evt_`、掌握度日志 `log_`、归因 `attr_`、
 * 对话 `dlg_`、识别任务 `rec_`；题目 `q_` 来自静态题库（不由本模块生成）。
 *
 * 形态：前缀 + base36 时间戳 + 两位自增序号 + 三位随机后缀。
 * 随机后缀用于跨进程/跨测试文件隔离（同一毫秒内多次生成也不重号）。
 */

export const ID_PREFIXES = ['u_', 'sp_', 'evt_', 'log_', 'attr_', 'dlg_', 'rec_'] as const;

export type IdPrefix = (typeof ID_PREFIXES)[number];

let counter = 0;

/** 生成带前缀的运行期 ID（如 `evt_...`）。 */
export function newId(prefix: IdPrefix): string {
  counter += 1;
  const ts = Date.now().toString(36);
  const seq = counter.toString(36).padStart(2, '0');
  const rand = Math.floor(Math.random() * 46655)
    .toString(36)
    .padStart(3, '0');
  return `${prefix}${ts}${seq}${rand}`;
}

/** 判断字符串是否带指定前缀（测试与防御性校验用）。 */
export function hasPrefix(value: unknown, prefix: IdPrefix): boolean {
  return typeof value === 'string' && value.startsWith(prefix);
}

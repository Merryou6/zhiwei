/**
 * 证据去重键（ALGORITHM §1）
 *
 * dedup_key = {user_id}:{space_id}:{kp}:{source}:{hour_bucket}
 * hour_bucket = floor(unix_ts / 3600)，同 key 1 小时内只计一次。
 * 本迭代只做纯构造与纯判断；查重落库（evidence_events.dedup_key 唯一索引）
 * 属调用方职责，见 DATA_SCHEMA §4.4。
 */

export type EvidenceSource = 'silent' | 'paper' | 'diagnose' | 'self_report';

export interface DedupKeyInput {
  userId: string;
  spaceId: string;
  /** 完整知识点 id（如 math.cz.quadratic.vertex_form） */
  kp: string;
  source: EvidenceSource;
  unixTs: number;
}

/** 小时桶长度（秒）。 */
export const SECONDS_PER_HOUR = 3600;

/** 小时桶：floor(unixTs / 3600)。 */
export function hourBucket(unixTs: number): number {
  return Math.floor(unixTs / SECONDS_PER_HOUR);
}

/** 构造去重键（五段，冒号分隔）。 */
export function buildDedupKey(input: DedupKeyInput): string {
  const { userId, spaceId, kp, source, unixTs } = input;
  return `${userId}:${spaceId}:${kp}:${source}:${hourBucket(unixTs)}`;
}

/** 纯判断：该键是否已出现过（幂等闸门的第一道判断）。 */
export function isDuplicateKey(seen: Set<string>, key: string): boolean {
  return seen.has(key);
}

/** 便捷判断：给定已见键集合与本次输入，是否属于重复提交（1 小时内同源同 kp）。 */
export function isDuplicateEvidence(seen: Set<string>, input: DedupKeyInput): boolean {
  return isDuplicateKey(seen, buildDedupKey(input));
}

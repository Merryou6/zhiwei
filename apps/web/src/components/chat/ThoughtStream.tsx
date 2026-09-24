/**
 * 思考流（打字机，D5b）——全屏页与右侧面板共用。
 *
 * 呈现服务端真实产出的 thought 文本：本地模式 = 确定性推理摘要，远程模式 = 模型自述。
 * 打字机只为「流式感」服务（后端不 delay、不伪造 ms）：
 *   - 按固定节拍逐字揭示，文本继续增长时自动追赶；
 *   - 系统开启「减弱动态效果」（prefersReducedMotion）时直接全文显示，不做动画；
 *   - 尚无文本且未结束 → 「正在整理思路…」骨架点。
 */

import { useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '../../lib/motion';

/** 揭示节拍（毫秒）与每拍字符数：中文短句约 2–3 秒走完，不拖节奏。 */
const REVEAL_INTERVAL_MS = 24;
const REVEAL_CHARS_PER_TICK = 2;

export interface ThoughtStreamProps {
  text: string;
  /** 本轮是否已结束（结束且揭示完毕 → 不再显示光标）。 */
  done: boolean;
}

export default function ThoughtStream({ text, done }: ThoughtStreamProps) {
  const [shown, setShown] = useState(0);
  const reduced = prefersReducedMotion();
  const textRef = useRef(text);
  textRef.current = text;

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => {
      setShown((value) => {
        const total = textRef.current.length;
        if (value >= total) return value; // 已追平：同值 setState 不触发重渲染
        return Math.min(total, value + REVEAL_CHARS_PER_TICK);
      });
    }, REVEAL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [reduced]);

  if (text.length === 0) {
    if (done) {
      return <p className="text-[13px] text-ink-soft">这一轮没有推理摘要。</p>;
    }
    return (
      <p className="flex items-center gap-1.5 text-[13px] text-ink-soft" role="status">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-soft/60" aria-hidden="true" />
        正在整理思路…
      </p>
    );
  }

  const visible = reduced ? text : text.slice(0, shown);
  const caughtUp = reduced || shown >= text.length;

  return (
    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
      {visible}
      {!done && !caughtUp ? (
        <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-accent" aria-hidden="true" />
      ) : null}
    </p>
  );
}

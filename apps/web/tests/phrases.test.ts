/**
 * 话术测试（PRD §6）
 *
 * 锁定：五类错误枚举与中文名齐全、四场景话术逐字照抄 PRD §6「说」列、全部面向学生的
 * 文案不含评判词（黑名单）。
 */

import { describe, expect, it } from 'vitest';

import {
  ERROR_TYPES,
  ERROR_TYPE_LABEL,
  ERROR_TYPE_NOTE,
  NO_ATTRIBUTION_TYPES,
  PHRASES,
  UI_TEXT,
  exitChannelText,
  hasJudgementWord,
} from '../src/lib/phrases';

describe('phrases · 五类错误类型（契约 §6 全局枚举）', () => {
  it('枚举五值与契约顺序一致，且中文名/解释齐备', () => {
    expect(ERROR_TYPES).toEqual([
      'prerequisite_gap',
      'concept_confusion',
      'method_gap',
      'procedural_slip',
      'misreading',
    ]);
    for (const type of ERROR_TYPES) {
      expect(ERROR_TYPE_LABEL[type]).toBeTruthy();
      expect(ERROR_TYPE_NOTE[type]).toBeTruthy();
    }
    expect(Object.keys(ERROR_TYPE_LABEL)).toHaveLength(5);
    expect(Object.keys(ERROR_TYPE_NOTE)).toHaveLength(5);
  });

  it('不进归因的两类 = procedural_slip / misreading（契约 §7 前置）', () => {
    expect([...NO_ATTRIBUTION_TYPES]).toEqual(['procedural_slip', 'misreading']);
  });
});

describe('phrases · PRD §6 四场景话术逐字照抄', () => {
  it('四场景「说」列文案逐字一致', () => {
    expect(PHRASES.weakKnowledgePoint).toBe('这一环还有点晃，我们再稳一下');
    expect(PHRASES.wrongAnswer).toBe('这个坑很常见，我们看看它是怎么来的');
    expect(PHRASES.attributionFound).toBe('找到啦——真正卡住你的是这里');
    expect(PHRASES.exitChannel).toBe('我们先往回看一眼 XX，那里可能是关键');
    expect(Object.keys(PHRASES)).toHaveLength(4);
  });

  it('四场景文案不含评判词（不说「你掌握很差 / 回答错误 / 检测到知识缺陷 / 你答不上来」）', () => {
    for (const text of Object.values(PHRASES)) {
      expect(hasJudgementWord(text)).toBe(false);
    }
    expect(hasJudgementWord('你掌握很差')).toBe(true);
    expect(hasJudgementWord('回答错误')).toBe(true);
    expect(hasJudgementWord('检测到知识缺陷')).toBe(true);
    expect(hasJudgementWord('你答不上来')).toBe(true);
  });

  it('退出话术可注入知识点名（XX 位替换）', () => {
    expect(exitChannelText('二次函数的顶点式')).toBe(
      '我们先往回看一眼「二次函数的顶点式」，那里可能是关键',
    );
  });

  it('其余界面话术同样不含评判词', () => {
    for (const text of Object.values(UI_TEXT)) {
      expect(hasJudgementWord(text)).toBe(false);
    }
  });
});

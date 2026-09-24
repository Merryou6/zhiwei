/**
 * 对话链路 trace 契约测试（services/chatTrace.ts，契约 §9 v1.3）
 *
 * 覆盖：工具名闭集与标签表（与契约 §9 对照表逐字一致）；阶段标签四值；
 * createTraceRecorder 的事件 → trace 步骤转换（phase / tool running→ok / thought）与顺序；
 * 工具 id 唯一递增；契约文档回归哨兵（v1.3 块存在 + v1.1 原文 delta 行仍在）。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PHASE_LABEL,
  TOOL_LABEL,
  createToolIdSeq,
  createTraceRecorder,
  phaseEvent,
  thoughtEvent,
  toolEvent,
} from '../src/services/chatTrace';
import type { ChatToolName } from '../src/services/chatTrace';
import { REPO_ROOT } from './helpers';

/** 契约 §9 v1.3「ToolName 与真实动作对照表」的闭集（逐字，测试即契约副本）。 */
const TOOL_NAMES: ChatToolName[] = [
  'load_graph',
  'model_call',
  'kp_match',
  'dedup_check',
  'apply_evidence',
  'state_machine',
  'exit_channel',
];

describe('chatTrace · 契约 v1.3 标签表', () => {
  it('TOOL_LABEL 键集 === 契约工具名闭集（7 项），标签逐字一致', () => {
    expect(Object.keys(TOOL_LABEL).sort()).toEqual([...TOOL_NAMES].sort());
    expect(TOOL_LABEL).toEqual({
      load_graph: '加载知识图谱',
      model_call: '调用对话模型',
      kp_match: '知识点匹配与采纳',
      dedup_check: '弱负证据去重检查',
      apply_evidence: '写入证据与掌握度',
      state_machine: '状态机判定',
      exit_channel: '退出通道·上游回溯',
    });
  });

  it('PHASE_LABEL 四值（analyze/retrieve/judge/generate → 分析/检索/判定/生成）', () => {
    expect(PHASE_LABEL).toEqual({
      analyze: '分析',
      retrieve: '检索',
      judge: '判定',
      generate: '生成',
    });
  });
});

describe('chatTrace · createTraceRecorder（JSON 降级路径）', () => {
  it('phase / tool(running→ok) / thought 事件转 trace：顺序与形态正确', () => {
    const recorder = createTraceRecorder();

    recorder.event(phaseEvent('analyze'));
    const id = recorder.toolId();
    recorder.event(toolEvent({ id, name: 'load_graph', status: 'ok', args: { kb: 'kb_math_cz', node_count: 20 }, ms: 0.42 }));
    recorder.event(thoughtEvent('学生这句话匹配到知识点「顶点式」'));
    recorder.event({ event: 'delta', data: { text: '增量文本不进 trace' } });
    const id2 = recorder.toolId();
    recorder.event(toolEvent({ id: id2, name: 'model_call', status: 'running', args: { mode: 'remote' } }));
    recorder.event(toolEvent({ id: id2, name: 'model_call', status: 'ok', result: { kp_id: 'math.cz.quadratic.vertex_form', confidence: 0.85, progress: false }, ms: 812.3 }));

    expect(recorder.steps()).toEqual([
      { type: 'phase', name: 'analyze', label: '分析' },
      {
        type: 'tool',
        id: 'step_1',
        name: 'load_graph',
        label: '加载知识图谱',
        status: 'ok',
        args: { kb: 'kb_math_cz', node_count: 20 },
        ms: 0.42,
      },
      { type: 'thought', text: '学生这句话匹配到知识点「顶点式」' },
      {
        type: 'tool',
        id: 'step_2',
        name: 'model_call',
        label: '调用对话模型',
        status: 'running',
        args: { mode: 'remote' },
      },
      {
        type: 'tool',
        id: 'step_2',
        name: 'model_call',
        label: '调用对话模型',
        status: 'ok',
        result: { kp_id: 'math.cz.quadratic.vertex_form', confidence: 0.85, progress: false },
        ms: 812.3,
      },
    ]);
    // tool 步骤是**扁平**形态（契约 §9 3.3：type/id/name/label/status/args/result/ms 同层）
    expect(Object.keys(recorder.steps()[1]).sort()).toEqual(
      ['args', 'id', 'label', 'ms', 'name', 'status', 'type'].sort(),
    );
  });

  it('toolEvent 的 label 由 TOOL_LABEL 填充（禁止手写漂移）', () => {
    const ev = toolEvent({ id: 'step_1', name: 'exit_channel', status: 'ok' });
    expect(ev.data.label).toBe(TOOL_LABEL.exit_channel);
  });

  it('工具 id 唯一递增（step_1、step_2、step_3…）', () => {
    const seq = createToolIdSeq();
    expect([seq(), seq(), seq()]).toEqual(['step_1', 'step_2', 'step_3']);

    const recorder = createTraceRecorder();
    expect([recorder.toolId(), recorder.toolId()]).toEqual(['step_1', 'step_2']);
  });
});

describe('chatTrace · 契约文档回归哨兵（只增不删）', () => {
  const contract = readFileSync(resolve(REPO_ROOT, 'API_CONTRACT.md'), 'utf8');

  it('§9 含 v1.3 变更块，且 v1.1 原文 delta 行仍在（未被改写/删除）', () => {
    expect(contract).toContain('**v1.3 变更（2026-09-24');
    expect(contract).toContain('  event: delta   data: { "text": "增量文本" }');
    expect(contract).toContain('  event: meta    data: { "dialog_id"');
    expect(contract).toContain('  event: done    data: { }');
    expect(contract).toContain('降级: SSE 中断时退化为普通 JSON');
  });

  it('§11 变更记录追加 v1.3 一行（v1.0–v1.2 三行原样保留）', () => {
    expect(contract).toContain('**v1.3**：① #18 /api/agent/chat 新增 SSE 过程事件 phase / thought /');
    expect(contract).toContain('| 2026-09-19 | 初版冻结');
    expect(contract).toContain('**自审修订 v1.1**');
    expect(contract).toContain('**v1.2**');
  });
});

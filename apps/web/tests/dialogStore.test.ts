// @vitest-environment jsdom
/**
 * 对话 store 支撑测试（stores/dialog.ts，v1.3 过程链路）
 *
 * 覆盖：appendThought 增量拼接；upsertTool 按 id 覆盖（running → ok 不重复插卡，缺省字段沿用）；
 * setPhase；startAssistant 清空上一轮链路（只保留最新一轮）；finishAssistant / failAssistant
 * 不清链路（跑完仍可见）；reset / resetTrace。
 */

import { afterEach, describe, expect, it } from 'vitest';

import type { ChatMeta, ChatToolStep } from '../src/api/types';
import { useDialogStore } from '../src/stores/dialog';

const META: ChatMeta = {
  dialog_id: 'dlg_1',
  kp_match: { kp_id: 'math.cz.quadratic.vertex_form', confidence: 0.85 },
  progress: false,
  progress_reason: '学生仍未能给出有效一步',
  next_action: 'continue',
};

const RUNNING: ChatToolStep = {
  id: 'step_2',
  name: 'model_call',
  label: '调用对话模型',
  status: 'running',
  args: { mode: 'remote' },
};

const OK: ChatToolStep = {
  id: 'step_2',
  name: 'model_call',
  label: '调用对话模型',
  status: 'ok',
  args: { mode: 'remote' },
  result: { kp_id: 'math.cz.quadratic.vertex_form', confidence: 0.9, progress: false },
  ms: 12.5,
};

afterEach(() => {
  useDialogStore.getState().reset();
});

describe('dialog store · 过程链路（v1.3）', () => {
  it('appendThought 增量拼接（多段即完整思考）', () => {
    const store = useDialogStore.getState();
    store.appendThought('学生这句话匹配到');
    store.appendThought('知识点「二次函数的顶点式」');

    expect(useDialogStore.getState().thought).toBe('学生这句话匹配到知识点「二次函数的顶点式」');
  });

  it('upsertTool：同 id 覆盖不重复插卡（running → ok）', () => {
    const store = useDialogStore.getState();
    store.upsertTool({ ...RUNNING, id: 'step_1', name: 'load_graph', label: '加载知识图谱', status: 'ok' });
    store.upsertTool(RUNNING);
    expect(useDialogStore.getState().toolSteps).toHaveLength(2);

    useDialogStore.getState().upsertTool(OK);
    const steps = useDialogStore.getState().toolSteps;
    expect(steps).toHaveLength(2);
    expect(steps[1].status).toBe('ok');
    expect(steps[1].result).toEqual({ kp_id: 'math.cz.quadratic.vertex_form', confidence: 0.9, progress: false });
    expect(steps[1].ms).toBe(12.5);
    expect(steps[0].name).toBe('load_graph');
  });

  it('upsertTool：终态事件缺字段时沿用上一条（args 不丢）', () => {
    const store = useDialogStore.getState();
    store.upsertTool(RUNNING);
    store.upsertTool({ id: 'step_2', name: 'model_call', label: '调用对话模型', status: 'error' });

    const [step] = useDialogStore.getState().toolSteps;
    expect(step.status).toBe('error');
    expect(step.args).toEqual({ mode: 'remote' });
  });

  it('setPhase 记录当前阶段（后到的覆盖）', () => {
    const store = useDialogStore.getState();
    store.setPhase({ name: 'analyze', label: '分析' });
    expect(useDialogStore.getState().phase).toEqual({ name: 'analyze', label: '分析' });

    useDialogStore.getState().setPhase({ name: 'judge', label: '判定' });
    expect(useDialogStore.getState().phase).toEqual({ name: 'judge', label: '判定' });
  });

  it('startAssistant 清空上一轮链路（D10：只保留最新一轮），streaming 置真', () => {
    const firstId = useDialogStore.getState().startAssistant();
    useDialogStore.getState().appendThought('上一轮的思考');
    useDialogStore.getState().upsertTool(OK);
    useDialogStore.getState().setPhase({ name: 'generate', label: '生成' });
    useDialogStore.getState().finishAssistant(firstId);
    expect(useDialogStore.getState().thought).toBe('上一轮的思考');

    useDialogStore.getState().startAssistant();

    const after = useDialogStore.getState();
    expect(after.thought).toBe('');
    expect(after.toolSteps).toEqual([]);
    expect(after.phase).toBeNull();
    expect(after.streaming).toBe(true);
  });

  it('finishAssistant / failAssistant 不清链路（过程跑完后仍可见）', () => {
    const id = useDialogStore.getState().startAssistant();
    useDialogStore.getState().appendThought('写入弱负证据：掌握度 0.5 → 0.45');
    useDialogStore.getState().upsertTool(OK);

    useDialogStore.getState().finishAssistant(id);
    expect(useDialogStore.getState().streaming).toBe(false);
    expect(useDialogStore.getState().thought).toBe('写入弱负证据：掌握度 0.5 → 0.45');
    expect(useDialogStore.getState().toolSteps).toHaveLength(1);

    const failedId = useDialogStore.getState().startAssistant();
    useDialogStore.getState().appendThought('半截文本保留');
    useDialogStore.getState().failAssistant(failedId, '对话服务暂时不可用');
    expect(useDialogStore.getState().thought).toBe('半截文本保留');
  });

  it('resetTrace 只清链路；reset 清空全部状态（含链路与 meta）', () => {
    const store = useDialogStore.getState();
    store.setMeta(META);
    store.appendThought('甲');
    store.upsertTool(OK);
    store.setPhase({ name: 'retrieve', label: '检索' });

    useDialogStore.getState().resetTrace();
    expect(useDialogStore.getState().thought).toBe('');
    expect(useDialogStore.getState().toolSteps).toEqual([]);
    expect(useDialogStore.getState().phase).toBeNull();
    expect(useDialogStore.getState().meta?.dialog_id).toBe('dlg_1');

    useDialogStore.getState().setMeta(META);
    useDialogStore.getState().appendThought('乙');
    useDialogStore.getState().reset();
    const cleared = useDialogStore.getState();
    expect(cleared.messages).toEqual([]);
    expect(cleared.meta).toBeNull();
    expect(cleared.dialogId).toBeNull();
    expect(cleared.thought).toBe('');
    expect(cleared.toolSteps).toEqual([]);
    expect(cleared.phase).toBeNull();
    expect(cleared.streaming).toBe(false);
  });
});

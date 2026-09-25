/**
 * 页 6 · 对话辅导（SSE 流式；P0 #8）
 *
 * 契约：#18 POST /api/agent/chat（Content-Type: text/event-stream）
 *       事件序列（v1.3）：phase/thought/tool 过程事件 → delta（≥1 段）→ meta → done；
 *       Accept 为 json 时返回 { reply, meta, trace }。
 * 交互：学长左 / 学生右；delta 增量追加渲染；流式期间禁发；meta 只读不自行判断——
 *   - kp_match.confidence < 0.6 → 学长气泡下加浅色注脚「我不太确定说的是哪个知识点…」（对应服务端 clarify 行为）
 *   - next_action=hint_down → 气泡标「方向提示」徽标
 *   - next_action=exit_channel → 显著退出提示条（PRD §6 话术「我们先往回看一眼「XX」」）+ 去图谱链接
 * 「传图读题」为演示态（D15）：本地无云存储直传接口，弹预置文件选择器，选中后以 image_file_id 随消息发送，
 * 按钮旁标注「演示态」，不伪造上传假象。
 * 降级（D5）：流中断 → sse.ts 自动 JSON 重发一次（携 trace 时按序重放过程事件）→ 仍失败出错误气泡，页面永不白屏。
 *
 * v1.3 本页瘦身为**布局壳**（D11）：消息流 / 输入区 / 思考流 / 工具时间轴 / 模型徽标
 * 全部来自 components/chat 的共享组件，与右侧常驻面板（ChatPanel）是同一套实现；
 * 本页只负责宽度、两栏/堆叠与「收进侧栏」入口。文案与交互语义与 v1.2 一致。
 */

import { Link, useNavigate } from 'react-router-dom';

import ChatComposer from '../components/chat/ChatComposer';
import ChatMessageList from '../components/chat/ChatMessageList';
import ChatTracePanel from '../components/chat/ChatTracePanel';
import { Button, PageContainer, PageHeader, buttonVariants } from '../components/ui';
import { cn } from '../lib/cn';
import ModelBadge, { useModelInfo } from '../components/chat/ModelBadge';
import { kpName } from '../data/graphSnapshot';
import { exitChannelText } from '../lib/phrases';
import { CONSOLE_PATH, SPACES_PATH } from '../router';
import { useChatPanelStore } from '../stores/chatPanel';
import { useDialogStore } from '../stores/dialog';
import { useSpaceStore } from '../stores/space';

export default function ChatPage() {
  const store = useDialogStore();
  const model = useModelInfo();
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const panelOpen = useChatPanelStore((state) => state.open);
  const setPanelOpen = useChatPanelStore((state) => state.setOpen);
  const navigate = useNavigate();

  const meta = store.meta;
  const exitNotice =
    meta?.next_action === 'exit_channel' ? exitChannelText(kpName(meta.kp_match.kp_id)) : null;

  return (
    <PageContainer width="wide">
      {/* 版式接 PageHeader（2026-09-25 重构 P3）：原来是自己拼的 header + text-xl 标题。
          模型徽标走 children（标题下方的补充行），右侧操作区整体包一层 flex-col —— 
          原实现是「按钮 + 说明小字」竖排，PageHeader 的 actions 是横排容器，
          所以自己管竖排。 */}
      <PageHeader
        title="跟学长聊两句"
        description="卡在哪一步就说哪一步，写半句也行。我不会直接给你答案，会先陪你把思路接上。"
        actions={
          <div className="flex shrink-0 flex-col items-end gap-1">
            {meta ? (
              <span className="font-mono text-ui-sm tabular-nums text-ink-soft">
                这轮在聊：{kpName(meta.kp_match.kp_id)}（
                {Math.round(meta.kp_match.confidence * 100)}%）
              </span>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                // 「收进侧栏」：打开右侧面板并回到工作台，对话上下文随全局 store 一起带走
                setPanelOpen(true);
                navigate(CONSOLE_PATH);
              }}
            >
              收进侧栏
            </Button>
            {/* 清尾轮 L2：原 `text-ink-soft/80` 浅色实测 3.45:1（半透明降级），不达 AA → 纯 text-ink-soft 5.41:1 */}
            <span className="text-caption text-ink-soft">
              收进侧栏后，任何页面都能接着聊（现在：{panelOpen ? '侧栏已展开' : '侧栏未展开'}）
            </span>
          </div>
        }
      >
        <div className="mt-2">
          <ModelBadge mode={model?.mode ?? 'local'} name={model?.name ?? null} />
        </div>
      </PageHeader>

      {exitNotice ? (
        <div className="mt-4 rounded-surface border border-band-weak bg-band-weak/10 px-4 py-3 text-sm text-ink">
          <p className="font-medium">{exitNotice}</p>
          <p className="mt-1 text-ui-sm text-ink-soft">
            连续几轮都没往前走，多半是更前面的砖没铺稳——我们回去补那一块，不丢人。
          </p>
          <Link
            to={`/graph?path=${encodeURIComponent(meta?.kp_match.kp_id ?? '')}`}
            className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'mt-2')}
          >
            去图谱看看这一环
          </Link>
        </div>
      ) : null}

      {/* 宽屏两栏（左消息流 / 右链路）；<720 上下堆叠，链路折叠为手风琴（D5f） */}
      <div className="mt-5 grid grid-cols-1 items-start gap-5 nav:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
        {/* max-w-2xl 是**列宽**约束不是页面宽度：它与 PageContainer 的 prose 档同值（672），
            但语义不同 —— 它是「消息列不该长到难以阅读」，因此保留在这里而不是上提。 */}
        <div className="min-w-0 max-w-2xl">
          <ChatMessageList messages={store.messages} streaming={store.streaming} />
          <ChatComposer disabled={store.streaming} />

          <p className="mt-3 text-ui-sm text-ink-soft">
            {activeSpaceId ? '' : `还没有空间，`}
            <Link to={SPACES_PATH} className="underline">
              {activeSpaceId ? '空间与进度' : '先去建一个空间'}
            </Link>
            {' · '}
            <Link to="/graph" className="underline">
              看看我的地图
            </Link>
          </p>
        </div>

        <ChatTracePanel
          thought={store.thought}
          toolSteps={store.toolSteps}
          phase={store.phase}
          streaming={store.streaming}
          mode={model?.mode ?? 'local'}
        />
      </div>
    </PageContainer>
  );
}

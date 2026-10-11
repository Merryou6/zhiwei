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
 *
 * ── style-10「青蓝蓝图」迁移 P8.2（2026-10-11 第 4 轮）：/chat 视觉层按原型 PAGES.chat
 *    （tempui/prototypes/style-10/index.html L2523-2604）逐段复现，**业务逻辑一行不改**：
 *   ① 页头 SheetHead：eyebrow「CHAT / 学长式引导」+ SHEET 10-09 + 需求 2.9 +
 *      h1「对话辅导：卡在哪一步就聊哪一步」+ chip「T0 · 双形态」；页头归页面自有
 *      （D24：Layout 的 PAGE_OWNED_HEAD 登记 '/chat'，外壳不再补第二份 h1）
 *   ② 01 本轮对象（原型 kp-bar L2532-2537 对位）：讨论对象 chip + 置信度 + 收进侧栏入口 +
 *      模型徽标；原型的「模式 seg」（专注/陪伴）是原型 mock 操作（S.flow.chat.mode），
 *      本工程无对应 store —— 按 D5「不引入 mock 交互」不迁移，留痕于执行报告
 *   ③ 02 消息流：气泡三制式（学生右 / 学长左 / 系统居中）、推理折叠与工具时间线由既有
 *      共享组件承载（ThoughtStream / ToolTimeline 的既有视觉 = 原型 .prog 口径）；
 *      停滞出口按原型 stall 用 amber Stamp（退出通道语义与既有 meta.next_action 一致）
 *   ④ 03 发送：ChatComposer 本体已随组件库（Textarea/Button 原语），本页补原型 .composer
 *      的细线分隔制式（.bp-composer）
 *   ⑤ 双栏档位（D4）：≥1180（annos）消息流 + 当轮链路双栏；≤1179 单栏堆叠（原 nav: 档换新档）
 *
 * 【四态（规范 §7 chat 行）】
 *   空集合（0 条消息）→ 共享件的 EmptyState 空盒（既有文案，D5）
 *   无空间 → guardPath 重定向（R19 取证口径；router.tsx 冻结）
 *   loading / error：本页无取数（对话在全局 store），失败落点是降级链末端的既有错误气泡
 *   （dialog store 冻结、发送链路一行不改）—— 未新增页面级红章，留痕见执行报告
 */

import { Link, useNavigate } from 'react-router-dom';

import ChatComposer from '../components/chat/ChatComposer';
import ChatMessageList from '../components/chat/ChatMessageList';
import ChatTracePanel from '../components/chat/ChatTracePanel';
import { Badge, Button } from '../components/ui';
import { useBlueprintTier } from '../components/blueprint/Board';
import { SheetBlock, SheetHead, sheetDimText } from '../components/blueprint/Sheet';
import Stamp from '../components/blueprint/Stamp';
import { cn } from '../lib/cn';
import ModelBadge, { useModelInfo } from '../components/chat/ModelBadge';
import { kpName } from '../data/graphSnapshot';
import { exitChannelText } from '../lib/phrases';
import { ME_PATH, SPACES_PATH } from '../router';
import { useChatPanelStore } from '../stores/chatPanel';
import { useDialogStore } from '../stores/dialog';
import { useSpaceStore } from '../stores/space';

/** 模板页的固定元信息（原型 sheetHead 的图号与需求号，规范 §10 / 原件 2.9）。 */
const SHEET_NO = '10-09';
const SECTION_NO = '2.9';

/** 置信度低于此值 → 这一轮不下结论，先澄清（服务端 clarify 的前端对位口径）。 */
const CLARIFY_THRESHOLD = 0.6;

export default function ChatPage() {
  const store = useDialogStore();
  const model = useModelInfo();
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const panelOpen = useChatPanelStore((state) => state.open);
  const setPanelOpen = useChatPanelStore((state) => state.setOpen);
  const navigate = useNavigate();
  const tier = useBlueprintTier();

  const meta = store.meta;
  const confidence = meta?.kp_match.confidence ?? null;
  const exitNotice =
    meta?.next_action === 'exit_channel' ? exitChannelText(kpName(meta.kp_match.kp_id)) : null;
  const graphPath = `/graph?path=${encodeURIComponent(meta?.kp_match.kp_id ?? '')}`;

  return (
    <>
      {/* ① 页头（原型 L2535 sheetHead） */}
      <SheetHead
        eyebrow="CHAT / 学长式引导"
        sheetNo={SHEET_NO}
        section={SECTION_NO}
        title="对话辅导：卡在哪一步就聊哪一步"
        sub="卡在哪一步就说哪一步，写半句也行。我不会直接给你答案，会先陪你把思路接上。模型由服务端配置，收进侧栏或切回全屏都不丢上下文。"
        chips={<Badge tone="accent">T0 · 双形态</Badge>}
        dim={sheetDimText(tier)}
      />

      {/* ② 01 本轮对象（原型 kp-bar L2532-2537）：讨论对象 + 置信度 + 收进侧栏 + 模型徽标 */}
      <SheetBlock
        no="01"
        title="本轮对象"
        right={<ModelBadge mode={model?.mode ?? 'local'} name={model?.name ?? null} />}
      >
        <div className="bp-panel p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            {meta ? (
              <>
                <Badge tone="accent">{kpName(meta.kp_match.kp_id)}</Badge>
                <Badge tone={confidence !== null && confidence < CLARIFY_THRESHOLD ? 'warning' : 'positive'}>
                  置信度 {Math.round((confidence ?? 0) * 100)}%
                </Badge>
              </>
            ) : (
              <Badge>还没开始这一轮</Badge>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                // 「收进侧栏」：打开右侧面板并回到「我的」（学习概览所在页，v1.4 起
                // 旧控制台的概览并入那里），对话上下文随全局 store 一起带走
                setPanelOpen(true);
                navigate(ME_PATH);
              }}
            >
              收进侧栏
            </Button>
            <span className="text-caption text-ink-soft">
              收进侧栏后，任何页面都能接着聊（现在：{panelOpen ? '侧栏已展开' : '侧栏未展开'}）
            </span>
          </div>
          <p className="mt-2.5 text-ui-sm text-ink-soft">
            匹配置信度低于 {Math.round(CLARIFY_THRESHOLD * 100)}% 时，这一轮不下结论，我先问清你说的是哪个知识点。
          </p>
        </div>
      </SheetBlock>

      {/* ③④ 双栏（D4）：≥1180（annos）左消息流 / 右当轮链路；≤1179 单栏堆叠 */}
      <div className="grid grid-cols-1 items-start gap-5 annos:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
        {/* max-w-2xl 是**列宽**约束不是页面宽度（原注释保留）：消息列不该长到难以阅读。 */}
        <div className="min-w-0 max-w-2xl">
          <SheetBlock no="02" title="消息流" right={<Badge>{store.messages.length} 条</Badge>}>
            {/* 设计语言（包F）+ P8.2：消息流作用域壳。气泡入场动画与空态玻璃面锚定在共享
                组件 ChatMessageList 的 DOM 上（D11 共享组件不可改）；bp-thread 把原型的
                .thread/.msg 图纸制式同样作用域化到全屏页，右侧面板同款组件不受影响
                （配套样式见 index.css「/chat 页制式」段）。 */}
            <div className={cn('bp-thread chat-stream', store.messages.length === 0 && 'chat-stream-empty')}>
              <ChatMessageList messages={store.messages} streaming={store.streaming} />
            </div>

            {/* 思考指示（内页强调时刻）：流式期间消息流尾部三点呼吸，替代静态文字的过程感；
                共享组件 ChatMessageList（D11）不可改，故在页壳层补这个 busy 指示，
                aria-hidden 的圆点只给视觉，读屏走 sr-only 文本，发送流程零改动 */}
            {store.streaming ? (
              <p className="mt-2 flex items-center gap-1.5 text-ui-sm text-ink-soft">
                <span className="typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="sr-only">学长正在思考</span>
              </p>
            ) : null}

            {/* 停滞出口（原型 L2568-2570 stall stamp，amber 制式）：退出通道语义完全沿用既有
                meta.next_action=exit_channel + 既有话术（D5 文案不动），只换视觉。 */}
            {exitNotice ? (
              <Stamp
                className="mt-3.5"
                tone="amber"
                seal="STALL · 停滞"
                title="进展停滞 · 低压力退出"
                reason={
                  <>
                    {exitNotice}
                    连续几轮都没往前走，多半是更前面的砖没铺稳——我们回去补那一块，不丢人。
                  </>
                }
                alt={{ label: '去图谱看看这一环', to: graphPath }}
              />
            ) : null}

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
          </SheetBlock>

          {/* ④ 03 发送（原型 L2572-2578 composer）：输入区换原型「顶部细线 + 刻度控件」制式
              （原 glass-card 玻璃面按原型口径退场，聚焦辉光保留为「学长在听」的状态外化）。 */}
          <SheetBlock no="03" title="发送">
            <div className="bp-composer focus-glow">
              <ChatComposer disabled={store.streaming} />
            </div>
            <p className="mt-2 text-ui-sm text-ink-soft">
              卡住的那一步写半句也行；流式通道断了会自动转普通回复重试一次，草稿还在输入框里。
            </p>
          </SheetBlock>
        </div>

        <ChatTracePanel
          thought={store.thought}
          toolSteps={store.toolSteps}
          phase={store.phase}
          streaming={store.streaming}
          mode={model?.mode ?? 'local'}
        />
      </div>
    </>
  );
}

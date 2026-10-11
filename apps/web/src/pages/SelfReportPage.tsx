/**
 * 页 2 · 起点自报（PRD §5 #2「30 秒建先验 + 定主攻章节」；P0 #2）
 *
 * 契约：#6 POST /api/evidence/self-report（章节粒度 × 5 档，≤8 项（v1.4：页 2 全选用例必须过））
 * 交互：一屏一件事（8 张章节行 × 5 档单选，默认不选）+「按 3 档填」一键加速；
 *       提交后展示 updated（被写入先验的知识点数），并引导进测评（第一屏就让用户开始）。
 * 纪律：自报是先验不是观测（服务端不写 evidence_events）；此处不做任何对错/评价性措辞。
 *
 * ─────────────────────────────────────────────────────────────────────
 * style-10「青蓝蓝图」迁移 P10.3（2026-10-11 第 4 轮）：视觉层按原型 PAGES['self-report']
 * （tempui/prototypes/style-10/index.html L1999-2040）逐段复现，**业务逻辑一行不改**
 * （levels 状态、chosen 派生、handleSubmit 的三道守卫与 selfReport 调用、
 * markSelfReportDone 落盘、toast 话术、两处 navigate 目标全部原样）：
 *   ① 页头 SheetHead：eyebrow「SELF REPORT / 30 秒先验」+ SHEET 10-04 + 需求 2.4 +
 *     h1「起点自报：每章说一个档位」+ chip「T0」；页头归页面自有（D24：Layout 的
 *     PAGE_OWNED_HEAD 登记 '/self-report'，外壳不再补第二份 h1）
 *   ② 01 章节 × 五档（原型 L2024-2026）：细网格表（章节 / 你的感觉 / 已选）——
 *     每行一个 `.bp-seg` 五档单选（`01 几乎没学过` … `05 很熟`），右侧「已选」列
 *     给出当前档位 chip 或「未选」；分节右侧计数 chip「已选 n / 8 章」
 *   ③ 02 操作（原型 L2027-2032）：一键加速键（按中间档填好）+ 主键（提交自报）+
 *     可用状态 tok（「可提交 / 至少选一章」）
 *   ④ 已记录回执（原型 L2033-2036）：`.bp-stamp-ok` 绿章 + 更新点数 + 两条下一步出路
 *
 * 【四态】无（规范 §7 self-report 行明示：提交失败走 toast）—— 故本页不引入任何新状态位。
 *
 * 【与原型的两处口径差（见执行报告 D-P10.3-1）】
 *   · 原型「全部按中间档填好 / 清空重选」是一对 mock 辅助键；本工程只保留既有的
 *     「按 3 档填上」一键加速（QUICK_LEVEL=3，D12 口径），**不新增「清空重选」**——
 *     既有页面没有这个动作，加它就是新增行为，超出「表现层」范围。
 *   · 原型把「已记录」回执追加在表单下方；本工程既有状态机是 `updated !== null` 时
 *     **整页替换为回执**，该语义属业务分支，一行不改，只把回执本体按原型口径重绘。
 *   · 原型「一章都没选就提交」会插入一个琥珀色 BLOCKED 章（mock 的 F.tried 状态位）。
 *     本工程的既有语义是 **toast 警告 + 留在原地**（handleSubmit 的 `chosen.length === 0`
 *     守卫），不引入新状态位（规范 §7 self-report 行也是「提交失败走 toast」）；故 02
 *     区块只保留「可提交 / 至少选一章」的实时 tok，不新增章体。
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { selfReport } from '../api/endpoints';
import type { SelfReportLevel, SelfReportRow } from '../api/types';
import { Icon } from '../components/blueprint/icons';
import { SheetBlock, SheetHead, sheetDimText } from '../components/blueprint/Sheet';
import { useBlueprintTier } from '../components/blueprint/Board';
import { Badge, Button } from '../components/ui';
import { CHAPTER_SIZES, chapterNames } from '../data/graphSnapshot';
import { UI_TEXT } from '../lib/phrases';
import { SPACES_PATH, markSelfReportDone } from '../router';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

const LEVELS: { value: SelfReportLevel; label: string; hint: string }[] = [
  { value: 1, label: '1', hint: '几乎没学过' },
  { value: 2, label: '2', hint: '听过，不熟' },
  { value: 3, label: '3', hint: '会一点，会晃' },
  { value: 4, label: '4', hint: '比较稳' },
  { value: 5, label: '5', hint: '很熟' },
];

/** 一键加速档位（D12：避免全零掌握度导致测评立即收敛 INFO-1）。 */
const QUICK_LEVEL: SelfReportLevel = 3;

/** 图号与需求号（原型 sheetHead L2018 的 SHEET 10-04 / 需求 2.4）。 */
const SHEET_NO = '10-04';
const SECTION_NO = '2.4';

/** 档位序号制式（原型 two()）：01…05。 */
function levelNo(value: number): string {
  return String(value).padStart(2, '0');
}

export default function SelfReportPage() {
  const chapters = chapterNames();
  const [levels, setLevels] = useState<Record<string, SelfReportLevel>>({});
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState<number | null>(null);

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();
  const tier = useBlueprintTier();

  const chosen = chapters.filter((chapter) => levels[chapter] !== undefined);

  async function handleSubmit(): Promise<void> {
    if (submitting) return;
    if (!activeSpaceId) {
      toast('先选一个学习空间', 'warn');
      navigate(SPACES_PATH);
      return;
    }
    if (chosen.length === 0) {
      toast('至少选一个章节，或者点「按 3 档先填上」', 'warn');
      return;
    }

    const reports: SelfReportRow[] = chosen.map((chapter) => ({
      chapter,
      level: levels[chapter],
    }));

    setSubmitting(true);
    try {
      const data = await selfReport({ space_id: activeSpaceId, reports });
      setUpdated(data.updated);
      markSelfReportDone(activeSpaceId);
      toast(`已更新 ${data.updated} 个知识点的起点`);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  /** 页头（原型 sheetHead L2018）。**由页面自己渲染**：外壳对此页不再补通用页头
   *  （Layout 的 PAGE_OWNED_HEAD，D24）—— 否则一页会出现两个 h1。 */
  const pageHead = (
    <SheetHead
      eyebrow="SELF REPORT / 30 秒先验"
      sheetNo={SHEET_NO}
      section={SECTION_NO}
      title="起点自报：每章说一个档位"
      sub="这是最轻的采集方式。数字如实：本表单只写先验，不动已有证据算出的掌握度。"
      chips={<Badge>T0</Badge>}
      dim={sheetDimText(tier)}
    />
  );

  // ============================================================ 已记录态（原型 L2033-2036）
  if (updated !== null) {
    return (
      <>
        {pageHead}
        <SheetBlock no="03" title="已记录" right={<Badge tone="positive">RECEIVED</Badge>}>
          {/* role=status + aria-live=polite：与原型 L2033 的 stamp-ok 同口径 ——
              提交后整页换成回执，读屏需要被告知「结果变了」。 */}
          <div className="bp-stamp-ok p-4" role="status" aria-live="polite">
            <div className="flex items-center gap-2.5 font-mono text-ui-sm font-semibold tracking-widest text-band-mastered">
              <Icon name="tick" className="h-[18px] w-[18px]" />
              <span>自报已记录</span>
            </div>
            <p className="mt-2 max-w-[64ch] text-body-sm leading-relaxed text-ink-soft">
              已更新 <span className="num-mono text-ink">{updated}</span>{' '}
              个知识点的起点（作为先验参与计算，不覆盖测评与试卷证据）。接下来我出几道题，看看猜得准不准——
              你把会做的做掉就行，不用纠结对错，我这边只看整体。
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button onClick={() => navigate('/assessment')}>开始测评</Button>
              <Button variant="secondary" onClick={() => navigate('/graph')}>
                先看看我的地图
              </Button>
            </div>
          </div>
        </SheetBlock>
      </>
    );
  }

  // ============================================================ 作答态
  return (
    <>
      {pageHead}

      {/* ── 01 章节 × 五档（原型 L2024-2026）──────────────────────────── */}
      <SheetBlock
        no="01"
        title="章节 × 五档"
        right={
          <Badge tone={chosen.length > 0 ? 'accent' : 'neutral'}>
            {`已选 ${chosen.length} / ${chapters.length} 章`}
          </Badge>
        }
      >
        <p className="bp-note mb-3">
          五档里没有对错：它只形成初始先验，不产生评价，界面不出现判定与颜色警告。凭感觉选就行，30 秒够用。
        </p>
        <div className="bp-tbl-wrap">
          <table className="bp-tbl">
            <caption>档位口径 · 全站一致</caption>
            <thead>
              <tr>
                <th>章节</th>
                <th>你的感觉</th>
                <th>已选</th>
              </tr>
            </thead>
            <tbody>
              {chapters.map((chapter) => {
                const picked = levels[chapter];
                const pickedLevel = LEVELS.find((level) => level.value === picked);
                return (
                  <tr key={chapter}>
                    <td data-label="章节">
                      <span className="font-medium text-ink">{chapter}</span>
                      <br />
                      <span className="tok">{CHAPTER_SIZES[chapter] ?? 0} 个知识点</span>
                    </td>
                    <td data-label="你的感觉">
                      {/* 五档 = 分段选择制式（原型 .seg）：真控件是原生 radio，
                          选中态与焦点环由 :has() 表达，不自绘、不重造键盘语义。 */}
                      <div className="bp-seg" role="radiogroup" aria-label={`${chapter} 掌握档位`}>
                        {LEVELS.map((level) => (
                          <label key={level.value}>
                            <input
                              type="radio"
                              name={`sr-${chapter}`}
                              value={level.value}
                              checked={picked === level.value}
                              onChange={() => setLevels({ ...levels, [chapter]: level.value })}
                            />
                            <span className="bp-seg__n">{levelNo(level.value)}</span>
                            <span>{level.hint}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td data-label="已选" className="n">
                      {pickedLevel ? (
                        <Badge tone="accent">{`${levelNo(pickedLevel.value)} ${pickedLevel.hint}`}</Badge>
                      ) : (
                        <span className="tok">未选</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SheetBlock>

      {/* ── 02 操作（原型 L2027-2032）────────────────────────────────── */}
      <SheetBlock no="02" title="操作">
        <div className="flex flex-wrap items-center gap-3">
          {/* 按钮文案保持既有「按 3 档先填上」：handleSubmit 的守卫话术里逐字引用了这个
              名字（「至少选一个章节，或者点『按 3 档先填上』」），改按钮不改话术会得到一对
              对不上的指路文案 —— 原型那句「全部按中间档填好」表达的是同一件事，其档位
              信息（03 会一点，会晃）由右侧 tok 承担。 */}
          <Button
            variant="secondary"
            onClick={() =>
              setLevels(Object.fromEntries(chapters.map((chapter) => [chapter, QUICK_LEVEL])))
            }
          >
            <Icon name="layers" />
            按 3 档先填上
          </Button>
          <span className="tok">{`${levelNo(QUICK_LEVEL)} 会一点，会晃`}</span>
          <Button loading={submitting} onClick={() => void handleSubmit()}>
            <Icon name="download" />
            {submitting ? '正在记下…' : '提交自报'}
          </Button>
          <span className="tok">{chosen.length > 0 ? '可提交' : '至少选一章'}</span>
        </div>
      </SheetBlock>
    </>
  );
}

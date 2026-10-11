/**
 * 页 13 · 冷启动分叉（v2.1「不刷题也能开始」）
 *
 * 战略：注册成功后不强制做题 —— 给两条建图路径让家庭自己选：
 *   A. 拍一张最近的试卷（推荐，零负担，一分钟建图）→ /paper
 *   B. 先做几道摸底题（原有 diagnose/baseline 链路）→ /assessment
 * 都不想现在做 → 先自报个大概（/self-report，原有起点自报）。
 *
 * 这是「拍搜工具 vs 学伴」差异在产品入口层的表达：第一屏就是「认识你」，不是「考你」。
 *
 * ─────────────────────────────────────────────────────────────────────
 * style-10「青蓝蓝图」迁移 P10.2（2026-10-11 第 4 轮）：视觉层按原型 PAGES['cold-start']
 * （tempui/prototypes/style-10/index.html L1974-1999）逐段复现，**业务逻辑一行不改**
 * （四个 navigate 目标 PAPER_PATH / ASSESSMENT_PATH / SELF_REPORT_PATH / '/graph'
 * 与各自的去向语义原样）：
 *   ① 页头 SheetHead：eyebrow「COLD START / 一次性引导」+ SHEET 10-03 + 需求 2.3 +
 *     h1「先选一条建立初始掌握度的路」+ chip「一次性」；页头归页面自有（D24：Layout 的
 *     PAGE_OWNED_HEAD 登记 '/start'，外壳不再补第二份 h1）
 *   ② 01 四条路径（原型 L1989-1990 / 卡片 L1978-1982）：.g2 两列（sheet 档起两列，
 *     窄档单列）四张 bp-panel 卡，每张 = 「NN · 主路径|次要路径」chip + 「时间 · 负担」
 *     tok + 标题 + 说明 + CTA「进入这一步」
 *   ③ 说明旁注（原型 L1991-1992）：采集不弹窗的纪律
 *   四态：无（静态引导页，规范 §7 明示）
 *
 * 【与原型的两处口径差（不照抄 mock，见执行报告 D-P10.2-1）】
 *   · 原型 sub 里嵌了「注册后已自动创建默认空间 <空间名>」，那名字来自原型的会话对象；
 *     本工程 /start 页不持有空间列表（store 由 /spaces 填充），**不为这一行新增取数或
 *     新增 store 订阅**，故 sub 只说「已自动创建默认空间」，不编一个空间名。
 *   · 原型说明末尾「回门户图」链接指向 /portal —— 本工程没有该路由，故不迁移那半句。
 */

import { useNavigate } from 'react-router-dom';

import { Icon } from '../components/blueprint/icons';
import { SheetBlock, SheetHead, sheetDimText } from '../components/blueprint/Sheet';
import { useBlueprintTier } from '../components/blueprint/Board';
import { Badge, Button } from '../components/ui';
import { ASSESSMENT_PATH, PAPER_PATH, SELF_REPORT_PATH } from '../router';

/** 图号与需求号（原型 sheetHead L1986 的 SHEET 10-03 / 需求 2.3）。 */
const SHEET_NO = '10-03';
const SECTION_NO = '2.3';

/**
 * 四条路径（原型 MOCK.coldStart L1063-1068 的四条，与既有页面去向**逐条对应**）：
 * 顺序即优先级 —— 前两条是主路径（原型 `i < 2 ? '主路径' : '次要路径'`），
 * 第一条（拍卷）是主按钮。
 */
const OPTIONS = [
  {
    no: '01',
    lane: '主路径',
    time: '约 1 分钟',
    burden: '零负担',
    to: PAPER_PATH,
    title: '拍一张最近的试卷',
    desc: '我按卷面错题建你的知识地图，一分钟就好——不用当场刷题。月考卷 / 答题卡 / 平时作业都行。',
    primary: true,
  },
  {
    no: '02',
    lane: '主路径',
    time: '约 10 分钟',
    burden: '轻度',
    to: ASSESSMENT_PATH,
    title: '先做几道摸底题',
    desc: '边做我边记：哪里稳、哪里晃，地图随着作答一格格亮起来。不当场告诉你对错。',
    primary: false,
  },
  {
    no: '03',
    lane: '次要路径',
    time: '约 30 秒',
    burden: '最轻',
    to: SELF_REPORT_PATH,
    title: '花 30 秒自报个大概',
    desc: '自己说个感觉，作为初始先验——不用做题，也不用手上有卷子。',
    primary: false,
  },
  {
    no: '04',
    lane: '次要路径',
    time: '随时',
    burden: '不采集',
    to: '/graph',
    title: '先去看看空白技能树',
    desc: '图谱现在是空的，进去逛逛不记任何证据——空图谱照常可读。',
    primary: false,
  },
] as const;

export default function StartPage() {
  const navigate = useNavigate();
  const tier = useBlueprintTier();

  /** 页头（原型 sheetHead L1986）。**由页面自己渲染**：外壳对此页不再补通用页头
   *  （Layout 的 PAGE_OWNED_HEAD，D24）—— 否则一页会出现两个 h1。 */
  const pageHead = (
    <SheetHead
      eyebrow="COLD START / 一次性引导"
      sheetNo={SHEET_NO}
      section={SECTION_NO}
      title="先选一条建立初始掌握度的路"
      sub="注册后已自动创建默认空间。这一步只决定用哪种方式采集第一批证据，四条任选、都不要求你先建好完整档案。"
      chips={<Badge>一次性</Badge>}
      dim={sheetDimText(tier)}
    />
  );

  return (
    <>
      {pageHead}

      {/* ── 01 四条路径（原型 L1989-1990）──────────────────────────────── */}
      <SheetBlock no="01" title="四条路径" right={<Badge>四条任选</Badge>}>
        <div className="grid grid-cols-1 gap-4 sheet:grid-cols-2">
          {OPTIONS.map((option) => (
            <article key={option.no} className="bp-panel flex flex-col p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge tone={option.primary ? 'accent' : 'neutral'}>
                  {`${option.no} · ${option.lane}`}
                </Badge>
                <span className="tok">{`${option.time} · ${option.burden}`}</span>
              </div>
              <h3 className="mt-2.5 font-disp text-title-sm tracking-tight text-ink">
                {option.title}
              </h3>
              <p className="mt-1.5 max-w-prose text-body-sm leading-relaxed text-ink-soft">
                {option.desc}
              </p>
              {/* mt-auto：四张卡的 CTA 齐底（卡片等高时按钮落在同一条基线上） */}
              <div className="mt-auto pt-3">
                <Button
                  full
                  variant={option.primary ? 'primary' : 'secondary'}
                  onClick={() => navigate(option.to)}
                >
                  <Icon name="arrow" />
                  进入这一步
                </Button>
              </div>
            </article>
          ))}
        </div>
      </SheetBlock>

      {/* ── 说明（原型 L1991-1992）：采集不弹窗的纪律 ─────────────────── */}
      <SheetBlock no="02" title="说明">
        <p className="bp-note mt-0">
          <Icon name="tick" className="mr-1.5 inline-block align-[-3px]" />
          采集不弹窗：这四条都是普通跳转，没有任何模态打断。选哪条都不会锁死——之后随时可以换另一条，两边都会记账。
        </p>
      </SheetBlock>
    </>
  );
}

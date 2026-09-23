/**
 * 页 3 · 学习空间列表（PRD §5 #3「默认已有空间；新建是次要按钮」；P0 #1）
 *
 * 契约：#3 GET /api/space/list、#4 POST /api/space/create
 *       409 → data={existing_space_id} → ConfirmDialog，**默认按钮「切换过去」**（契约 §2 明文）
 * 交互：主内容只放学习入口（主按钮按是否已自报切换文案）；空间管理本身是次要动作。
 *
 * 视图层：对齐 zhiwei-console pageSpace() 的外观（feature 主卡 + grid-3 其他空间 + feed 活动流），
 *         数据层（stores / api / endpoints / types）保持不动。
 * 说明：API 未返回知识点数/达标数/练习次数/活动流/掌握度分布，下列展示值为对齐控制台的估算与演示数据，
 *       已在注释中标注；接入真实报告接口后替换对应常量即可。
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { createSpace, listSpaces } from '../api/endpoints';
import type { SpaceCreateConflictData, SpaceView } from '../api/types';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import PageSkeleton from '../components/PageSkeleton';
import { formatTime } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
import { CONSOLE_PATH, SELF_REPORT_PATH, isSelfReportDone } from '../router';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

/** 可选学段（与 data/knowledge/index.json 的 stages 对应；新增学科在此扩）。 */
const STAGES = [
  { id: 'kb_math_cz', label: '初中数学' },
  { id: 'kb_math_gz', label: '高中数学' },
] as const;

/* --------------------------------------------------------- 内联 SVG 图标（对齐控制台 ICO） ---- */
function IconPlus() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}
function IconGrid() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.4" y="2.4" width="5.4" height="5.4" rx="1.4" />
      <rect x="10.2" y="2.4" width="5.4" height="5.4" rx="1.4" />
      <rect x="2.4" y="10.2" width="5.4" height="5.4" rx="1.4" />
      <rect x="10.2" y="10.2" width="5.4" height="5.4" rx="1.4" />
    </svg>
  );
}

/** 主按钮：按本机自报标记决定「开始自报」还是「进入测评」（第一屏就让用户开始）。 */
function primaryAction(space: SpaceView): { label: string; path: string } {
  return isSelfReportDone(space.space_id)
    ? { label: '进入测评', path: '/assessment' }
    : { label: '开始 30 秒自报', path: SELF_REPORT_PATH };
}

/** 知识库 id → 学段标签（卡片副标题用）。 */
function stageLabel(kbId: string | undefined): string {
  return STAGES.find((s) => s.id === kbId)?.label ?? '数学';
}

/* ------------------------------------------------- 估算/演示数据（API 未返回） ---- */
/** 由 space_id 派生一个稳定的掌握度 15–70%，用于其他空间卡片的 meter 展示。 */
function estimateMastery(spaceId: string): number {
  let h = 0;
  for (let i = 0; i < spaceId.length; i++) h = (h * 31 + spaceId.charCodeAt(i)) >>> 0;
  return 15 + (h % 56);
}
/** 掌握度 → 分段色带（对齐控制台 bandForLevel）。 */
function bandForLevel(level: number): 'solid' | 'basic' | 'waver' | 'weak' {
  return level >= 75 ? 'solid' : level >= 60 ? 'basic' : level >= 45 ? 'waver' : 'weak';
}
/** 当前空间掌握程度分布（演示：4 段比例，对齐控制台 segbar）。 */
const SEG_DIST = [
  { key: 'solid', label: '熟练', count: 12, flex: 12 },
  { key: 'basic', label: '达标', count: 18, flex: 18 },
  { key: 'waver', label: '波动', count: 9, flex: 9 },
  { key: 'weak', label: '待巩固', count: 6, flex: 6 },
] as const;
/** 最近活动流（演示数据：API 暂无活动流接口，格式对齐控制台 pageSpace 的 feed 数组）。 */
const FEED_DEMO = [
  { t: '今天 15:42', k: 'basic', text: '完成「顶点式」巩固练习 8 题', res: '6/8 正确' },
  { t: '今天 09:41', k: '', text: '上传 2026秋·九年级数学·第一次月考（含答案）.pdf', res: '已入云盘' },
  { t: '昨天 20:15', k: 'weak', text: '对话辅导：一般式与顶点式互化', res: '3 轮引导' },
  { t: '09-20 19:02', k: 'basic', text: '完成复测测量', res: '正确率 74%，+8pt' },
  { t: '09-18 14:26', k: 'weak', text: '完成诊断测评', res: '定位 3 个待巩固知识点' },
] as const;

export default function SpacesPage() {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [stage, setStage] = useState<(typeof STAGES)[number]['id']>('kb_math_cz');
  const [conflictSpaceId, setConflictSpaceId] = useState<string | null>(null);

  const spaces = useSpaceStore((state) => state.spaces);
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const setSpaces = useSpaceStore((state) => state.setSpaces);
  const setActive = useSpaceStore((state) => state.setActive);
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();

  async function load(): Promise<void> {
    try {
      const data = await listSpaces();
      setSpaces(data.spaces);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(): Promise<void> {
    if (creating) return;
    setCreating(true);
    try {
      const created = await createSpace({ knowledge_source: stage });
      toast(`已建好「${created.name}」`);
      setActive(created.space_id);
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.code === 409) {
        const data = error.data as SpaceCreateConflictData | null;
        if (data?.existing_space_id) setConflictSpaceId(data.existing_space_id);
        else toast(error.message, 'warn');
      } else {
        toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
      }
    } finally {
      setCreating(false);
    }
  }

  const active = spaces.find((s) => s.space_id === activeSpaceId) ?? null;
  const others = spaces.filter((s) => s.space_id !== activeSpaceId);
  const action = active ? primaryAction(active) : null;
  const totalKp = SEG_DIST.reduce((sum, b) => sum + b.count, 0);
  const masteredKp = SEG_DIST[0].count + SEG_DIST[1].count;

  return (
    <section>
      {/* 页头 */}
      <header className="page-head">
        <div>
          <h1 className="t-display">学习空间</h1>
          <p className="page-lead">
            每个空间对应一份独立的知识图谱与练习记录。切换空间不影响其他空间已有的进度。
          </p>
        </div>
        <div className="page-actions">
          {/* 学段选择：新建空间时决定挂哪个知识库（初中 / 高中） */}
          <div className="seg" role="group" aria-label="选择学段">
            {STAGES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStage(s.id)}
                aria-pressed={stage === s.id}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void handleCreate()}
            disabled={creating}
          >
            <IconPlus />
            {creating ? '正在新建…' : '新建空间'}
          </button>
          <Link to={CONSOLE_PATH} className="btn btn-ghost" style={{ textDecoration: 'none' }}>
            进入控制台
          </Link>
        </div>
      </header>

      {loading ? (
        <PageSkeleton label="正在取你的空间…" rows={2} />
      ) : !active ? (
        <div className="card card-pad" style={{ marginTop: 20 }}>
          <EmptyState
            title="还没有学习空间"
            hint="一个空间就是一个学科的知识地图。先建一个，我再按你的自报给你排学习顺序。"
            action={
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => void handleCreate()}
                disabled={creating}
              >
                {creating ? '正在新建…' : '新建学习空间'}
              </button>
            }
          />
        </div>
      ) : (
        <>
          {/* 主卡片：当前空间 */}
          <section className="feature">
            <div className="feature-main">
              <div className="feature-title">
                <h2 className="t-h2">{active.name}</h2>
                <span className="tag tag-accent">当前空间</span>
              </div>
              <p className="feature-desc">
                基于《义务教育课程标准》构建的知识图谱（{stageLabel(active.knowledge_source[0])}
                ），覆盖代数式、函数、方程等章节，共 {totalKp} 个知识点。
              </p>
              <dl className="feature-meta">
                <div>
                  <dt>知识点</dt>
                  <dd>{totalKp}</dd>
                </div>
                <div>
                  <dt>达标</dt>
                  <dd>{masteredKp}</dd>
                </div>
                <div>
                  <dt>累计练习</dt>
                  <dd>126 次</dd>
                </div>
                <div>
                  <dt>最近活动</dt>
                  <dd>3 小时前</dd>
                </div>
              </dl>
              <div className="feature-block">
                <div className="space-card-foot-row">
                  <span className="t-micro">掌握程度分布</span>
                  <span className="t-micro">
                    达标 {masteredKp} / {totalKp}
                  </span>
                </div>
                <div className="segbar">
                  {SEG_DIST.map((b) => (
                    <span
                      key={b.key}
                      className={`band-${b.key}`}
                      style={{ flex: b.flex, background: 'var(--band)' }}
                    />
                  ))}
                </div>
                <ul className="legend-inline">
                  {SEG_DIST.map((b) => (
                    <li key={b.key}>
                      <i className={`swatch swatch-${b.key}`} />
                      {b.label}
                      <span className="count">{b.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="feature-side">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => action && navigate(action.path)}
              >
                {action?.label}
              </button>
              <p className="feature-hint">12 道题 · 约 30 秒 · 实时更新图谱</p>
            </div>
          </section>

          {/* 其他空间 */}
          {others.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2 className="t-h2">其他空间</h2>
                <span className="section-note">{others.length} 个</span>
              </div>
              <div className="grid grid-3">
                {others.map((space) => {
                  const lv = estimateMastery(space.space_id);
                  const band = bandForLevel(lv);
                  return (
                    <article
                      key={space.space_id}
                      className="card card-hover space-card"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setActive(space.space_id)}
                    >
                      <div className="space-card-top">
                        <span className="space-icon">
                          <IconGrid />
                        </span>
                        <div>
                          <h3>{space.name}</h3>
                          <p className="space-card-desc">
                            {stageLabel(space.knowledge_source[0])} · 创建于 {formatTime(space.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="space-card-foot">
                        <div className="space-card-foot-row">
                          <span className="t-micro">掌握度</span>
                          <span className="space-card-pct">{lv}%</span>
                        </div>
                        <div className={`meter band-${band}`}>
                          <div className="meter-fill" style={{ width: `${lv}%` }} />
                        </div>
                        <div className="space-card-foot-row" style={{ margin: '9px 0 0' }}>
                          <span className="t-micro">切换到这个空间继续学习</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* 最近活动（演示数据） */}
          <section className="section">
            <div className="section-head">
              <h2 className="t-h2">最近活动</h2>
              <Link className="section-link" to="/report">
                查看学习报告
              </Link>
            </div>
            <div className="card">
              <ul className="feed">
                {FEED_DEMO.map((f, i) => (
                  <li key={i}>
                    <span className="feed-time">{f.t}</span>
                    <i className={f.k ? `feed-dot band-${f.k}` : 'feed-dot'} />
                    <span className="feed-text">{f.text}</span>
                    <span className="feed-result">{f.res}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        open={conflictSpaceId !== null}
        title="这个学科的空间已经有一个了"
        description="同一个学科只留一个空间，数据才不会分散。要切到已有的那个吗？"
        confirmLabel={UI_TEXT.switchToExisting}
        onCancel={() => setConflictSpaceId(null)}
        onConfirm={() => {
          if (conflictSpaceId) setActive(conflictSpaceId);
          setConflictSpaceId(null);
          void load();
        }}
      />
    </section>
  );
}

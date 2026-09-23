/**
 * 页 10 · 云盘（P1）—— 优化版
 *
 * 契约：#5 GET /api/space/{space_id}/drive
 * 交互：只读列表 + 统计卡片 + 快捷筛选 + 文件预览弹窗 + 搜索高亮
 *
 * 视图层：在 zhiwei-console 外观基础上增强——统计卡片、彩色文件图标、
 *         分类标签、快捷筛选、文件详情弹窗、搜索结果高亮。
 * 数据层（stores / api / endpoints / types）保持不动。
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { drive } from '../api/endpoints';
import type { DriveFileView } from '../api/types';
import { fileSize } from '../lib/format';
import EmptyState from '../components/EmptyState';
import PageSkeleton from '../components/PageSkeleton';
import { UI_TEXT } from '../lib/phrases';
import { SPACES_PATH } from '../router';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

/* --------------------------------------------------------- 内联 SVG 图标 ---- */
function IconUpload() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 11V2.6M4.8 5.8 8 2.6l3.2 3.2" />
      <path d="M2.6 10.4v1.8a1.8 1.8 0 0 0 1.8 1.8h7.2a1.8 1.8 0 0 0 1.8-1.8v-1.8" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.2" cy="7.2" r="4.4" />
      <path d="m10.6 10.6 2.9 2.9" />
    </svg>
  );
}
function IconFile() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.2 1.9H5.2a1.7 1.7 0 0 0-1.7 1.7v10.8a1.7 1.7 0 0 0 1.7 1.7h7.6a1.7 1.7 0 0 0 1.7-1.7V6.2z" />
      <path d="M10.2 1.9v4.3h4.3" />
    </svg>
  );
}
function IconDownload() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2.4v8M4.8 7.2 8 10.4l3.2-3.2" />
      <path d="M2.6 12.8h10.8" />
    </svg>
  );
}
function IconMore() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="3.4" cy="8" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="12.6" cy="8" r="1.3" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2H8v12H3.5A1.5 1.5 0 0 1 2 12.5z" />
      <path d="M14 3.5A1.5 1.5 0 0 0 12.5 2H8v12h4.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </svg>
  );
}

/* --------------------------------------------------------- 文件分类推断 ---- */
type FileCategory = '教材课标' | '知识点' | '公式' | '易错点' | '解题技巧' | '思维导图' | '学习规划' | '专项突破' | '竞赛拓展' | '趣味阅读';
type FileStage = '初中' | '高中' | '通用' | '课标';

function inferStage(name: string): FileStage {
  if (/高中|高考/.test(name)) return '高中';
  if (/初中|中考|九年级/.test(name)) return '初中';
  if (/课程标准|课标/.test(name)) return '课标';
  return '通用';
}

function inferCategory(name: string): FileCategory {
  if (/课程标准|教材|课标/.test(name)) return '教材课标';
  if (/易错|易错题/.test(name)) return '易错点';
  if (/解题|方法|技巧|辅助线/.test(name)) return '解题技巧';
  if (/思维导图/.test(name)) return '思维导图';
  if (/学习规划|进度表|复习计划/.test(name)) return '学习规划';
  if (/专项|导数|圆锥曲线|几何模型/.test(name)) return '专项突破';
  if (/竞赛/.test(name)) return '竞赛拓展';
  if (/趣味|文化/.test(name)) return '趣味阅读';
  if (/公式|定理|定律/.test(name)) return '公式';
  return '知识点';
}

const CATEGORY_COLORS: Record<FileCategory, { bg: string; text: string; icon: string }> = {
  '教材课标': { bg: 'rgba(91,141,239,0.15)', text: '#5B8DEF', icon: '#5B8DEF' },
  '知识点': { bg: 'rgba(78,203,113,0.15)', text: '#4ECB71', icon: '#4ECB71' },
  '公式': { bg: 'rgba(155,126,223,0.15)', text: '#9B7EDF', icon: '#9B7EDF' },
  '易错点': { bg: 'rgba(240,96,96,0.15)', text: '#F06060', icon: '#F06060' },
  '解题技巧': { bg: 'rgba(245,166,35,0.15)', text: '#F5A623', icon: '#F5A623' },
  '思维导图': { bg: 'rgba(62,201,194,0.15)', text: '#3EC9C2', icon: '#3EC9C2' },
  '学习规划': { bg: 'rgba(236,142,185,0.15)', text: '#EC8EB9', icon: '#EC8EB9' },
  '专项突破': { bg: 'rgba(255,138,101,0.15)', text: '#FF8A65', icon: '#FF8A65' },
  '竞赛拓展': { bg: 'rgba(121,134,203,0.15)', text: '#7986CB', icon: '#7986CB' },
  '趣味阅读': { bg: 'rgba(174,213,129,0.15)', text: '#AED581', icon: '#AED581' },
};

const STAGE_COLORS: Record<FileStage, string> = {
  '初中': '#4ECB71',
  '高中': '#5B8DEF',
  '通用': '#9B7EDF',
  '课标': '#F5A623',
};

/* --------------------------------------------------------- 快捷筛选标签 ---- */
const QUICK_FILTERS = [
  { key: 'all', label: '全部' },
  { key: '初中', label: '初中' },
  { key: '高中', label: '高中' },
  { key: '知识点', label: '知识点' },
  { key: '公式', label: '公式' },
  { key: '易错点', label: '易错点' },
  { key: '解题技巧', label: '解题技巧' },
  { key: '思维导图', label: '思维导图' },
] as const;

type QuickFilterKey = typeof QUICK_FILTERS[number]['key'];

/* --------------------------------------------------------- 搜索高亮 ---- */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(91,141,239,0.3)', color: 'inherit', padding: '0 2px', borderRadius: 3 }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/* --------------------------------------------------------- 主组件 ---- */
export default function DrivePage() {
  const [files, setFiles] = useState<DriveFileView[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>('all');
  const [query, setQuery] = useState('');
  const [previewFile, setPreviewFile] = useState<DriveFileView | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'category'>('name');

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const activeSpace = useSpaceStore((state) => state.spaces.find((s) => s.space_id === state.activeSpaceId) ?? null);
  const toast = useUiStore((state) => state.toast);

  useEffect(() => {
    if (!activeSpaceId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await drive(activeSpaceId);
        if (!cancelled) setFiles(data.files);
      } catch (error) {
        if (!cancelled) toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpaceId]);

  /* 统计数据 */
  const stats = useMemo(() => {
    const junior = files.filter(f => inferStage(f.name) === '初中').length;
    const senior = files.filter(f => inferStage(f.name) === '高中').length;
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    return {
      total: files.length,
      junior,
      senior,
      totalMB: (totalBytes / 1024 / 1024).toFixed(1),
    };
  }, [files]);

  /* 筛选 + 搜索 + 排序 */
  const visible = useMemo(() => {
    let result = files.filter((f) => {
      const stage = inferStage(f.name);
      const cat = inferCategory(f.name);
      if (quickFilter === '初中' && stage !== '初中') return false;
      if (quickFilter === '高中' && stage !== '高中') return false;
      if (['知识点', '公式', '易错点', '解题技巧', '思维导图'].includes(quickFilter) && cat !== quickFilter) return false;
      if (query && !f.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'zh-CN');
      if (sortBy === 'size') return b.size - a.size;
      return inferCategory(a.name).localeCompare(inferCategory(b.name), 'zh-CN');
    });
    return result;
  }, [files, quickFilter, query, sortBy]);

  if (!activeSpaceId) {
    return (
      <section>
        <header className="page-head">
          <div>
            <h1 className="t-display">云盘</h1>
            <p className="page-lead">存放测评试卷、错题整理与导出的学习报告。</p>
          </div>
        </header>
        <div className="card card-pad" style={{ marginTop: 20 }}>
          <EmptyState
            title="还没有选中的学习空间"
            hint="先选一个学习空间，我再告诉你这个学科有哪些资料。"
            action={
              <Link to={SPACES_PATH} className="btn btn-primary btn-lg" style={{ textDecoration: 'none' }}>
                去选空间
              </Link>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section>
      {/* 页头 */}
      <header className="page-head">
        <div>
          <h1 className="t-display">云盘</h1>
          <p className="page-lead">
            存放测评试卷、错题整理与导出的学习报告。上传的题目图片会被自动识别并归类到对应知识点。
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            title={UI_TEXT.driveComingSoon}
            onClick={() => toast(UI_TEXT.driveComingSoon)}
          >
            <IconUpload />
            上传
          </button>
        </div>
      </header>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        {[
          { label: '文件总数', value: stats.total, unit: '个', color: '#5B8DEF', icon: <IconFile /> },
          { label: '初中资料', value: stats.junior, unit: '份', color: '#4ECB71', icon: <IconBook /> },
          { label: '高中资料', value: stats.senior, unit: '份', color: '#9B7EDF', icon: <IconBook /> },
          { label: '总大小', value: stats.totalMB, unit: 'MB', color: '#F5A623', icon: <IconFile /> },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 10, background: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, fontFamily: 'var(--font-mono)' }}>
                {s.value}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 3 }}>{s.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 工具栏卡片 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="toolbar">
          <nav className="crumb" aria-label="路径">
            <span>云盘</span>
            <span className="crumb-sep">/</span>
            <span>{activeSpace?.name ?? '全部空间'}</span>
            <span className="crumb-sep">/</span>
            <b>全部文件</b>
          </nav>
          <span className="toolbar-sep" aria-hidden="true" />
          <div className="search" style={{ maxWidth: 240 }}>
            <IconSearch />
            <input
              type="search"
              placeholder="搜索文件名或知识点"
              aria-label="搜索文件"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'size' | 'category')}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', outline: 'none' }}
          >
            <option value="name">按名称排序</option>
            <option value="size">按大小排序</option>
            <option value="category">按分类排序</option>
          </select>
        </div>

        {/* 快捷筛选标签 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px 14px' }}>
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setQuickFilter(f.key)}
              style={{
                padding: '5px 14px',
                borderRadius: 16,
                fontSize: 12.5,
                fontWeight: quickFilter === f.key ? 600 : 400,
                border: '1px solid',
                borderColor: quickFilter === f.key ? 'var(--accent)' : 'var(--border-default)',
                background: quickFilter === f.key ? 'var(--accent-soft)' : 'transparent',
                color: quickFilter === f.key ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { if (quickFilter !== f.key) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; } }}
              onMouseLeave={(e) => { if (quickFilter !== f.key) { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 文件表格卡片 */}
      {loading ? (
        <PageSkeleton label="正在取文件列表…" rows={2} />
      ) : visible.length === 0 ? (
        <div className="card card-pad">
          <EmptyState
            title={files.length === 0 ? '这个空间暂时没有资料' : '没有匹配的文件'}
            hint={files.length === 0 ? '可以上传自己的学习资料，或等待系统预置资料更新。' : '试试换个关键词或筛选条件。'}
          />
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '42%' }}>文件名</th>
                <th style={{ width: '14%' }}>分类</th>
                <th style={{ width: '14%' }}>类型 · 大小</th>
                <th style={{ width: '12%' }}>学段</th>
                <th style={{ textAlign: 'right', width: '18%' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((file) => {
                const cat = inferCategory(file.name);
                const stage = inferStage(file.name);
                const colors = CATEGORY_COLORS[cat];
                return (
                  <tr key={file.file_id} style={{ cursor: 'pointer' }} onClick={() => setPreviewFile(file)}>
                    <td>
                      <div className="file-cell">
                        <span className="file-glyph" style={{ background: colors.bg, color: colors.icon, borderRadius: 8 }}>
                          <IconFile />
                        </span>
                        <div>
                          <div className="file-name">{highlightText(file.name, query)}</div>
                          <div className="file-path" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <span style={{
                              fontSize: 11, padding: '1px 7px', borderRadius: 4,
                              background: colors.bg, color: colors.text, fontWeight: 500,
                            }}>{cat}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12.5, color: colors.text, fontWeight: 500 }}>{cat}</span>
                    </td>
                    <td>
                      <span className="t-sub t-num">
                        {file.type.toUpperCase()} · {fileSize(file.size)}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 12, padding: '2px 10px', borderRadius: 10,
                        background: `${STAGE_COLORS[stage]}22`, color: STAGE_COLORS[stage],
                        fontWeight: 500,
                      }}>{stage}</span>
                    </td>
                    <td>
                      <span className="file-act" onClick={(e) => e.stopPropagation()}>
                        <button className="icon-btn" type="button" title="预览详情" onClick={() => setPreviewFile(file)}>
                          <IconBook />
                        </button>
                        <button className="icon-btn" type="button" title="下载" onClick={() => toast('下载即将开放', 'warn')}>
                          <IconDownload />
                        </button>
                        <button className="icon-btn" type="button" title="更多操作" onClick={() => toast('更多操作即将开放', 'warn')}>
                          <IconMore />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="table-foot">
            <span className="table-foot-note">
              显示 {visible.length} / {files.length} 个文件 · 共 {stats.totalMB} MB
            </span>
            <Link className="section-link" to="/report">
              导出全部学习报告
            </Link>
          </div>
        </div>
      )}

      {/* 文件预览弹窗 */}
      {previewFile && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="card"
            style={{ width: 480, maxWidth: '90vw', padding: 0, overflow: 'hidden', animation: 'slideUp 0.25s ease' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'flex-start', gap: 16,
              background: `linear-gradient(135deg, ${CATEGORY_COLORS[inferCategory(previewFile.name)].bg} 0%, transparent 60%)`,
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                background: CATEGORY_COLORS[inferCategory(previewFile.name)].bg,
                color: CATEGORY_COLORS[inferCategory(previewFile.name)].icon,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconFile />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, lineHeight: 1.4, wordBreak: 'break-all' }}>{previewFile.name}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: CATEGORY_COLORS[inferCategory(previewFile.name)].bg,
                    color: CATEGORY_COLORS[inferCategory(previewFile.name)].text, fontWeight: 500,
                  }}>{inferCategory(previewFile.name)}</span>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: `${STAGE_COLORS[inferStage(previewFile.name)]}22`,
                    color: STAGE_COLORS[inferStage(previewFile.name)], fontWeight: 500,
                  }}>{inferStage(previewFile.name)}</span>
                </div>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPreviewFile(null)}
                style={{ flexShrink: 0 }}
              >
                <IconClose />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>文件类型</div>
                  <div style={{ fontSize: 14, fontWeight: 500, textTransform: 'uppercase' }}>{previewFile.type}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>文件大小</div>
                  <div style={{ fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{fileSize(previewFile.size)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>适用学段</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: STAGE_COLORS[inferStage(previewFile.name)] }}>{inferStage(previewFile.name)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>资料分类</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: CATEGORY_COLORS[inferCategory(previewFile.name)].text }}>{inferCategory(previewFile.name)}</div>
                </div>
              </div>

              <div style={{
                background: 'var(--bg-card)', borderRadius: 8, padding: '14px 16px',
                borderLeft: '3px solid var(--accent)', marginBottom: 20,
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>资料简介</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                  本资料为「{inferStage(previewFile.name)}数学」{inferCategory(previewFile.name)}类学习资源，
                  涵盖核心知识点与典型例题，适合系统复习与考前冲刺使用。
                  建议配合知识图谱和学习报告使用，效果更佳。
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => toast('在线预览即将开放', 'warn')}
                >
                  在线预览
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => toast('下载即将开放', 'warn')}
                >
                  <IconDownload />
                  下载
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </section>
  );
}

/**
 * 页 10 · 云盘（P1）
 *
 * 契约：#5 GET /api/space/{space_id}/drive（预置课标 / 教材 + 用户文件；本地形态用户文件恒为空）
 * 交互：只读列表（file_id / name / type / size 人性化）+「上传」**禁用占位**
 *       （点击给非阻断 toast：PRD §3 P1 原文案「自定义知识库即将开放」）。
 * 不做真实上传（1.2 排除项：不写云存储直传）。
 *
 * 视图层：对齐 zhiwei-console pageDrive() 的外观（页头 + toolbar 面包屑/分段/搜索 + 文件表格），
 *         数据层（stores / api / endpoints / types）保持不动。
 * 说明：DriveFileView 仅含 file_id/name/type/size，来源与更新时间由文件名模式推断/占位，已注释标注。
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

/* --------------------------------------------------------- 内联 SVG 图标（对齐控制台 ICO） ---- */
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

/** 由文件名推断来源（API 未返回 source 字段）。 */
function inferSource(name: string): string {
  if (/报告|图谱说明|系统/.test(name)) return '系统生成';
  if (/期中|月考|模拟|讲义/.test(name)) return '我上传';
  return '我上传';
}
/** 由文件名推断 file-glyph 修饰类（对齐控制台 is-report / is-drill）。 */
function inferGlyph(name: string): string {
  if (/报告|图谱说明/.test(name)) return 'is-report';
  if (/练习|错题|训练|月考|配方法/.test(name)) return 'is-drill';
  return '';
}
/** 由文件名推断分类路径（file-path 副标题）。 */
function inferPath(name: string): string {
  if (/报告/.test(name)) return '学习报告';
  if (/错题/.test(name)) return '错题整理';
  if (/练习|训练|月考|期中|模拟/.test(name)) return '测评试卷';
  if (/讲义/.test(name)) return '课堂资料';
  return '资料';
}

type SegKey = 'all' | 'mine' | 'shared';

export default function DrivePage() {
  const [files, setFiles] = useState<DriveFileView[]>([]);
  const [loading, setLoading] = useState(true);
  const [seg, setSeg] = useState<SegKey>('all');
  const [query, setQuery] = useState('');

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

  /** 前端本地过滤（API 不支持筛选参数）：分段 + 搜索。 */
  const visible = useMemo(() => {
    return files.filter((f) => {
      if (seg === 'mine' && inferSource(f.name) !== '我上传') return false;
      if (seg === 'shared' && inferSource(f.name) !== '共享给我') return false;
      if (query && !f.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [files, seg, query]);

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const totalMB = (totalBytes / 1024 / 1024).toFixed(1);

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
          <div className="seg" role="group" aria-label="文件筛选">
            <button type="button" aria-pressed={seg === 'all'} onClick={() => setSeg('all')}>
              全部
            </button>
            <button type="button" aria-pressed={seg === 'mine'} onClick={() => setSeg('mine')}>
              我上传的
            </button>
            <button type="button" aria-pressed={seg === 'shared'} onClick={() => setSeg('shared')}>
              共享给我
            </button>
          </div>
          <div className="search">
            <IconSearch />
            <input
              type="search"
              placeholder="搜索文件名或知识点"
              aria-label="搜索文件"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 文件表格卡片 */}
      {loading ? (
        <PageSkeleton label="正在取文件列表…" rows={2} />
      ) : visible.length === 0 ? (
        <div className="card card-pad">
          <p className="t-sub">{files.length === 0 ? '这个空间暂时没有资料。' : '没有匹配的文件。'}</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>文件名</th>
                <th>类型 · 大小</th>
                <th>更新时间</th>
                <th>来源</th>
                <th style={{ textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((file) => (
                <tr key={file.file_id}>
                  <td>
                    <div className="file-cell">
                      <span className={`file-glyph ${inferGlyph(file.name)}`}>
                        <IconFile />
                      </span>
                      <div>
                        <div className="file-name">{file.name}</div>
                        <div className="file-path">{inferPath(file.name)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="t-sub t-num">
                      {file.type.toUpperCase()} · {fileSize(file.size)}
                    </span>
                  </td>
                  <td>
                    <span className="t-sub t-num">—</span>
                  </td>
                  <td>
                    <span className="t-sub">{inferSource(file.name)}</span>
                  </td>
                  <td>
                    <span className="file-act">
                      <button className="icon-btn" type="button" title="下载" onClick={() => toast('下载即将开放', 'warn')}>
                        <IconDownload />
                      </button>
                      <button className="icon-btn" type="button" title="更多操作" onClick={() => toast('更多操作即将开放', 'warn')}>
                        <IconMore />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-foot">
            <span className="table-foot-note">
              {visible.length} 个文件 · 共 {totalMB} MB
            </span>
            <Link className="section-link" to="/report">
              导出全部学习报告
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

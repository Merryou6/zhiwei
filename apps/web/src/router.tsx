/**
 * 前端路由表与守卫逻辑（D1：react-router-dom v6 + HashRouter）
 *
 * 本文件是**纯逻辑**：不含 JSX、不 import 任何页面组件（routerGuard.test.ts 直接 import 本文件断言，
 * 不拉起 echarts / react-dom）。页面装配在 App.tsx。
 *
 * 路由表 = 12 页（PRD §5 + 控制台工作台 + 「我的」）：登录/注册、自报、空间列表、控制台、测评、
 * 试卷上传、对话辅导、归因结果、知识图谱（兼学习路径）、学习报告、云盘（P1）、我的（v1.2）。
 * /console 为 B 端「教师 / 管理端」工作台首页（并入 apps/web 的真实控制台入口）。
 * /me 为账号辅助页（账号信息 / 当前空间 / 主题 / 模型只读），不进 PRD §5 学习主链路口径（D9）。
 * 查询参数约定：?mode=（测评）、?attribution_id=（归因回显）、?path=（图谱高亮）。
 */

export const LOGIN_PATH = '/login';
export const SPACES_PATH = '/spaces';
export const SELF_REPORT_PATH = '/self-report';
/** 控制台工作台首页（B 端教师 / 管理端入口，并入 apps/web 的真实控制台）。 */
export const CONSOLE_PATH = '/console';
/** 「我的」：账号信息 / 当前空间 / 主题 / 模型只读（v1.2 D4a，进顶栏主导航）。 */
export const ME_PATH = '/me';

/** localStorage 键（D2：仅 auth / space / theme 落盘，手动读写、不用 persist 中间件）。 */
export const STORAGE_KEYS = {
  token: 'zhiwei_token',
  userId: 'zhiwei_user_id',
  activeSpace: 'zhiwei_active_space',
  /** 主题偏好（D3）：'dark'（默认）| 'light'；index.html 内联脚本与本键同源。 */
  theme: 'zhiwei_theme',
  /** 自报完成标记：zhiwei_sr_done_<space_id>（空间页主按钮文案切换）。 */
  selfReportDonePrefix: 'zhiwei_sr_done_',
  /** 试卷识别 id（刷新回显用，sessionStorage）。 */
  recognition: 'zhiwei_recognition_id',
  /** 试卷错题缓存（归因向导第一步的错题来源，sessionStorage）。 */
  paperWrongPrefix: 'zhiwei_paper_wrong_',
} as const;

export interface RouteSpec {
  path: string;
  /** 页面名（顶栏 / 报告里的可读标签）。 */
  label: string;
  /** PRD §5 页面编号。 */
  page: number;
  /** 是否需要登录（false 仅登录页自身）。 */
  requiresAuth: boolean;
  /** 是否进顶栏主导航（空间管理不进首屏，故 /spaces 为 false）。 */
  nav: boolean;
}

/** 12 页路由表（顺序即顶栏顺序）。 */
export const ROUTES: readonly RouteSpec[] = [
  { path: LOGIN_PATH, label: '登录 / 注册', page: 1, requiresAuth: false, nav: false },
  { path: SELF_REPORT_PATH, label: '起点自报', page: 2, requiresAuth: true, nav: false },
  { path: SPACES_PATH, label: '学习空间', page: 3, requiresAuth: true, nav: false },
  { path: CONSOLE_PATH, label: '控制台', page: 11, requiresAuth: true, nav: false },
  { path: '/assessment', label: '测评', page: 4, requiresAuth: true, nav: true },
  { path: '/paper', label: '试卷上传', page: 5, requiresAuth: true, nav: false },
  { path: '/chat', label: '对话辅导', page: 6, requiresAuth: true, nav: true },
  { path: '/attribution', label: '归因结果', page: 7, requiresAuth: true, nav: false },
  { path: '/graph', label: '知识图谱', page: 8, requiresAuth: true, nav: true },
  { path: '/report', label: '学习报告', page: 9, requiresAuth: true, nav: true },
  { path: '/drive', label: '云盘', page: 10, requiresAuth: true, nav: true },
  // v1.2（D4a）：「我的」= 账号辅助页，进顶栏主导航（末位）
  { path: ME_PATH, label: '我的', page: 12, requiresAuth: true, nav: true },
];

/** 顶栏主导航项（空间不占首屏：/spaces 与 /self-report 不进主导航）。 */
export function navRoutes(): RouteSpec[] {
  return ROUTES.filter((route) => route.nav);
}

/** 按路径取路由（不含 query；未知返回 null）。 */
export function routeOf(path: string): RouteSpec | null {
  const clean = path.split('?')[0] || '/';
  return ROUTES.find((route) => route.path === clean) ?? null;
}

/** 守卫输入：token 与活跃空间是否存在（顺序读自 store/localStorage）。 */
export interface GuardState {
  token: string | null;
  hasActiveSpace: boolean;
}

/**
 * 路由守卫（纯函数）：
 *   - 未登录访问任何受保护页 → #/login
 *   - 已登录访问 #/login → #/spaces
 *   - 已登录但无活跃空间 → #/spaces（/spaces 与 /self-report 豁免：注册后直进自报）
 *   - 未知路径 → 已登录去 #/spaces，未登录去 #/login
 * 返回 null 表示放行。
 */
export function guardPath(path: string, state: GuardState): string | null {
  const route = routeOf(path);

  if (!route) return state.token ? SPACES_PATH : LOGIN_PATH;
  if (route.path === LOGIN_PATH) return state.token ? SPACES_PATH : null;
  if (route.requiresAuth && !state.token) return LOGIN_PATH;
  if (state.token && !state.hasActiveSpace && route.path !== SPACES_PATH && route.path !== SELF_REPORT_PATH) {
    return SPACES_PATH;
  }
  return null;
}

/** 供页面构造带查询参数的 hash 路由（如 /graph?path=a,b）。 */
export function hashWithQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, value);
  }
  const suffix = params.toString();
  return suffix.length > 0 ? `${path}?${suffix}` : path;
}

// ------------------------------------------------- 会话内小状态（localStorage / sessionStorage）
// 均为「用户本机进度标记」，非业务数据：丢了只会多问一次，不会坏数据。

function readStore(storage: 'local' | 'session', slot: string): string | null {
  try {
    const area = storage === 'local' ? localStorage : sessionStorage;
    return typeof area === 'undefined' ? null : area.getItem(slot);
  } catch {
    return null;
  }
}

function writeStore(storage: 'local' | 'session', slot: string, value: string | null): void {
  try {
    const area = storage === 'local' ? localStorage : sessionStorage;
    if (typeof area === 'undefined') return;
    if (value === null) area.removeItem(slot);
    else area.setItem(slot, value);
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

/** 该空间是否已完成起点自报（空间页主按钮文案切换用）。 */
export function isSelfReportDone(spaceId: string | null): boolean {
  if (!spaceId) return false;
  return readStore('local', `${STORAGE_KEYS.selfReportDonePrefix}${spaceId}`) === '1';
}

/** 标记该空间已完成自报。 */
export function markSelfReportDone(spaceId: string): void {
  writeStore('local', `${STORAGE_KEYS.selfReportDonePrefix}${spaceId}`, '1');
}

/** 试卷识别 id（sessionStorage）：刷新页面凭它走 #10 回显。 */
export function readRecognitionId(): string | null {
  return readStore('session', STORAGE_KEYS.recognition);
}

export function writeRecognitionId(recognitionId: string | null): void {
  writeStore('session', STORAGE_KEYS.recognition, recognitionId);
}

export interface PaperWrongItem {
  kp_id: string;
  stem_excerpt: string;
  student_answer: string;
}

/** 试卷确认后的错题缓存（归因向导第一步「选试卷错题」用）。 */
export function readPaperWrong(spaceId: string): PaperWrongItem[] {
  const raw = readStore('session', `${STORAGE_KEYS.paperWrongPrefix}${spaceId}`);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PaperWrongItem[]) : [];
  } catch {
    return [];
  }
}

export function writePaperWrong(spaceId: string, items: PaperWrongItem[]): void {
  writeStore('session', `${STORAGE_KEYS.paperWrongPrefix}${spaceId}`, JSON.stringify(items));
}

/**
 * Store 工厂（D3）
 *
 * 本地默认 json 实现（data/local_db/）；CloudBase 形态由 ZHIWEI_DB=cloudbase 选择
 * （桩实现，本迭代不激活，见 一、1.2 排除项）。
 */

import { resolve } from 'node:path';

import { CloudBaseStore } from './cloudbaseStore';
import { LocalJsonStore } from './jsonStore';
import type { Store } from './types';

export type DbKind = 'json' | 'cloudbase';

/** 本地 JSON 库默认目录（相对仓库根；.gitignore 覆盖，不入库）。 */
export const DEFAULT_LOCAL_DB_DIR = 'data/local_db';

export interface CreateStoreOptions {
  kind?: DbKind;
  /** 仓库根（解析默认 db 目录用）。 */
  rootDir?: string;
  /** local_db 目录绝对路径（测试注入 mkdtemp 临时目录实现隔离）。 */
  dir?: string;
}

function resolveKind(kind?: DbKind): DbKind {
  if (kind) return kind;
  const fromEnv = process.env.ZHIWEI_DB;
  return fromEnv === 'cloudbase' ? 'cloudbase' : 'json';
}

/** 创建 Store 实例（未 init）。 */
export function createStore(options: CreateStoreOptions = {}): Store {
  const kind = resolveKind(options.kind);
  if (kind === 'cloudbase') {
    // 云函数环境：后续迭代在 index.ts 初始化 SDK 后注入 db 实例
    return new CloudBaseStore(process.env.ZHIWEI_CLOUDBASE_ENV);
  }
  const rootDir = options.rootDir ?? process.env.ZHIWEI_ROOT ?? process.cwd();
  const dir = options.dir ?? resolve(rootDir, DEFAULT_LOCAL_DB_DIR);
  return new LocalJsonStore(dir);
}

/** 创建并初始化 Store（目录惰性创建）。 */
export async function createInitializedStore(options: CreateStoreOptions = {}): Promise<Store> {
  const store = createStore(options);
  await store.init();
  return store;
}

export { CloudBaseStore } from './cloudbaseStore';
export { LocalJsonStore, TABLE_FILES } from './jsonStore';
export type { TableName } from './jsonStore';
export type * from './types';

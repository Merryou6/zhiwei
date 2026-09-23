/**
 * 图片上传服务（传图读题）
 *
 * 接口：
 *   POST /api/upload/image  — body: { image_base64, filename } → { file_id, url, filename, size, mime }
 *   GET  /api/upload/image/:fileId — 直接返回图片二进制（Content-Type 对应 MIME）
 *
 * 存储：本地文件系统 data/uploads/，file_id 即文件名（含扩展名）。
 * 【留桩】生产环境应替换为 COS/OSS 等对象存储。
 */

import { mkdir, writeFile, readFile, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { promisify } from 'node:util';

import { ctxNowIso, ok, requireSpaceOwnership } from '../context';
import type { AppContext } from '../context';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import { newId } from '../ids';
import type { RouteRequest } from '../router';
import { authedUser } from './auth';

const mkdirAsync = promisify(mkdir);
const writeFileAsync = promisify(writeFile);
const readFileAsync = promisify(readFile);

/** MIME → 扩展名映射 */
const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
};

/** 从 base64 data URL 中提取 MIME 和纯 base64 内容 */
function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
}

/** 获取上传目录（确保存在） */
async function ensureUploadDir(ctx: AppContext): Promise<string> {
  const dir = join(ctx.rootDir, 'data', 'uploads');
  if (!existsSync(dir)) {
    await mkdirAsync(dir, { recursive: true });
  }
  return dir;
}

export interface UploadedImage {
  file_id: string;
  url: string;
  filename: string;
  size: number;
  mime: string;
  uploaded_at: string;
}

/** POST /api/upload/image */
export async function uploadImage(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);

  const imageBase64 = req.body.image_base64;
  const filename = typeof req.body.filename === 'string' ? req.body.filename : 'image.png';

  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    throw httpError.badRequest('缺少 image_base64 字段');
  }

  // 解析 data URL
  const parsed = parseDataUrl(imageBase64);
  if (!parsed) {
    throw httpError.badRequest('image_base64 格式不正确，应为 data:image/...;base64,...');
  }

  const { mime, base64 } = parsed;
  const ext = MIME_TO_EXT[mime] ?? (extname(filename) || '.png');

  // 限制大小：10MB
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > 10 * 1024 * 1024) {
    throw httpError.badRequest('图片大小不能超过 10MB');
  }

  // 保存文件
  const dir = await ensureUploadDir(ctx);
  const fileId = `${newId('img_')}${ext}`;
  const filePath = join(dir, fileId);
  await writeFileAsync(filePath, buffer);

  const result: UploadedImage = {
    file_id: fileId,
    url: `/api/upload/image/${fileId}`,
    filename,
    size: buffer.length,
    mime,
    uploaded_at: ctxNowIso(ctx),
  };

  return ok(result);
}

/**
 * GET /api/upload/image/:fileId — 直接返回图片二进制。
 * 注意：此接口不走标准 JSON 响应，由 server.ts 特殊处理。
 * 这里返回一个特殊标记，server 层识别后直接写二进制。
 */
export async function getImage(req: RouteRequest, ctx: AppContext): Promise<{ __binary: true; mime: string; buffer: Buffer }> {
  const fileId = req.params.fileId;
  if (!fileId || !/^img_[a-zA-Z0-9]+\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(fileId)) {
    throw httpError.notFound('图片不存在');
  }

  const dir = await ensureUploadDir(ctx);
  const filePath = join(dir, fileId);
  if (!existsSync(filePath)) {
    throw httpError.notFound('图片不存在');
  }

  const buffer = await readFileAsync(filePath);
  const ext = extname(fileId).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
  };

  return {
    __binary: true,
    mime: mimeMap[ext] ?? 'application/octet-stream',
    buffer,
  };
}

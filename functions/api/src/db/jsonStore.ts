/**
 * 本地 JSON Store 实现（D3）
 *
 * 每表一个 JSON 文件（data/local_db/，.gitignore 覆盖）；
 * 写入采用「临时文件 + rename」原子替换（R6），整文件读-改-写。
 * demo 规模足够；**不做并发锁/事务**（ALGORITHM §8 明确不做）。
 * 目录由构造参数注入（默认 data/local_db/；测试注入 mkdtemp 临时目录，实现隔离）。
 *
 * dedup 幂等 = 写入前 findEventsByDedupKey「先查后写」
 * （DATA_SCHEMA §4 注：平台若不支持唯一索引，即采用提交前先查后写，本地即此形态）。
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  AttributionRecord,
  DialogRecord,
  EvidenceEventRecord,
  MasteryLogRecord,
  MasteryProfileRecord,
  RecognitionRecord,
  SpaceRecord,
  Store,
  UserRecord,
} from './types';

/** 八张运行期表 → 文件名（item_bank 不入本地库，运行时只读静态文件）。 */
export const TABLE_FILES = {
  users: 'users.json',
  spaces: 'spaces.json',
  mastery_profiles: 'mastery_profiles.json',
  evidence_events: 'evidence_events.json',
  mastery_logs: 'mastery_logs.json',
  attributions: 'attributions.json',
  dialogs: 'dialogs.json',
  recognitions: 'recognitions.json',
} as const;

export type TableName = keyof typeof TABLE_FILES;

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ENOENT';
}

export class LocalJsonStore implements Store {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  async init(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  private async readTable<T>(table: TableName): Promise<T[]> {
    try {
      const raw = await readFile(join(this.dir, TABLE_FILES[table]), 'utf8');
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  private async writeTable<T>(table: TableName, rows: T[]): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const target = join(this.dir, TABLE_FILES[table]);
    const tmp = `${target}.tmp`;
    await writeFile(tmp, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
    await rename(tmp, target);
  }

  // ---------------------------------------------------------------- users
  async findUserByIdentifier(identifier: string): Promise<UserRecord | null> {
    const rows = await this.readTable<UserRecord>('users');
    return rows.find((row) => row.identifier === identifier) ?? null;
  }

  async findUserById(userId: string): Promise<UserRecord | null> {
    const rows = await this.readTable<UserRecord>('users');
    return rows.find((row) => row.user_id === userId) ?? null;
  }

  async insertUser(user: UserRecord): Promise<void> {
    const rows = await this.readTable<UserRecord>('users');
    rows.push(user);
    await this.writeTable('users', rows);
  }

  // --------------------------------------------------------------- spaces
  async getSpace(spaceId: string): Promise<SpaceRecord | null> {
    const rows = await this.readTable<SpaceRecord>('spaces');
    return rows.find((row) => row.space_id === spaceId) ?? null;
  }

  async listSpacesByUser(userId: string): Promise<SpaceRecord[]> {
    const rows = await this.readTable<SpaceRecord>('spaces');
    return rows.filter((row) => row.user_id === userId);
  }

  async findSpaceByUserAndKnowledgeSource(userId: string, kbId: string): Promise<SpaceRecord | null> {
    const rows = await this.listSpacesByUser(userId);
    return rows.find((row) => row.knowledge_source.includes(kbId)) ?? null;
  }

  async insertSpace(space: SpaceRecord): Promise<void> {
    const rows = await this.readTable<SpaceRecord>('spaces');
    rows.push(space);
    await this.writeTable('spaces', rows);
  }

  // ---------------------------------------------------- mastery_profiles
  async getProfile(
    userId: string,
    spaceId: string,
    knowledgePoint: string,
  ): Promise<MasteryProfileRecord | null> {
    const rows = await this.readTable<MasteryProfileRecord>('mastery_profiles');
    return (
      rows.find(
        (row) =>
          row.user_id === userId &&
          row.space_id === spaceId &&
          row.knowledge_point === knowledgePoint,
      ) ?? null
    );
  }

  async listProfiles(userId: string, spaceId: string): Promise<MasteryProfileRecord[]> {
    const rows = await this.readTable<MasteryProfileRecord>('mastery_profiles');
    return rows.filter((row) => row.user_id === userId && row.space_id === spaceId);
  }

  async upsertProfile(profile: MasteryProfileRecord): Promise<void> {
    const rows = await this.readTable<MasteryProfileRecord>('mastery_profiles');
    const index = rows.findIndex(
      (row) =>
        row.user_id === profile.user_id &&
        row.space_id === profile.space_id &&
        row.knowledge_point === profile.knowledge_point,
    );
    if (index >= 0) rows[index] = profile;
    else rows.push(profile);
    await this.writeTable('mastery_profiles', rows);
  }

  // ----------------------------------------------------- evidence_events
  async findEventsByDedupKey(spaceId: string, dedupKey: string): Promise<EvidenceEventRecord[]> {
    const rows = await this.readTable<EvidenceEventRecord>('evidence_events');
    return rows.filter((row) => row.space_id === spaceId && row.dedup_key === dedupKey);
  }

  async listEventsBySpace(spaceId: string): Promise<EvidenceEventRecord[]> {
    const rows = await this.readTable<EvidenceEventRecord>('evidence_events');
    return rows.filter((row) => row.space_id === spaceId);
  }

  async insertEvent(event: EvidenceEventRecord): Promise<void> {
    const rows = await this.readTable<EvidenceEventRecord>('evidence_events');
    rows.push(event);
    await this.writeTable('evidence_events', rows);
  }

  // -------------------------------------------------------- mastery_logs
  async insertLog(log: MasteryLogRecord): Promise<void> {
    const rows = await this.readTable<MasteryLogRecord>('mastery_logs');
    rows.push(log);
    await this.writeTable('mastery_logs', rows);
  }

  async listLogsBySpace(spaceId: string): Promise<MasteryLogRecord[]> {
    const rows = await this.readTable<MasteryLogRecord>('mastery_logs');
    return rows.filter((row) => row.space_id === spaceId);
  }

  // -------------------------------------------------------- attributions
  async getAttribution(attributionId: string): Promise<AttributionRecord | null> {
    const rows = await this.readTable<AttributionRecord>('attributions');
    return rows.find((row) => row.attribution_id === attributionId) ?? null;
  }

  async listAttributionsBySpace(spaceId: string): Promise<AttributionRecord[]> {
    const rows = await this.readTable<AttributionRecord>('attributions');
    return rows.filter((row) => row.space_id === spaceId);
  }

  async insertAttribution(attribution: AttributionRecord): Promise<void> {
    const rows = await this.readTable<AttributionRecord>('attributions');
    rows.push(attribution);
    await this.writeTable('attributions', rows);
  }

  async updateAttribution(attribution: AttributionRecord): Promise<void> {
    const rows = await this.readTable<AttributionRecord>('attributions');
    const index = rows.findIndex((row) => row.attribution_id === attribution.attribution_id);
    if (index >= 0) rows[index] = attribution;
    else rows.push(attribution);
    await this.writeTable('attributions', rows);
  }

  // ------------------------------------------------------------- dialogs
  async getDialog(dialogId: string): Promise<DialogRecord | null> {
    const rows = await this.readTable<DialogRecord>('dialogs');
    return rows.find((row) => row.dialog_id === dialogId) ?? null;
  }

  async upsertDialog(dialog: DialogRecord): Promise<void> {
    const rows = await this.readTable<DialogRecord>('dialogs');
    const index = rows.findIndex((row) => row.dialog_id === dialog.dialog_id);
    if (index >= 0) rows[index] = dialog;
    else rows.push(dialog);
    await this.writeTable('dialogs', rows);
  }

  // -------------------------------------------------------- recognitions
  async getRecognition(recognitionId: string): Promise<RecognitionRecord | null> {
    const rows = await this.readTable<RecognitionRecord>('recognitions');
    return rows.find((row) => row.recognition_id === recognitionId) ?? null;
  }

  async insertRecognition(recognition: RecognitionRecord): Promise<void> {
    const rows = await this.readTable<RecognitionRecord>('recognitions');
    rows.push(recognition);
    await this.writeTable('recognitions', rows);
  }

  async updateRecognition(recognition: RecognitionRecord): Promise<void> {
    const rows = await this.readTable<RecognitionRecord>('recognitions');
    const index = rows.findIndex((row) => row.recognition_id === recognition.recognition_id);
    if (index >= 0) rows[index] = recognition;
    else rows.push(recognition);
    await this.writeTable('recognitions', rows);
  }
}

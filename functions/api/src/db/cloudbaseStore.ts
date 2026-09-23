/**
 * CloudBase Store 适配器【桩】（D3）
 *
 * 本迭代不激活云环境（计划 一、1.2 排除项 2/3）：所有方法体统一抛
 * CLOUDBASE_NOT_CONFIGURED，并在注释中标出等价的 CloudBase SDK 调用点，
 * 便于后续迭代按注释接线。
 *
 * 不引入 wx-server-sdk / @cloudbase/node-sdk（依赖纪律：本迭代零新增运行时依赖）。
 * 接线位置（后续迭代）：
 *   1. 云函数入口 functions/api/src/index.ts 中初始化：
 *        const cloud = require('@cloudbase/node-sdk'); const app = cloud.init({ env });
 *        const db = app.database();
 *   2. 用 createStore({ kind: 'cloudbase' }) 时把 db 实例注入 CloudBaseStore 构造函数。
 *   3. 各方法按注释中的 where/get/add/update 调用替换抛错体。
 *
 * 表名与 DATA_SCHEMA §4 九张表一一对应：
 *   users / spaces / mastery_profiles / evidence_events / mastery_logs /
 *   attributions / dialogs / item_bank / recognitions
 */

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

/** 未配置云环境时的统一错误（server/router 捕获后转 500）。 */
export const CLOUDBASE_NOT_CONFIGURED = 'CLOUDBASE_NOT_CONFIGURED';

function notConfigured(): never {
  throw new Error(CLOUDBASE_NOT_CONFIGURED);
}

export class CloudBaseStore implements Store {
  /** 后续迭代注入 CloudBase database 实例的位置（本迭代不激活）。 */
  constructor(private readonly env?: string) {
    void this.env;
  }

  async init(): Promise<void> {
    // 等价调用：无（云数据库集合由 seed 脚本创建），保留接口一致性
    notConfigured();
  }

  // ---------------------------------------------------------------- users
  async findUserByIdentifier(_identifier: string): Promise<UserRecord | null> {
    // 等价调用：db.collection('users').where({ identifier: _identifier }).limit(1).get()
    notConfigured();
  }

  async findUserById(_userId: string): Promise<UserRecord | null> {
    // 等价调用：db.collection('users').doc(_userId).get()
    notConfigured();
  }

  async insertUser(_user: UserRecord): Promise<void> {
    // 等价调用：db.collection('users').add(_user)
    notConfigured();
  }

  // --------------------------------------------------------------- spaces
  async getSpace(_spaceId: string): Promise<SpaceRecord | null> {
    // 等价调用：db.collection('spaces').doc(_spaceId).get()
    notConfigured();
  }

  async listSpacesByUser(_userId: string): Promise<SpaceRecord[]> {
    // 等价调用：db.collection('spaces').where({ user_id: _userId }).get()
    notConfigured();
  }

  async findSpaceByUserAndKnowledgeSource(
    _userId: string,
    _kbId: string,
  ): Promise<SpaceRecord | null> {
    // 等价调用：db.collection('spaces').where({ user_id: _userId, knowledge_source: _kbId }).limit(1).get()
    notConfigured();
  }

  async insertSpace(_space: SpaceRecord): Promise<void> {
    // 等价调用：db.collection('spaces').add(_space)
    notConfigured();
  }

  // ---------------------------------------------------- mastery_profiles
  async getProfile(
    _userId: string,
    _spaceId: string,
    _knowledgePoint: string,
  ): Promise<MasteryProfileRecord | null> {
    // 等价调用：db.collection('mastery_profiles').where({ user_id, space_id, knowledge_point }).limit(1).get()
    notConfigured();
  }

  async listProfiles(_userId: string, _spaceId: string): Promise<MasteryProfileRecord[]> {
    // 等价调用：db.collection('mastery_profiles').where({ user_id: _userId, space_id: _spaceId }).get()
    notConfigured();
  }

  async upsertProfile(_profile: MasteryProfileRecord): Promise<void> {
    // 等价调用：where({user_id,space_id,knowledge_point}) 命中 → update；否则 add
    notConfigured();
  }

  // ----------------------------------------------------- evidence_events
  async findEventsByDedupKey(_spaceId: string, _dedupKey: string): Promise<EvidenceEventRecord[]> {
    // 等价调用：db.collection('evidence_events').where({ space_id: _spaceId, dedup_key: _dedupKey }).get()
    // （dedup_key 建议建唯一索引；若平台不支持，则沿用「先查后写」，见 DATA_SCHEMA §4 注）
    notConfigured();
  }

  async listEventsBySpace(_spaceId: string): Promise<EvidenceEventRecord[]> {
    // 等价调用：db.collection('evidence_events').where({ space_id: _spaceId }).get()
    notConfigured();
  }

  async insertEvent(_event: EvidenceEventRecord): Promise<void> {
    // 等价调用：db.collection('evidence_events').add(_event)
    notConfigured();
  }

  // -------------------------------------------------------- mastery_logs
  async insertLog(_log: MasteryLogRecord): Promise<void> {
    // 等价调用：db.collection('mastery_logs').add(_log)
    notConfigured();
  }

  async listLogsBySpace(_spaceId: string): Promise<MasteryLogRecord[]> {
    // 等价调用：db.collection('mastery_logs').where({ space_id: _spaceId }).get()
    notConfigured();
  }

  // -------------------------------------------------------- attributions
  async getAttribution(_attributionId: string): Promise<AttributionRecord | null> {
    // 等价调用：db.collection('attributions').doc(_attributionId).get()
    notConfigured();
  }

  async listAttributionsBySpace(_spaceId: string): Promise<AttributionRecord[]> {
    // 等价调用：db.collection('attributions').where({ space_id: _spaceId }).get()
    notConfigured();
  }

  async insertAttribution(_attribution: AttributionRecord): Promise<void> {
    // 等价调用：db.collection('attributions').add(_attribution)
    notConfigured();
  }

  async updateAttribution(_attribution: AttributionRecord): Promise<void> {
    // 等价调用：db.collection('attributions').doc(_attribution.attribution_id).update(_attribution)
    notConfigured();
  }

  // ------------------------------------------------------------- dialogs
  async getDialog(_dialogId: string): Promise<DialogRecord | null> {
    // 等价调用：db.collection('dialogs').doc(_dialogId).get()
    notConfigured();
  }

  async upsertDialog(_dialog: DialogRecord): Promise<void> {
    // 等价调用：db.collection('dialogs').doc(_dialog.dialog_id).set(_dialog)
    notConfigured();
  }

  // -------------------------------------------------------- recognitions
  async getRecognition(_recognitionId: string): Promise<RecognitionRecord | null> {
    // 等价调用：db.collection('recognitions').doc(_recognitionId).get()
    notConfigured();
  }

  async insertRecognition(_recognition: RecognitionRecord): Promise<void> {
    // 等价调用：db.collection('recognitions').add(_recognition)
    notConfigured();
  }

  async updateRecognition(_recognition: RecognitionRecord): Promise<void> {
    // 等价调用：db.collection('recognitions').doc(_recognition.recognition_id).update(_recognition)
    notConfigured();
  }
}

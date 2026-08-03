/**
 * @fileOverview firestore.rules / storage.rules 를 Firebase Rules API 로 직접 배포합니다.
 *
 * firebase CLI 는 배포 전에 serviceusage API 로 서비스 활성화 여부를 조회하는데,
 * 서비스 계정에 그 권한이 없으면 규칙 배포 권한이 있어도 막힙니다.
 * 이 스크립트는 그 사전 조회를 건너뛰고 규칙만 올립니다.
 *
 * 실행:
 *   npx tsx scripts/deploy-rules.ts            # 검증만 (실제 배포 없음)
 *   npx tsx scripts/deploy-rules.ts --apply    # 실제 배포
 *
 * 사전 조건: .env 에 FIREBASE_SERVICE_ACCOUNT_KEY 설정
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { GoogleAuth } from 'google-auth-library';

config({ path: '.env.local' });
config();

const APPLY = process.argv.includes('--apply');

const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!key) {
  console.error('FIREBASE_SERVICE_ACCOUNT_KEY 가 설정되지 않았습니다.');
  process.exit(1);
}

const credentials = JSON.parse(key);
const projectId: string = credentials.project_id;
const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

const auth = new GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase'],
});

const BASE = 'https://firebaserules.googleapis.com/v1';

async function api(path: string, init?: RequestInit) {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token.token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* 그대로 둡니다 */ }
  return { ok: res.ok, status: res.status, body };
}

/** 규칙 원문을 올려 ruleset 을 만들고 그 이름을 돌려줍니다. 문법 오류는 여기서 걸립니다. */
async function createRuleset(fileName: string, source: string): Promise<string> {
  const res = await api(`/projects/${projectId}/rulesets`, {
    method: 'POST',
    body: JSON.stringify({ source: { files: [{ name: fileName, content: source }] } }),
  });

  if (!res.ok) {
    const issues = res.body?.error?.details?.[0]?.issues;
    if (issues) {
      console.error(`\n${fileName} 문법 오류:`);
      for (const i of issues) {
        console.error(`  ${i.sourcePosition?.line}행: ${i.description}`);
      }
    }
    throw new Error(`ruleset 생성 실패 (${res.status}): ${JSON.stringify(res.body?.error?.message ?? res.body)}`);
  }

  return res.body.name as string;
}

/** ruleset 을 실제 서비스에 연결합니다. 이 시점부터 규칙이 적용됩니다. */
async function release(releaseName: string, rulesetName: string) {
  const full = `projects/${projectId}/releases/${releaseName}`;

  // 이미 있으면 갱신(PATCH), 없으면 생성(POST)
  const existing = await api(`/${full}`);

  const res = existing.ok
    ? await api(`/${full}`, { method: 'PATCH', body: JSON.stringify({ release: { name: full, rulesetName } }) })
    : await api(`/projects/${projectId}/releases`, { method: 'POST', body: JSON.stringify({ name: full, rulesetName }) });

  if (!res.ok) {
    throw new Error(`release 실패 (${res.status}): ${JSON.stringify(res.body?.error?.message ?? res.body)}`);
  }
}

async function main() {
  console.log(`프로젝트: ${projectId}`);
  console.log(APPLY ? '모드: 실제 배포\n' : '모드: 검증만 (실제 배포 없음)\n');

  const targets = [
    { file: 'firestore.rules', releaseName: 'cloud.firestore' },
    { file: 'storage.rules', releaseName: bucket ? `firebase.storage/${bucket}` : '' },
  ];

  for (const t of targets) {
    if (!t.releaseName) {
      console.log(`[건너뜀] ${t.file}: 스토리지 버킷 이름을 알 수 없습니다.`);
      continue;
    }

    const source = readFileSync(t.file, 'utf8');
    const rulesetName = await createRuleset(t.file, source);
    console.log(`[검증 통과] ${t.file} → ${rulesetName}`);

    if (APPLY) {
      await release(t.releaseName, rulesetName);
      console.log(`[배포 완료] ${t.file} → ${t.releaseName}`);
    }
  }

  if (!APPLY) {
    console.log('\n실제로 배포하려면: npx tsx scripts/deploy-rules.ts --apply');
  }
}

main().catch((e) => {
  console.error('\n' + e.message);
  process.exit(1);
});

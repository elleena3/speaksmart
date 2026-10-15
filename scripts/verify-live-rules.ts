/**
 * @fileOverview 지금 Firebase 에 '배포되어 있는' Firestore 규칙을 읽어 와
 * 로컬 firestore.rules 와 같은지 비교합니다.
 *
 * deploy-rules.ts 는 규칙을 올리는 쪽이고, 이것은 올라간 결과를 확인하는 쪽입니다.
 * 배포했다고 믿는 대신 실제 릴리스를 읽습니다.
 *
 * 실행:
 *   npx tsx scripts/verify-live-rules.ts
 *
 * 사전 조건: .env 에 FIREBASE_SERVICE_ACCOUNT_KEY 설정
 */
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { GoogleAuth } from 'google-auth-library';

config({ path: '.env.local' });
config();

const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!key) { console.error('FIREBASE_SERVICE_ACCOUNT_KEY 없음'); process.exit(1); }
const credentials = JSON.parse(key);
const projectId: string = credentials.project_id;

const auth = new GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase'],
});

(async () => {
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;
  const h = { Authorization: `Bearer ${token}` };
  const BASE = 'https://firebaserules.googleapis.com/v1';

  // 지금 운영에 걸려 있는 릴리스
  const relRes = await fetch(`${BASE}/projects/${projectId}/releases`, { headers: h });
  const rels = await relRes.json();
  const fsRel = (rels.releases ?? []).find((r: any) => r.name.endsWith('cloud.firestore'));
  if (!fsRel) { console.error('firestore 릴리스를 찾을 수 없습니다'); process.exit(1); }

  console.log(`릴리스      : ${fsRel.name.split('/').pop()}`);
  console.log(`갱신 시각   : ${fsRel.updateTime}`);

  const rsRes = await fetch(`${BASE}/${fsRel.rulesetName}`, { headers: h });
  const rs = await rsRes.json();
  const live: string = rs.source.files[0].content;
  const localSrc = readFileSync('firestore.rules', 'utf8');

  console.log(`\n로컬 파일과 동일? ${live.trim() === localSrc.trim() ? '예 (완전히 같음)' : '아니오'}`);

  const checks: [string, RegExp][] = [
    ['activityRecords 블록', /match \/activityRecords\/\{recordId\}/],
    ['activityRecords 수정 금지', /allow update: if false/],
    ['evaluationModel 잠금', /affectedKeys\(\)\.hasAny\(\['evaluationModel'\]\)/],
    ['기타 경로 전면 차단', /match \/\{document=\*\*\} \{\s*allow read, write: if false/],
  ];
  console.log('\n배포된 규칙 안에 실제로 들어있는지:');
  for (const [label, re] of checks) {
    console.log(`  ${re.test(live) ? 'OK ' : '!! '} ${label}`);
  }
})();

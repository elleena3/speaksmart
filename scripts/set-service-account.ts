/**
 * @fileOverview 다운로드한 서비스 계정 JSON을 .env 에 안전하게 기록합니다.
 *
 * 손으로 붙여넣으면 줄바꿈이나 따옴표 때문에 JSON이 깨지기 쉬워서,
 * 파일에서 읽어 한 줄로 정규화한 뒤 기록합니다.
 * 키 값 자체는 화면에 출력하지 않습니다.
 *
 * 실행:
 *   npx tsx scripts/set-service-account.ts "C:\\Users\\user\\Downloads\\<파일>.json"
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';

const VAR_NAME = 'FIREBASE_SERVICE_ACCOUNT_KEY';
const ENV_PATH = '.env';

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('사용법: npx tsx scripts/set-service-account.ts <서비스계정 JSON 경로>');
  process.exit(1);
}

if (!existsSync(jsonPath)) {
  console.error(`파일을 찾을 수 없습니다: ${jsonPath}`);
  process.exit(1);
}

// 1) 서비스 계정 JSON 검증
let account: Record<string, unknown>;
try {
  account = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch (e) {
  console.error('서비스 계정 파일이 올바른 JSON이 아닙니다:', (e as Error).message);
  process.exit(1);
}

const required = ['type', 'project_id', 'private_key', 'client_email'];
const missing = required.filter((k) => !account[k]);
if (missing.length > 0) {
  console.error(`서비스 계정 파일에 다음 항목이 없습니다: ${missing.join(', ')}`);
  process.exit(1);
}

// 작은따옴표로 감싸 기록하므로 값 안에 작은따옴표가 있으면 안 됩니다.
// 정상적인 서비스 계정 키에는 들어갈 일이 없지만 확인은 해 둡니다.
const oneLine = JSON.stringify(account);
if (oneLine.includes("'")) {
  console.error("키 값에 작은따옴표가 포함되어 있어 .env 에 안전하게 기록할 수 없습니다.");
  process.exit(1);
}

// 2) 기존 .env 에서 이 변수 줄만 걷어내기
const original = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';

if (original) {
  copyFileSync(ENV_PATH, `${ENV_PATH}.bak`);
  console.log(`기존 .env 를 .env.bak 으로 백업했습니다.`);
}

const lines = original.split(/\r?\n/);
const kept: string[] = [];
let insideBrokenValue = false;

for (const line of lines) {
  if (line.trimStart().startsWith(VAR_NAME)) {
    // 값이 여러 줄로 깨져 있을 수 있으므로, 따옴표가 닫히지 않았으면 다음 줄들도 버립니다.
    const afterEquals = line.slice(line.indexOf('=') + 1).trim();
    const quote = afterEquals[0];
    const closed =
      (quote === "'" || quote === '"')
        ? afterEquals.length > 1 && afterEquals.endsWith(quote)
        : true;
    insideBrokenValue = !closed;
    continue;
  }

  if (insideBrokenValue) {
    if (line.trimEnd().endsWith("'") || line.trimEnd().endsWith('"')) {
      insideBrokenValue = false;
    }
    continue;
  }

  kept.push(line);
}

// 3) 새 값 기록
while (kept.length > 0 && kept[kept.length - 1].trim() === '') {
  kept.pop();
}

kept.push('');
kept.push('# 서버 전용 관리자 자격증명 (scripts/set-service-account.ts 가 기록)');
kept.push(`${VAR_NAME}='${oneLine}'`);
kept.push('');

writeFileSync(ENV_PATH, kept.join('\n'), 'utf8');

console.log('\n.env 에 기록했습니다.');
console.log('  project_id  :', account.project_id);
console.log('  client_email:', String(account.client_email).split('@')[1]);
console.log('  private_key :', String(account.private_key).slice(0, 27) + '...');
console.log('\n이제 npm run migrate:auth 를 실행할 수 있습니다.');

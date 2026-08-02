/**
 * @fileOverview 평문 비밀번호 → Firebase Auth 일회성 마이그레이션 스크립트.
 *
 * 기존 users 문서에 남아 있는 password 필드를 읽어 같은 UID의 Firebase Auth 계정을 만들고,
 * 문서에서는 password 필드를 제거합니다.
 *
 * Firestore 문서 ID를 그대로 Auth UID로 사용하므로
 * results.studentId, assessments.uid 등 기존 참조는 전혀 건드리지 않아도 됩니다.
 *
 * 실행:
 *   npm run migrate:auth          # 무엇이 바뀔지 미리 보기 (dry run)
 *   npm run migrate:auth -- --apply   # 실제 적용
 *
 * 사전 조건: .env 에 FIREBASE_SERVICE_ACCOUNT_KEY 설정
 * (설정 방법은 src/lib/firebase-admin.ts 상단 주석 참고)
 */

import { config } from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { deriveAuthEmail } from '../src/lib/auth-email';

config({ path: '.env.local' });
config();

const APPLY = process.argv.includes('--apply');

// Auth 계정은 만들어야 하지만 원래 비밀번호를 알 수 없는 문서에 쓸 임시 비밀번호.
const FALLBACK_PASSWORD = '1234567890';

function initAdmin() {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY 가 설정되지 않았습니다. ' +
      'src/lib/firebase-admin.ts 상단의 안내를 참고해 .env 에 추가하세요.'
    );
  }
  return initializeApp({ credential: cert(JSON.parse(key)) }, 'migrate');
}

async function main() {
  const app = initAdmin();
  const db = getFirestore(app);
  const adminAuth = getAuth(app);

  const snapshot = await db.collection('users').get();
  console.log(`users 문서 ${snapshot.size}건을 검사합니다. (${APPLY ? '적용 모드' : 'DRY RUN — 실제 변경 없음'})\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const uid = docSnap.id;
    const displayName: string | undefined = data.displayName;

    if (!displayName) {
      console.warn(`  [건너뜀] ${uid}: displayName 이 없어 로그인 아이디를 만들 수 없습니다.`);
      skipped++;
      continue;
    }

    const email = deriveAuthEmail(displayName);
    const password: string = data.password || FALLBACK_PASSWORD;
    const usedFallback = !data.password;

    try {
      let exists = true;
      try {
        await adminAuth.getUser(uid);
      } catch {
        exists = false;
      }

      if (!APPLY) {
        console.log(
          `  [${exists ? '갱신 예정' : '생성 예정'}] ${displayName} (${uid}) → ${email}` +
          (usedFallback ? `  ※ 저장된 비밀번호가 없어 '${FALLBACK_PASSWORD}' 사용` : '')
        );
        exists ? updated++ : created++;
        continue;
      }

      if (exists) {
        await adminAuth.updateUser(uid, { email, password, displayName });
        updated++;
      } else {
        await adminAuth.createUser({ uid, email, password, displayName });
        created++;
      }

      // 평문 비밀번호는 Auth로 옮겨졌으므로 문서에서 제거합니다.
      await docSnap.ref.update({
        uid,
        password: FieldValue.delete(),
      });

      console.log(
        `  [완료] ${displayName} (${uid}) → ${email}` +
        (usedFallback ? `  ※ '${FALLBACK_PASSWORD}' 로 설정됨` : '')
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  [실패] ${displayName} (${uid}): ${message}`);
      failures.push(`${displayName} (${uid}): ${message}`);
    }
  }

  console.log(`\n생성 ${created}건 / 갱신 ${updated}건 / 건너뜀 ${skipped}건 / 실패 ${failures.length}건`);

  if (!APPLY) {
    console.log('\n실제로 적용하려면: npm run migrate:auth -- --apply');
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * @fileOverview 데이터베이스 초기화(Seeding) 스크립트.
 *
 * 새로운 환경에서 운영을 시작할 때 필수 데이터(계정, 샘플 평가)를 생성합니다.
 * Firebase Auth 계정과 Firestore 문서를 같은 UID로 함께 만들어야 하므로
 * 클라이언트가 아닌 Admin SDK로 실행합니다.
 *
 * 실행:
 *   npm run seed                      # 교사 + 목업 학생 3명 + 샘플 평가
 *   npm run seed -- --teacher-only    # 교사 계정만 (이미 실제 데이터가 있는 환경)
 *
 * 사전 조건: .env 에 FIREBASE_SERVICE_ACCOUNT_KEY 설정
 * (설정 방법은 src/lib/firebase-admin.ts 상단 주석 참고)
 *
 * 여기서 만드는 UID와 비밀번호는 src/context/auth-context.tsx 의
 * mockStudents / SEED_CREDENTIALS 와 반드시 일치해야 데모 로그인이 동작합니다.
 */

import { config } from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { deriveAuthEmail } from '../src/lib/auth-email';

config({ path: '.env.local' });
config();

// Firebase Auth 는 6자 이상을 요구하므로 예전 4자리 '2918' 을 그대로 쓸 수 없습니다.
// 값을 바꿀 때는 src/context/auth-context.tsx 의 SEED_CREDENTIALS 도 함께 맞춰야 합니다.
const TEACHER_PASSWORD = '29182918';
const STUDENT_PASSWORD = '123456';

// 이미 실제 학급 데이터가 들어 있는 환경에서는 목업 학생과 샘플 평가를 넣지 않습니다.
const TEACHER_ONLY = process.argv.includes('--teacher-only');

type SeedUser = {
  uid: string;
  displayName: string;
  email: string;
  password: string;
  role: 'teacher' | 'student';
};

const SEED_USERS: SeedUser[] = [
  {
    uid: 'teacher-mock-uid',
    displayName: 'Great Teacher',
    email: 'teacher@speaksmart.edu',
    password: TEACHER_PASSWORD,
    role: 'teacher',
  },
  { uid: 'student1-mock-uid', displayName: '일학생', email: 'student1@example.com', password: STUDENT_PASSWORD, role: 'student' },
  { uid: 'student2-mock-uid', displayName: '이학생', email: 'student2@example.com', password: STUDENT_PASSWORD, role: 'student' },
  { uid: 'student3-mock-uid', displayName: '삼학생', email: 'student3@example.com', password: STUDENT_PASSWORD, role: 'student' },
];

function initAdmin() {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY 가 설정되지 않았습니다. ' +
      'src/lib/firebase-admin.ts 상단의 안내를 참고해 .env 에 추가하세요.'
    );
  }
  return initializeApp({ credential: cert(JSON.parse(key)) }, 'seed');
}

async function main() {
  const app = initAdmin();
  const db = getFirestore(app);
  const adminAuth = getAuth(app);

  const targets = TEACHER_ONLY ? SEED_USERS.filter((u) => u.role === 'teacher') : SEED_USERS;

  if (TEACHER_ONLY) {
    console.log('--teacher-only: 교사 계정만 생성합니다. (목업 학생·샘플 평가 건너뜀)\n');
  }

  for (const user of targets) {
    const authEmail = deriveAuthEmail(user.displayName);

    // 이미 있으면 갱신, 없으면 생성. 여러 번 실행해도 안전합니다.
    try {
      await adminAuth.getUser(user.uid);
      await adminAuth.updateUser(user.uid, {
        email: authEmail,
        password: user.password,
        displayName: user.displayName,
      });
    } catch {
      await adminAuth.createUser({
        uid: user.uid,
        email: authEmail,
        password: user.password,
        displayName: user.displayName,
      });
    }

    // 비밀번호는 Auth가 보관하므로 Firestore 문서에는 저장하지 않습니다.
    await db.collection('users').doc(user.uid).set(
      {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        ...(user.role === 'student' ? { grade: '1', class: '1', number: '1' } : {}),
        photoURL: `https://placehold.co/100x100.png?text=${user.displayName.charAt(0)}`,
        createdAt: Date.now(),
        isMock: true,
      },
      { merge: true }
    );

    console.log(`  [완료] ${user.displayName} (${user.uid}) — 로그인 아이디: ${user.displayName} / 비밀번호: ${user.password}`);
  }

  if (TEACHER_ONLY) {
    console.log('\n교사 계정 생성 완료!');
    return;
  }

  // 샘플 평가 데이터
  await db.collection('assessments').doc('sample-monologue-1').set({
    uid: 'teacher-mock-uid',
    title: '자기소개 하기 (Sample)',
    topic: 'Introduce yourself in English for 1 minute.',
    prompt: '당신에 대해 영어로 소개해 보세요. 이름, 취미, 좋아하는 음식을 포함하여 1분 내외로 말해주세요.',
    assessmentType: 'monologue',
    monologueType: 'text',
    targetStudentIds: 'all',
    averageScore: 0,
    submissionCount: 0,
    expectedFormat: '1. 인사말 2. 이름 및 기본 정보 3. 취미/관심사 설명 4. 맺음말',
    evaluationModel: 'googleai/gemini-3.6-flash',
    createdAt: Date.now(),
    dateCreated: new Date().toISOString().split('T')[0],
  });

  console.log('\n초기 데이터 생성 완료!');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

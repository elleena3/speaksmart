/**
 * @fileOverview 이름(아이디) 기반 로그인을 Firebase Auth 위에서 구현하기 위한 유틸.
 *
 * 이 앱의 로그인 아이디는 학생 이름(주로 한글)이지만 Firebase Auth는 이메일을 요구합니다.
 * 이름에서 결정적(deterministic)으로 ASCII 이메일을 만들어 내면
 * 로그인 전에 users 컬렉션을 조회할 필요가 없어집니다.
 *
 * 즉, users 컬렉션을 완전히 비공개로 잠글 수 있게 하는 것이 이 파일의 목적입니다.
 * 여기서 만드는 주소는 Auth 내부 식별자일 뿐 실제로 메일이 발송되지 않으며,
 * 연락용 이메일은 users 문서의 email 필드에 따로 보관합니다.
 */

// 실제로 존재하지 않는 도메인이어야 합니다. 메일이 발송되는 주소가 아닙니다.
export const AUTH_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN || 'speaksmart.local';

/**
 * 로그인 아이디 정규화. 앞뒤 공백과 유니코드 조합 형태 차이를 흡수합니다.
 * (macOS에서 입력한 '홍길동'과 Windows에서 입력한 '홍길동'은 바이트가 다를 수 있습니다.)
 */
export function normalizeLoginName(name: string): string {
  return name.trim().normalize('NFC');
}

/**
 * FNV-1a 32비트 해시. 프로젝트 target이 ES2017이라 BigInt를 쓸 수 없어
 * 32비트 연산으로 구현합니다. 암호용이 아니라 이름 → 고정 길이 문자열 매핑용입니다.
 */
function fnv1a32(bytes: Uint8Array, offsetBasis: number): string {
  let hash = offsetBasis;

  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }

  // >>> 0 으로 부호 없는 32비트로 되돌립니다.
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * 서로 다른 시작값으로 32비트 해시를 두 번 돌려 64비트 상당의 식별자를 만듭니다.
 * 학교 규모의 이름 수에서는 충돌을 사실상 걱정하지 않아도 되는 크기입니다.
 */
function nameDigest(input: string): string {
  const bytes = new TextEncoder().encode(input);
  return fnv1a32(bytes, 0x811c9dc5) + fnv1a32(bytes, 0x1e3779b9);
}

/**
 * 이름 → Firebase Auth 로그인 이메일.
 * 같은 이름은 언제나 같은 주소로 변환되므로 로그인 시 사전 조회가 필요 없습니다.
 */
export function deriveAuthEmail(name: string): string {
  return `u${nameDigest(normalizeLoginName(name))}@${AUTH_EMAIL_DOMAIN}`;
}

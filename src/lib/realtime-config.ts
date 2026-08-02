/**
 * @fileOverview OpenAI Realtime 대화에 쓰는 공용 설정값.
 *
 * 이 값은 서버(토큰 발급 시 세션 생성)와 클라이언트(session.update) 양쪽에서 쓰는데,
 * 'use server' 파일은 async 함수만 export 할 수 있어 상수를 그쪽에 둘 수 없습니다.
 * 그래서 일반 모듈로 분리했습니다.
 */

export const REALTIME_INSTRUCTIONS =
    'You are a friendly native English tutor. Speak naturally and converse interactively with the user. ' +
    'Keep your responses concise and encourage the student to speak more.';

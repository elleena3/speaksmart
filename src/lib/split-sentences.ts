/**
 * @fileOverview 영문 지문을 문장 단위로 나눕니다.
 *
 * 쉐도잉은 문장 하나를 여러 번 반복하는 연습이라 문장 경계가 중요합니다.
 * 마침표만 보고 자르면 'Mr. Smith' 가 두 문장이 되고,
 * 인용부호로 끝나는 문장('She said "Stop." Then...')은 반대로 안 잘립니다.
 */

/** 뒤에 이름이 따라오는 약어들. 여기서 끊으면 안 됩니다. */
const ABBREVIATIONS = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|No|Fig|approx)\.$/i;

export function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 문장부호 뒤(닫는 인용부호가 있으면 그것까지) 공백, 그리고 대문자나 인용부호로 시작.
  const rough = trimmed.split(/(?<=[.!?]["'”’]?)\s+(?=["'“‘]?[A-Z])/g);

  const sentences: string[] = [];
  for (const part of rough) {
    const piece = part.trim();
    if (!piece) continue;
    const previous = sentences[sentences.length - 1];
    // 앞 조각이 약어로 끝났다면 잘린 것이므로 다시 붙입니다.
    if (previous && ABBREVIATIONS.test(previous)) {
      sentences[sentences.length - 1] = `${previous} ${piece}`;
    } else {
      sentences.push(piece);
    }
  }

  return sentences.length ? sentences : [trimmed];
}

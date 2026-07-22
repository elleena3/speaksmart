/**
 * @fileOverview 데이터베이스 초기화(Seeding) 스크립트
 * 새로운 환경에서 운영을 시작할 때 필수 데이터(계정, 샘플 평가)를 Firestore에 생성합니다.
 * 보안을 위해 실제 운영 환경에서는 사용 후 삭제하거나 주석 처리하세요.
 */

import { db } from "./firebase";
import { collection, doc, setDoc, writeBatch } from "firebase/firestore";

export const seedInitialData = async () => {
  if (!db) return { success: false, message: "DB 연결 실패" };

  const batch = writeBatch(db);

  // 1. 교사 계정 생성 (교사 암호: 2918)
  const teacherRef = doc(collection(db, "users"), "teacher-mock-uid");
  batch.set(teacherRef, {
    displayName: "Great Teacher",
    email: "teacher@speaksmart.edu",
    password: "2918",
    role: "teacher",
    photoURL: "https://placehold.co/100x100.png?text=Teacher",
    createdAt: Date.now(),
    isMock: true
  });

  // 2. 학생 계정 생성 (기본 암호: 123456)
  const students = [
    { id: "student1-mock-uid", name: "일학생", email: "student1@example.com" },
    { id: "student2-mock-uid", name: "이학생", email: "student2@example.com" },
    { id: "student3-mock-uid", name: "삼학생", email: "student3@example.com" },
  ];

  students.forEach(s => {
    const sRef = doc(collection(db, "users"), s.id);
    batch.set(sRef, {
      displayName: s.name,
      email: s.email,
      password: "123456",
      role: "student",
      grade: "1",
      class: "1",
      number: "1",
      photoURL: `https://placehold.co/100x100.png?text=${s.name.charAt(0)}`,
      createdAt: Date.now(),
      isMock: true
    });
  });

  // 3. 샘플 평가 데이터 생성
  const assessmentRef = doc(collection(db, "assessments"), "sample-monologue-1");
  batch.set(assessmentRef, {
    uid: "teacher-mock-uid",
    title: "자기소개 하기 (Sample)",
    topic: "Introduce yourself in English for 1 minute.",
    prompt: "당신에 대해 영어로 소개해 보세요. 이름, 취미, 좋아하는 음식을 포함하여 1분 내외로 말해주세요.",
    assessmentType: "monologue",
    monologueType: "text",
    targetStudentIds: "all",
    averageScore: 0,
    submissionCount: 0,
    expectedFormat: "1. 인사말 2. 이름 및 기본 정보 3. 취미/관심사 설명 4. 맺음말",
    evaluationModel: "googleai/gemini-3.6-flash",
    createdAt: Date.now(),
    dateCreated: new Date().toISOString().split('T')[0]
  });

  try {
    await batch.commit();
    return { success: true, message: "초기 데이터 생성 완료!" };
  } catch (e) {
    console.error("Seeding error:", e);
    return { success: false, message: "데이터 생성 중 오류 발생" };
  }
};

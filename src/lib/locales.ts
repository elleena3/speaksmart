
export const translations = {
  ko: {
    language: {
        title: "언어"
    },
    nav: {
      dashboard: "대시보드",
      myResults: "내 결과",
      profile: "프로필",
      assessments: "평가",
      settings: "설정",
      logout: "로그아웃",
    },
    titles: {
        studentPortal: "학생 포털",
        teacherPortal: "교사 포털",
    },
    teacherDashboard: {
      dashboard: "대시보드",
      createAssessment: "평가 만들기",
      performanceOverview: "수업 성과 개요",
      avgScoreDescription: "최근 평가의 평균 점수입니다.",
      recentAssessments: "최근 평가",
      recentAssessmentsDescription: "가장 최근에 생성된 말하기 평가입니다.",
      title: "제목",
      completed: "완료",
      avgScore: "평균 점수",
      dateCreated: "생성일",
      actions: "작업",
      viewResults: "결과 보기",
      edit: "편집",
      delete: "삭제",
      openMenu: "메뉴 열기",
      noScore: "해당 없음"
    }
  },
  en: {
    language: {
        title: "Language"
    },
    nav: {
      dashboard: "Dashboard",
      myResults: "My Results",
      profile: "Profile",
      assessments: "Assessments",
      settings: "Settings",
      logout: "Logout",
    },
    titles: {
        studentPortal: "Student Portal",
        teacherPortal: "Teacher Portal",
    },
    teacherDashboard: {
        dashboard: "Dashboard",
        createAssessment: "Create Assessment",
        performanceOverview: "Class Performance Overview",
        avgScoreDescription: "Average scores from recent assessments.",
        recentAssessments: "Recent Assessments",
        recentAssessmentsDescription: "Your most recently created speaking assessments.",
        title: "Title",
        completed: "Completed",
        avgScore: "Avg. Score",
        dateCreated: "Date Created",
        actions: "Actions",
        viewResults: "View Results",
        edit: "Edit",
        delete: "Delete",
        openMenu: "Open menu",
        noScore: "N/A"
    }
  },
};

export type Translation = typeof translations.ko;

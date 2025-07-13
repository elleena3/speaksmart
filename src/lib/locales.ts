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
    }
  },
};

export type Translation = typeof translations.ko;

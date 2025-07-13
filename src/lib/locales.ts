
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
    studentDashboard: {
        welcome: "다시 오신 것을 환영합니다!",
        description: "대기 중이거나 완료된 평가입니다.",
        startAssessment: "평가 시작",
        viewResults: "결과 보기",
        status: {
            todo: "할 일",
            graded: "채점 완료",
            practice: "연습",
        }
    },
    studentHistory: {
        title: "내 결과",
        description: "완료된 모든 평가 기록입니다.",
        assessment: "평가",
        completionDate: "완료 날짜",
        score: "점수",
        action: "작업",
        viewFeedback: "피드백 보기",
    },
    studentProfile: {
        title: "내 프로필",
        description: "프로필 설정 및 개인 정보를 관리하세요.",
        fullName: "전체 이름",
        emailAddress: "이메일 주소",
        saveChanges: "변경사항 저장",
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
    },
    teacherAssessments: {
      title: "평가 관리",
      description: "모든 평가를 생성, 편집 및 관리합니다.",
      newAssessmentButton: "새 평가 만들기",
      listTitle: "평가 목록",
      listDescription: "생성된 모든 평가 목록입니다.",
      tableHeaderTitle: "제목",
      tableHeaderPeriod: "평가 기간",
      tableHeaderCompleted: "완료",
      tableHeaderAvgScore: "평균 점수",
      tableHeaderActions: "작업",
      periodAlways: "상시",
      periodFrom: "{date}부터",
      periodTo: "~ {date}까지",
      scoreNotApplicable: "해당 없음",
      menuOpen: "메뉴 열기",
      menuViewResults: "결과 보기",
      menuEdit: "편집",
      menuDelete: "삭제",
      deleteDialogTitle: "정말로 삭제하시겠습니까?",
      deleteDialogDescription: "이 작업은 되돌릴 수 없습니다. 이 평가와 관련된 모든 데이터가 영구적으로 삭제됩니다.",
      deleteDialogCancel: "취소",
      deleteDialogConfirm: "삭제",
      deleteToast: {
        title: "평가 삭제됨",
        description: "평가가 성공적으로 삭제되었습니다."
      },
      noAssessments: {
          title: "아직 생성된 평가가 없습니다.",
          description: "첫 번째 평가를 만들려면 위 버튼을 클릭하세요!"
      }
    },
    teacherSettings: {
        title: "설정",
        description: "계정 및 알림 설정을 관리합니다.",
        account: {
            title: "계정 정보",
            nameLabel: "전체 이름",
            emailLabel: "이메일",
            updateButton: "프로필 업데이트"
        },
        notifications: {
            title: "알림 설정",
            newSubmissionLabel: "새로운 제출",
            newSubmissionDescription: "학생이 평가를 제출하면 알림을 받습니다.",
            feedbackReceivedLabel: "피드백 수신",
            feedbackReceivedDescription: "학생이 평가에 대한 피드백을 제공하면 알림을 받습니다."
        }
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
    studentDashboard: {
        welcome: "Welcome back!",
        description: "Here are your pending and completed assessments.",
        startAssessment: "Start Assessment",
        viewResults: "View Results",
        status: {
            todo: "To Do",
            graded: "Graded",
            practice: "Practice",
        }
    },
    studentHistory: {
        title: "My Results",
        description: "This is a record of all your completed assessments.",
        assessment: "Assessment",
        completionDate: "Completion Date",
        score: "Score",
        action: "Action",
        viewFeedback: "View Feedback",
    },
    studentProfile: {
        title: "My Profile",
        description: "Manage your profile settings and personal information.",
        fullName: "Full Name",
        emailAddress: "Email Address",
        saveChanges: "Save Changes",
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
    },
    teacherAssessments: {
      title: "Assessment Management",
      description: "Create, edit, and manage all your assessments.",
      newAssessmentButton: "Create New Assessment",
      listTitle: "Assessment List",
      listDescription: "A list of all created assessments.",
      tableHeaderTitle: "Title",
      tableHeaderPeriod: "Assessment Period",
      tableHeaderCompleted: "Completed",
      tableHeaderAvgScore: "Avg. Score",
      tableHeaderActions: "Actions",
      periodAlways: "Always available",
      periodFrom: "From {date}",
      periodTo: "Until {date}",
      scoreNotApplicable: "N/A",
      menuOpen: "Open menu",
      menuViewResults: "View Results",
      menuEdit: "Edit",
      menuDelete: "Delete",
      deleteDialogTitle: "Are you absolutely sure?",
      deleteDialogDescription: "This action cannot be undone. This will permanently delete the assessment and all related data.",
      deleteDialogCancel: "Cancel",
      deleteDialogConfirm: "Delete",
      deleteToast: {
        title: "Assessment Deleted",
        description: "The assessment has been successfully deleted."
      },
      noAssessments: {
          title: "No assessments created yet.",
          description: "Click the button above to create your first assessment!"
      }
    },
    teacherSettings: {
        title: "Settings",
        description: "Manage your account and notification settings.",
        account: {
            title: "Account Information",
            nameLabel: "Full Name",
            emailLabel: "Email",
            updateButton: "Update Profile"
        },
        notifications: {
            title: "Notification Settings",
            newSubmissionLabel: "New Submissions",
            newSubmissionDescription: "Get notified when a student submits an assessment.",
            feedbackReceivedLabel: "Feedback Received",
            feedbackReceivedDescription: "Get notified when a student provides feedback on an assessment."
        }
    }
  },
};

export type Translation = typeof translations.ko;


export const translations = {
  ko: {
    language: {
        title: "언어"
    },
    nav: {
      dashboard: "대시보드",
      myResults: "내 결과",
      profile: "프로필",
      assessments: "평가 관리",
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
      recentAssessmentsDescription: "가장 최근에 생성된 말하기 평가 5개입니다.",
      title: "제목",
      completed: "완료",
      avgScore: "평균 점수",
      dateCreated: "생성일",
      actions: "작업",
      viewResults: "결과 보기",
      edit: "편집",
      delete: "삭제",
      openMenu: "메뉴 열기",
      noScore: "해당 없음",
      viewAllAssessments: "모든 평가 보기"
    },
    teacherAssessments: {
      title: "평가 관리",
      description: "모든 평가를 생성, 편집 및 관리합니다.",
      newAssessmentButton: "새 평가 만들기",
      listTitle: "평가 목록",
      listDescription: "생성된 모든 평가 목록입니다.",
      tableHeaderTitle: "제목",
      tableHeaderType: "유형",
      tableHeaderPeriod: "평가 기간",
      tableHeaderCompleted: "완료",
      tableHeaderAvgScore: "평균 점수",
      tableHeaderActions: "작업",
      assessmentTypes: {
        monologue: "혼자 말하기",
        dialogue: "AI와 대화하기"
      },
      periodAlways: "상시",
      periodFrom: "{date}부터",
      periodTo: "~ {date}까지",
      scoreNotApplicable: "해당 없음",
      menuOpen: "메뉴 열기",
      menuViewResults: "결과 보기",
      menuEdit: "편집",
      menuCopy: "복사",
      copySuffix: " - 복사본",
      menuDelete: "삭제",
      deleteDialogTitle: "정말로 삭제하시겠습니까?",
      deleteDialogDescription: "이 작업은 되돌릴 수 없습니다. 평가를 삭제하면 관련된 모든 학생 결과도 함께 영구적으로 삭제됩니다.",
      deleteDialogCancel: "취소",
      deleteDialogConfirm: "삭제",
      deleteToast: {
        title: "평가 삭제됨",
        description: "평가가 성공적으로 삭제되었습니다."
      },
      copyToast: {
          title: "평가 복사됨",
          description: "'{title}' 평가의 복사본이 생성되었습니다.",
      },
      noAssessments: {
          title: "아직 생성된 평가가 없습니다.",
          description: "첫 번째 평가를 만들려면 위 버튼을 클릭하세요!"
      }
    },
    teacherAssessmentForm: {
      createTitle: "새 평가 만들기",
      createDescription: "새로운 말하기 평가를 생성하려면 아래 양식을 작성해주세요.",
      editTitle: "평가 수정",
      editDescription: "평가 정보를 수정하려면 아래 양식을 업데이트해주세요.",
      optional: "선택",
      freeTalkDefaults: {
          topic: "AI와 자유롭게 대화하세요.",
          prompt: "AI와 자유롭게 영어로 대화해 보세요. 준비가 되면 '대화 시작' 버튼을 누르세요.",
          expectedFormat: "학생은 자연스러운 대화에 참여해야 합니다. AI는 유창성, 발음, 어휘, 문법을 전반적으로 평가합니다."
      },
      typeLabel: "평가 유형",
      typeMonologue: "혼자 말하기 (Monologue)",
      typeDialogue: "AI와 대화하기 (Dialogue)",
      scenarioLabel: "대화 시나리오",
      scenarioPlaceholder: "시나리오를 선택하세요...",
      scenarioDescription: "'AI와 대화하기' 유형에 대한 역할극 상황을 선택합니다.",
      scenarios: {
          freeTalk: "자유 대화",
          orderingFood: "음식 주문하기",
          airportCheckIn: "공항 체크인",
          shopping: "쇼핑하기",
      },
      titleLabel: "평가 제목",
      titlePlaceholder: "예: 7단원: 취미와 관심사",
      titleDescription: "학생에게 보여질 평가의 이름입니다.",
      topicLabel: "평가 주제",
      topicPlaceholder: "예: 가장 좋아하는 취미에 대해 1분간 이야기하세요.",
      topicDescription: "평가 목록에 표시될 간략한 주제입니다.",
      promptLabel: "학생 안내 내용 (혼자 말하기)",
      promptPlaceholder: "학생에게 보여줄 자세한 안내 내용을 입력하세요.",
      promptDescription: "학생이 평가를 시작할 때 보게 될 상세한 지시사항입니다.",
      scenarioPromptLabel: "상황 설명 (AI와 대화하기)",
      scenarioPromptPlaceholder: "학생에게 보여줄 상황 설명을 입력하세요 (예: 당신은 손님입니다. AI 종업원에게 음식을 주문하세요).",
      scenarioPromptDescription: "학생이 역할을 이해하고 대화를 시작하는 데 도움이 되는 설명입니다.",
      expectedFormatLabel: "AI 평가를 위한 채점 기준",
      expectedFormatPlaceholder: "AI가 평가할 때 참고할 학생의 예상 답변 형식이나 핵심 요소를 설명해주세요.",
      expectedFormatDescription: "이 내용은 AI 피드백의 정확도를 높이는 데 사용됩니다. '혼자 말하기'에는 필수, 'AI와 대화하기'에는 선택 항목입니다.",
      startDateLabel: "평가 시작일 (선택)",
      startDateDescription: "평가를 시작할 날짜를 지정합니다.",
      endDateLabel: "평가 종료일 (선택)",
      endDateDescription: "평가를 마감할 날짜를 지정합니다.",
      datePlaceholder: "날짜 선택",
      cancelButton: "취소",
      createButton: "평가 생성",
      creatingButton: "생성 중...",
      saveButton: "변경사항 저장",
      savingButton: "저장 중...",
      createSuccessToast: {
        title: "성공!",
        description: "'{title}' 평가가 성공적으로 생성되었습니다.",
      },
      editSuccessToast: {
        title: "성공!",
        description: "'{title}' 평가가 성공적으로 수정되었습니다.",
      },
      errors: {
        titleRequired: "제목을 입력해주세요.",
        topicRequired: "주제를 입력해주세요.",
        promptRequired: "안내 내용을 입력해주세요.",
        expectedFormatRequired: "예상 답변 형식을 입력해주세요.",
        endDate: "종료일은 시작일보다 빠를 수 없습니다.",
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
        recentAssessmentsDescription: "Your 5 most recently created speaking assessments.",
        title: "Title",
        completed: "Completed",
        avgScore: "Avg. Score",
        dateCreated: "Date Created",
        actions: "Actions",
        viewResults: "View Results",
        edit: "Edit",
        delete: "Delete",
        openMenu: "Open menu",
        noScore: "N/A",
        viewAllAssessments: "View All Assessments"
    },
    teacherAssessments: {
      title: "Assessment Management",
      description: "Create, edit, and manage all your assessments.",
      newAssessmentButton: "Create New Assessment",
      listTitle: "Assessment List",
      listDescription: "A list of all created assessments.",
      tableHeaderTitle: "Title",
      tableHeaderType: "Type",
      tableHeaderPeriod: "Assessment Period",
      tableHeaderCompleted: "Completed",
      tableHeaderAvgScore: "Avg. Score",
      tableHeaderActions: "Actions",
      assessmentTypes: {
        monologue: "Monologue",
        dialogue: "Dialogue with AI"
      },
      periodAlways: "Always available",
      periodFrom: "From {date}",
      periodTo: "Until {date}",
      scoreNotApplicable: "N/A",
      menuOpen: "Open menu",
      menuViewResults: "View Results",
      menuEdit: "Edit",
      menuCopy: "Copy",
      copySuffix: " - Copy",
      menuDelete: "Delete",
      deleteDialogTitle: "Are you absolutely sure?",
      deleteDialogDescription: "This action cannot be undone. This will permanently delete the assessment and all related student results.",
      deleteDialogCancel: "Cancel",
      deleteDialogConfirm: "Delete",
      deleteToast: {
        title: "Assessment Deleted",
        description: "The assessment has been successfully deleted."
      },
      copyToast: {
        title: "Assessment Copied",
        description: "A copy of the '{title}' assessment has been created.",
      },
      noAssessments: {
          title: "No assessments created yet.",
          description: "Click the button above to create your first assessment!"
      }
    },
    teacherAssessmentForm: {
      createTitle: "Create New Assessment",
      createDescription: "Fill out the form below to create a new speaking assessment.",
      editTitle: "Edit Assessment",
      editDescription: "Update the form below to edit the assessment details.",
      optional: "Optional",
      freeTalkDefaults: {
          topic: "Have a free conversation with the AI.",
          prompt: "Have a free conversation in English with the AI. Click 'Start Conversation' when you're ready.",
          expectedFormat: "The student should engage in a natural conversation. The AI will evaluate overall fluency, pronunciation, vocabulary, and grammar."
      },
      typeLabel: "Assessment Type",
      typeMonologue: "Monologue",
      typeDialogue: "Dialogue with AI",
      scenarioLabel: "Dialogue Scenario",
      scenarioPlaceholder: "Select a scenario...",
      scenarioDescription: "Choose a role-playing situation for the Dialogue with AI type.",
      scenarios: {
          freeTalk: "Free Talk",
          orderingFood: "Ordering Food",
          airportCheckIn: "Airport Check-in",
          shopping: "Shopping",
      },
      titleLabel: "Assessment Title",
      titlePlaceholder: "e.g., Unit 7: Hobbies and Interests",
      titleDescription: "The name of the assessment that will be shown to students.",
      topicLabel: "Assessment Topic",
      topicPlaceholder: "e.g., Talk about your favorite hobby for 1 minute.",
      topicDescription: "A brief topic that will be shown in the assessment list.",
      promptLabel: "Student Prompt (Monologue)",
      promptPlaceholder: "Enter the detailed prompt you want to show the student.",
      promptDescription: "The detailed instructions the student will see when they start.",
      scenarioPromptLabel: "Situation Description (Dialogue)",
      scenarioPromptPlaceholder: "Enter a description of the situation for the student (e.g., You are a customer. Order food from the AI employee).",
      scenarioPromptDescription: "This helps the student understand their role and start the conversation.",
      expectedFormatLabel: "Grading Criteria for AI",
      expectedFormatPlaceholder: "Describe the expected response or key elements for the AI to grade against.",
      expectedFormatDescription: "This is used to improve the accuracy of AI feedback. It's required for Monologue and optional for Dialogue with AI.",
      startDateLabel: "Start Date (Optional)",
      startDateDescription: "Set a date when the assessment becomes available.",
      endDateLabel: "End Date (Optional)",
      endDateDescription: "Set a date when the assessment closes.",
      datePlaceholder: "Pick a date",
      cancelButton: "Cancel",
      createButton: "Create Assessment",
      creatingButton: "Creating...",
      saveButton: "Save Changes",
      savingButton: "Saving...",
      createSuccessToast: {
        title: "Success!",
        description: "The '{title}' assessment has been successfully created.",
      },
      editSuccessToast: {
        title: "Success!",
        description: "The '{title}' assessment has been successfully updated.",
      },
      errors: {
        titleRequired: "Title is required.",
        topicRequired: "Topic is required.",
        promptRequired: "Prompt is required.",
        expectedFormatRequired: "Expected format is required.",
        endDate: "End date cannot be earlier than start date.",
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

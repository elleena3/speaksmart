import { FreeTalkFeedbackView } from "./free-talk-feedback-view"

// This is a server component, but it will pass data to a client component.
export default function FreeTalkResultsPage() {
  const assessmentTitle = "자유 대화 결과";
  
  // In a real app, we would get the conversation from the server after the AI call.
  // For now, we pass a mock object to the view component, which will handle the client-side logic.
  const mockFeedback = {
    studentFeedback: {
      overall: "전반적으로 좋은 대화였습니다! 몇 가지 개선점을 통해 더 자연스러운 대화를 할 수 있을 거예요.",
      rubric: {
        fluency: { score: 3, feedback: "대화의 흐름은 좋았지만, 가끔씩 적절한 단어를 찾기 위해 멈추는 경향이 있었습니다. 자신감을 갖고 계속 연습하면 더 나아질 것입니다." },
        pronunciation: { score: 4, feedback: "발음은 매우 명확하고 이해하기 쉬웠습니다. 'R'과 'L' 발음을 조금 더 구분해서 연습하면 완벽할 거예요." },
        vocabulary: { score: 3, feedback: "익숙한 주제에 대해서는 다양한 어휘를 사용했지만, 새로운 주제에서는 기본적인 단어 위주로 사용하는 경향이 보였습니다. 다양한 분야의 단어를 접해보세요." },
        grammar: { score: 2, feedback: "간단한 문장 구조는 정확했지만, 복잡한 문장을 만들 때 시제나 수일치에서 실수가 있었습니다. 문법 규칙을 다시 한번 복습하는 것이 도움이 될 것입니다." },
      }
    },
    teacherGuidance: "학생은 기본적인 의사소통에는 문제가 없으나, 자신감 부족으로 인해 잠재력을 전부 발휘하지 못하고 있습니다. 롤플레잉 활동을 통해 다양한 상황에 대한 순발력을 길러주고, 어휘 확장을 위해 매일 새로운 단어 5개씩 학습하는 과제를 제안하는 것을 추천합니다. 특히 복잡한 문장 구조 연습을 위한 쓰기 연습을 병행하면 효과적일 것입니다."
  };

  return (
    <FreeTalkFeedbackView
      assessmentTitle={assessmentTitle}
      mockFeedback={mockFeedback}
    />
  )
}

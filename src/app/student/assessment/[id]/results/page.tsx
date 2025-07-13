import { FeedbackView } from "./feedback-view"
import { redirect } from 'next/navigation';

const aiFeedback = {
  feedback: "취미에 대해 훌륭하게 설명해주셨어요! 명확하고 좋은 속도로 말씀하셨습니다. 주제에 맞는 어휘를 사용하셨네요. \n\n**개선할 점:**\n\n*   **발음:** 'three'나 'with' 같은 단어에서 'th' 발음에 유의해주세요. 텅 트위스터를 연습하면 도움이 될 거예요.\n*   **유창성:** 몇 번의 멈춤이 있었어요. 아이디어를 더 부드럽게 연결해보세요. 'also', 'in addition', 'because' 같은 연결어를 사용하면 좋습니다.\n\n계속해서 좋은 모습 보여주세요!",
}

export default function AssessmentResultsPage({ params }: { params: { id: string } }) {
  if (params.id === 'free-talk') {
    redirect('/student/assessment/free-talk/results');
  }

  return (
    <FeedbackView
      assessmentId={params.id}
      assessmentTitle="7단원: 취미와 관심사"
      aiFeedback={aiFeedback.feedback}
    />
  )
}

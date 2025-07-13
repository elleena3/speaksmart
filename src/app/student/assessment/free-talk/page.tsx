
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FreeTalkView } from "./free-talk-view"
import { useSearchParams } from "next/navigation"
import { type Scenario } from "@/lib/types"
import { useLanguage } from "@/context/language-context"

// Mock data, in a real app this would come from the assessment linked to this page
const mockAssessmentDetails: { [key: string]: { title: string, prompt: string, scenario: Scenario } } = {
  "free-talk": {
    title: "자유 대화",
    prompt: "AI와 자유롭게 영어로 대화해 보세요. 준비가 되면 '대화 시작' 버튼을 누르세요.",
    scenario: "free-talk"
  },
  "ordering-food": {
    title: "상황극: 음식 주문하기",
    prompt: "당신은 손님입니다. AI 종업원에게 음식을 주문하세요.",
    scenario: "ordering-food"
  },
  "airport-check-in": {
    title: "상황극: 공항 체크인",
    prompt: "당신은 승객입니다. AI 항공사 직원에게 체크인을 하세요.",
    scenario: "airport-check-in"
  },
  "shopping": {
    title: "상황극: 쇼핑하기",
    prompt: "당신은 손님입니다. AI 상점 직원에게 원하는 물건에 대해 질문하고 구매하세요.",
    scenario: "shopping"
  },
}

export default function FreeTalkPage() {
  const searchParams = useSearchParams()
  const { t } = useLanguage();
  const scenario = (searchParams.get('scenario') as Scenario) || 'free-talk';

  const details = mockAssessmentDetails[scenario] || mockAssessmentDetails['free-talk'];

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{details.title}</CardTitle>
          <CardDescription>{details.prompt}</CardDescription>
        </CardHeader>
        <CardContent>
          <FreeTalkView scenario={details.scenario} />
        </CardContent>
      </Card>
    </div>
  )
}



"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FreeTalkView } from "./free-talk-view"
import { useSearchParams } from "next/navigation"
import { type Scenario } from "@/lib/types"
import { useLanguage } from "@/context/language-context"
import { useEffect, useState } from "react"

type Details = { 
  title: string; 
  prompt: string; 
  scenario: Scenario;
} | null;


const mockAssessmentDetails: { [key: string]: { title: string; prompt: string; scenario: Scenario, id?: string } } = {
  "free-talk": {
    id: "free-talk-default",
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
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [details, setDetails] = useState<Details>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const scenario = (searchParams.get('scenario') as Scenario) || 'free-talk';
    const assessmentId = searchParams.get('id');

    if (assessmentId) {
        const storedAssessments = JSON.parse(localStorage.getItem('assessments') || '[]');
        const found = storedAssessments.find((a: any) => a.id === assessmentId);
        if (found) {
            setDetails(found);
            return;
        }
    }
    
    // Fallback to mock data if not found in local storage or no ID
    const mockData = Object.values(mockAssessmentDetails).find(d => d.scenario === scenario);
    setDetails(mockData || mockAssessmentDetails['free-talk']);

  }, [searchParams, isClient]);


  if (!isClient || !details) {
    return <div>Loading...</div>; // Or a loading spinner
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{details.title}</CardTitle>
          <CardDescription>{details.prompt}</CardDescription>
        </CardHeader>
        <CardContent>
          <FreeTalkView scenario={details.scenario} scenarioPrompt={details.prompt} />
        </CardContent>
      </Card>
    </div>
  )
}

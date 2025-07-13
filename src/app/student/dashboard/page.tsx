
"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { type Assessment } from "@/lib/types"
import { ArrowRight, CheckCircle2, History, MessageCircle, Mic } from "lucide-react"
import { useLanguage } from "@/context/language-context"

const allAssessments: Assessment[] = [
  { id: "free-talk-default", title: "자유 대화", topic: "AI와 자유롭게 대화하세요.", status: "할 일", assessmentType: "dialogue", scenario: "free-talk" },
  { id: "4", title: "7단원: 취미와 관심사", topic: "가장 좋아하는 취미에 대해 1분간 이야기하세요.", status: "할 일", assessmentType: "monologue" },
  { id: "3", title: "중간 말하기 시험", topic: "성적 및 피드백 검토", status: "채점 완료", assessmentType: "monologue" },
  { id: "2", title: "6단원: 사람 묘사하기", topic: "성적 및 피드백 검토", status: "채점 완료", assessmentType: "monologue" },
  { id: "1", title: "5단원: 나의 일과", topic: "성적 및 피드백 검토", status: "채점 완료", assessmentType: "monologue" },
];

function AssessmentCard({ assessment }: { assessment: Assessment }) {
  const { t } = useLanguage();
  const isToDo = assessment.status === '할 일';

  const getStatusText = (status: Assessment['status']) => {
    switch (status) {
      case '할 일':
        return t.studentDashboard.status.todo;
      case '채점 완료':
        return t.studentDashboard.status.graded;
      default:
        return status;
    }
  }
  
  const getBadgeVariant = (status: Assessment['status']) => {
    switch (status) {
      case '할 일':
        return 'destructive';
      case '채점 완료':
        return 'default';
      default:
        return 'secondary';
    }
  }

  const getIcon = () => {
    if (!isToDo) return <CheckCircle2 className="h-5 w-5" />;
    return assessment.assessmentType === 'dialogue' ? <MessageCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />;
  }

  const getLink = () => {
    if (!isToDo) return `/student/assessment/${assessment.id}/results`;
    if (assessment.assessmentType === 'dialogue') {
      return `/student/assessment/free-talk?scenario=${assessment.scenario || 'free-talk'}`;
    }
    return `/student/assessment/${assessment.id}`;
  }


  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl">{assessment.title}</CardTitle>
          <Badge variant={getBadgeVariant(assessment.status)}>
            {getStatusText(assessment.status)}
          </Badge>
        </div>
        <CardDescription>{assessment.topic}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow" />
      <CardFooter>
        <Link href={getLink()} passHref className="w-full">
          <Button className="w-full">
            {getIcon()}
            <span className="ml-2">{isToDo ? t.studentDashboard.startAssessment : t.studentDashboard.viewResults}</span>
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}

export default function StudentDashboard() {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">{t.studentDashboard.welcome}</h2>
        <p className="text-muted-foreground">{t.studentDashboard.description}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {allAssessments.map((assessment) => (
          <AssessmentCard key={assessment.id} assessment={assessment} />
        ))}
      </div>
    </div>
  )
}

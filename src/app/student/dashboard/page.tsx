
"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { type Assessment } from "@/lib/types"
import { ArrowRight, CheckCircle2, History, MessageCircle } from "lucide-react"
import { useEffect, useState } from "react"

const allAssessments: Assessment[] = [
  { id: "free-talk", title: "자유 대화", topic: "AI와 3분간 자유롭게 대화하세요.", status: "할 일", special: true },
  { id: "4", title: "7단원: 취미와 관심사", topic: "가장 좋아하는 취미에 대해 1분간 이야기하세요.", status: "할 일", startDate: new Date("2024-06-01"), endDate: new Date("2024-06-07") },
  { id: "3", title: "중간 말하기 시험", topic: "성적 및 피드백 검토", status: "채점 완료" },
  { id: "2", title: "6단원: 사람 묘사하기", topic: "성적 및 피드백 검토", status: "채점 완료" },
  { id: "1", title: "5단원: 나의 일과", topic: "성적 및 피드백 검토", status: "채점 완료" },
];

function DueDate({ endDate }: { endDate?: Date }) {
    const [text, setText] = useState<string | null>(null);

    useEffect(() => {
        if (!endDate) {
            setText(null);
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        const diffTime = end.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) setText('마감일 지남');
        else if (diffDays === 0) setText('오늘 마감');
        else setText(`마감까지 ${diffDays}일 남음`);
    }, [endDate]);

    if (!text) return null;

    return <p className="text-sm font-semibold text-destructive">{text}</p>;
}


function AssessmentCard({ assessment }: { assessment: Assessment }) {
  const isToDo = assessment.status === '할 일';
  
  const getBadgeVariant = (status: Assessment['status']) => {
    if (assessment.special) return 'default';
    switch (status) {
      case '할 일':
        return 'destructive';
      case '채점 완료':
        return 'default';
      default:
        return 'secondary';
    }
  }

  const getIcon = (status: Assessment['status']) => {
    if (assessment.special) return <MessageCircle className="h-5 w-5" />;
    switch (status) {
      case '할 일':
        return <ArrowRight className="h-5 w-5" />;
      case '채점 완료':
        return <CheckCircle2 className="h-5 w-5" />;
      default:
        return <History className="h-5 w-5" />;
    }
  }

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl">{assessment.title}</CardTitle>
          <Badge variant={getBadgeVariant(assessment.status)} className={assessment.special ? "bg-accent text-accent-foreground" : ""}>
            {assessment.special ? "연습" : assessment.status}
          </Badge>
        </div>
        <CardDescription>{assessment.topic}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {isToDo && <DueDate endDate={assessment.endDate} />}
      </CardContent>
      <CardFooter>
        <Link href={isToDo ? `/student/assessment/${assessment.id}` : `/student/assessment/${assessment.id}/results`} passHref className="w-full">
          <Button className="w-full">
            {getIcon(assessment.status)}
            <span className="ml-2">{isToDo ? '평가 시작' : '결과 보기'}</span>
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}

export default function StudentDashboard() {
  const [availableAssessments, setAvailableAssessments] = useState<Assessment[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const filtered = allAssessments.filter(assessment => {
        if (assessment.status !== '할 일') {
          return true; 
        }
        
        if (assessment.id === 'free-talk') {
          return true;
        }
        
        const startDate = assessment.startDate ? new Date(assessment.startDate) : null;
        const endDate = assessment.endDate ? new Date(assessment.endDate) : null;

        if (!startDate && !endDate) {
          return true;
        }
        
        const isAfterStart = startDate ? today >= startDate : true;
        const isBeforeEnd = endDate ? today <= endDate : true;

        return isAfterStart && isBeforeEnd;
      });
      setAvailableAssessments(filtered);
    }
  }, [isMounted]);

  if (!isMounted) {
    return null; // or a loading spinner
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">다시 오신 것을 환영합니다!</h2>
        <p className="text-muted-foreground">대기 중이거나 완료된 평가입니다.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {availableAssessments.map((assessment) => (
          <AssessmentCard key={assessment.id} assessment={assessment} />
        ))}
      </div>
    </div>
  )
}

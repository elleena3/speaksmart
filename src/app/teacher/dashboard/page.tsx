
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { type TeacherAssessment } from "@/lib/types"
import { OverviewChart } from "./overview-chart"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useLanguage } from "@/context/language-context"

const initialAssessments: TeacherAssessment[] = [
  { id: "free-talk-default", title: "자유 대화", topic: "AI와 자유롭게 대화하세요.", studentsCompleted: 0, totalStudents: 20, averageScore: 0, dateCreated: "2024-06-01", assessmentType: "dialogue", scenario: "free-talk", prompt: "AI와 자유롭게 영어로 대화해 보세요. 준비가 되면 '대화 시작' 버튼을 누르세요." },
  { id: "4", title: "7단원: 취미와 관심사", topic: "가장 좋아하는 취미에 대해 1분간 이야기하세요.", studentsCompleted: 0, totalStudents: 20, averageScore: 0, dateCreated: "2024-05-31", assessmentType: "monologue", prompt: "가장 좋아하는 취미에 대해 이야기해주세요. 무엇인지, 왜 좋아하는지, 얼마나 자주 하는지 언급해야 합니다. 1분 동안 말할 시간이 주어집니다." },
  { id: "3", title: "중간 말하기 시험", topic: "성적 및 피드백 검토", studentsCompleted: 20, totalStudents: 20, averageScore: 91, dateCreated: "2024-05-24", assessmentType: "monologue", prompt: "" },
  { id: "2", title: "6단원: 사람 묘사하기", topic: "성적 및 피드백 검토", studentsCompleted: 15, totalStudents: 20, averageScore: 78, dateCreated: "2024-05-17", assessmentType: "monologue", prompt: "" },
  { id: "1", title: "5단원: 나의 일과", topic: "성적 및 피드백 검토", studentsCompleted: 18, totalStudents: 20, averageScore: 85, dateCreated: "2024-05-10", assessmentType: "monologue", prompt: "" },
  { id: "free-talk-test", title: "자유 대화 테스트", topic: "1", studentsCompleted: 0, totalStudents: 20, averageScore: 0, dateCreated: "2024-06-02", assessmentType: "dialogue", scenario: "free-talk", prompt: "자유 대화 테스트입니다. AI와 대화하세요." },
];


const LOCAL_STORAGE_KEY = 'assessments';

export default function TeacherDashboard() {
  const { t } = useLanguage();
  const [assessments, setAssessments] = useState<TeacherAssessment[]>([]);

  useEffect(() => {
    try {
      const storedAssessments = localStorage.getItem(LOCAL_STORAGE_KEY);
      let assessmentsData: TeacherAssessment[] = [];

      if (storedAssessments) {
        // If there's data in localStorage, use it.
        assessmentsData = JSON.parse(storedAssessments);
      } else {
        // Otherwise, initialize localStorage with the initial mock data.
        assessmentsData = initialAssessments;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialAssessments));
      }
      
      // Sort by creation date descending to show recent ones first
      assessmentsData.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
      setAssessments(assessmentsData);
      
    } catch (error) {
      console.error("Failed to load assessments from localStorage", error);
      // Fallback to initial data on error
      const sortedInitial = [...initialAssessments].sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
      setAssessments(sortedInitial);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">{t.teacherDashboard.dashboard}</h2>
        <Link href="/teacher/assessments/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> {t.teacherDashboard.createAssessment}
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.teacherDashboard.performanceOverview}</CardTitle>
          <CardDescription>{t.teacherDashboard.avgScoreDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <OverviewChart />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.teacherDashboard.recentAssessments}</CardTitle>
          <CardDescription>{t.teacherDashboard.recentAssessmentsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.teacherDashboard.title}</TableHead>
                <TableHead className="text-center">{t.teacherDashboard.completed}</TableHead>
                <TableHead className="text-center">{t.teacherDashboard.avgScore}</TableHead>
                <TableHead>{t.teacherDashboard.dateCreated}</TableHead>
                <TableHead><span className="sr-only">{t.teacherDashboard.actions}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.slice(0, 5).map((assessment) => (
                <TableRow key={assessment.id}>
                  <TableCell className="font-medium">
                    <Link href={`/teacher/assessment/${assessment.id}`} className="hover:underline text-primary">
                      {assessment.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={assessment.studentsCompleted === assessment.totalStudents ? "default" : "secondary"}>
                      {assessment.studentsCompleted} / {assessment.totalStudents}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-mono">
                      {assessment.averageScore > 0 ? `${assessment.averageScore}%` : t.teacherDashboard.noScore}
                    </Badge>
                  </TableCell>
                  <TableCell>{assessment.dateCreated}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">{t.teacherDashboard.openMenu}</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/teacher/assessment/${assessment.id}`}>{t.teacherDashboard.viewResults}</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                           <Link href={`/teacher/assessments/${assessment.id}/edit`}>{t.teacherDashboard.edit}</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive">{t.teacherDashboard.delete}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

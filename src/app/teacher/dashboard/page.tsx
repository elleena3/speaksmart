
"use client"

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

const assessments: TeacherAssessment[] = [
  { id: "1", title: "5단원: 나의 일과", studentsCompleted: 18, totalStudents: 20, averageScore: 85, dateCreated: "2024-05-10" },
  { id: "2", title: "6단원: 사람 묘사하기", studentsCompleted: 15, totalStudents: 20, averageScore: 78, dateCreated: "2024-05-17" },
  { id: "3", title: "중간 말하기 시험", studentsCompleted: 20, totalStudents: 20, averageScore: 91, dateCreated: "2024-05-24" },
  { id: "4", title: "7단원: 취미와 관심사", studentsCompleted: 0, totalStudents: 20, averageScore: 0, dateCreated: "2024-05-31" },
];

export default function TeacherDashboard() {
  const { t } = useLanguage();

  const content = {
      ko: {
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
      en: {
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
      }
  }

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

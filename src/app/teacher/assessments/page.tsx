
"use client"

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { type TeacherAssessment } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { format } from "date-fns";

const initialAssessments: TeacherAssessment[] = [
  { id: "1", title: "5단원: 나의 일과", studentsCompleted: 18, totalStudents: 20, averageScore: 85, dateCreated: "2024-05-10" },
  { id: "2", title: "6단원: 사람 묘사하기", studentsCompleted: 15, totalStudents: 20, averageScore: 78, dateCreated: "2024-05-17" },
  { id: "3", title: "중간 말하기 시험", studentsCompleted: 20, totalStudents: 20, averageScore: 91, dateCreated: "2024-05-24" },
  { id: "4", title: "7단원: 취미와 관심사", studentsCompleted: 0, totalStudents: 20, averageScore: 0, dateCreated: "2024-05-31", startDate: new Date("2024-06-01"), endDate: new Date("2024-06-07") },
];

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState(initialAssessments);
  const { toast } = useToast();

  const handleDelete = (assessmentId: string) => {
    setAssessments(assessments.filter(a => a.id !== assessmentId));
    toast({
      title: "평가 삭제됨",
      description: "평가가 성공적으로 삭제되었습니다."
    });
  }
  
  const formatDateRange = (startDate?: Date, endDate?: Date) => {
    if (startDate && endDate) {
      return `${format(startDate, "yy/MM/dd")} - ${format(endDate, "yy/MM/dd")}`;
    }
    if (startDate) {
      return `${format(startDate, "yy/MM/dd")}부터`;
    }
    if (endDate) {
      return `~ ${format(endDate, "yy/MM/dd")}까지`;
    }
    return "상시";
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">평가 관리</h2>
          <p className="text-muted-foreground">모든 평가를 생성, 편집 및 관리합니다.</p>
        </div>
        <Link href="/teacher/assessments/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> 새 평가 만들기
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>평가 목록</CardTitle>
          <CardDescription>생성된 모든 평가 목록입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {assessments.length > 0 ? (
             <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>제목</TableHead>
                 <TableHead>평가 기간</TableHead>
                 <TableHead className="text-center">완료</TableHead>
                 <TableHead className="text-center">평균 점수</TableHead>
                 <TableHead><span className="sr-only">작업</span></TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {assessments.map((assessment) => (
                 <TableRow key={assessment.id}>
                   <TableCell className="font-medium">
                     <Link href={`/teacher/assessment/${assessment.id}`} className="hover:underline text-primary">
                       {assessment.title}
                     </Link>
                   </TableCell>
                   <TableCell className="text-sm text-muted-foreground">
                      {formatDateRange(assessment.startDate, assessment.endDate)}
                   </TableCell>
                   <TableCell className="text-center">
                     <Badge variant={assessment.studentsCompleted === assessment.totalStudents ? "default" : "secondary"}>
                       {assessment.studentsCompleted} / {assessment.totalStudents}
                     </Badge>
                   </TableCell>
                   <TableCell className="text-center">
                     <Badge variant="outline" className="font-mono">
                       {assessment.averageScore > 0 ? `${assessment.averageScore}%` : '해당 없음'}
                     </Badge>
                   </TableCell>
                   <TableCell>
                     <AlertDialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">메뉴 열기</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/teacher/assessment/${assessment.id}`}>결과 보기</Link>
                          </DropdownMenuItem>
                           <DropdownMenuItem asChild>
                             <Link href={`/teacher/assessments/${assessment.id}/edit`}>편집</Link>
                           </DropdownMenuItem>
                           <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                                삭제
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  이 작업은 되돌릴 수 없습니다. 이 평가와 관련된 모든 데이터가 영구적으로 삭제됩니다.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(assessment.id)} className="bg-destructive hover:bg-destructive/90">삭제</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <h3 className="text-lg font-medium text-muted-foreground">아직 생성된 평가가 없습니다.</h3>
                <p className="text-sm text-muted-foreground mt-1">첫 번째 평가를 만들려면 위 버튼을 클릭하세요!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

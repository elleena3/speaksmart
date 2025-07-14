
"use client"

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Copy } from 'lucide-react';
import Link from 'next/link';
import { type TeacherAssessment } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { format } from "date-fns";
import { useLanguage } from '@/context/language-context';
import { type StudentResult } from '@/lib/types';


const initialAssessments: TeacherAssessment[] = [
  { id: "free-talk-default", title: "자유 대화", topic: "AI와 자유롭게 대화하세요.", studentsCompleted: 0, totalStudents: 20, averageScore: 0, dateCreated: "2024-06-01", assessmentType: "dialogue", scenario: "free-talk", prompt: "AI와 자유롭게 영어로 대화해 보세요. 준비가 되면 '대화 시작' 버튼을 누르세요." },
  { id: "4", title: "7단원: 취미와 관심사", topic: "가장 좋아하는 취미에 대해 1분간 이야기하세요.", studentsCompleted: 0, totalStudents: 20, averageScore: 0, dateCreated: "2024-05-31", assessmentType: "monologue", prompt: "가장 좋아하는 취미에 대해 이야기해주세요. 무엇인지, 왜 좋아하는지, 얼마나 자주 하는지 언급해야 합니다. 1분 동안 말할 시간이 주어집니다." },
  { id: "3", title: "중간 말하기 시험", topic: "성적 및 피드백 검토", studentsCompleted: 20, totalStudents: 20, averageScore: 91, dateCreated: "2024-05-24", assessmentType: "monologue", prompt: "" },
  { id: "2", title: "6단원: 사람 묘사하기", topic: "성적 및 피드백 검토", studentsCompleted: 15, totalStudents: 20, averageScore: 78, dateCreated: "2024-05-17", assessmentType: "monologue", prompt: "" },
  { id: "1", title: "5단원: 나의 일과", topic: "성적 및 피드백 검토", studentsCompleted: 18, totalStudents: 20, averageScore: 85, dateCreated: "2024-05-10", assessmentType: "monologue", prompt: "" },
  { id: "free-talk-test", title: "자유 대화 테스트", topic: "1", studentsCompleted: 0, totalStudents: 20, averageScore: 0, dateCreated: "2024-06-02", assessmentType: "dialogue", scenario: "free-talk", prompt: "자유 대화 테스트입니다. AI와 대화하세요." },
];

const LOCAL_STORAGE_KEY_ASSESSMENTS = 'assessments';
const LOCAL_STORAGE_KEY_RESULTS = 'student_results';

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<TeacherAssessment[]>([]);
  const { toast } = useToast();
  const { t, language } = useLanguage();

  useEffect(() => {
    // Load assessments from localStorage on component mount
    const storedAssessments = localStorage.getItem(LOCAL_STORAGE_KEY_ASSESSMENTS);
    let assessmentsData: TeacherAssessment[] = [];
    
    if (storedAssessments) {
      assessmentsData = JSON.parse(storedAssessments);
    } else {
      assessmentsData = initialAssessments;
      localStorage.setItem(LOCAL_STORAGE_KEY_ASSESSMENTS, JSON.stringify(initialAssessments));
    }
    
    setAssessments(assessmentsData);
  }, []);

  const handleCopy = (assessmentId: string) => {
    const assessmentToCopy = assessments.find(a => a.id === assessmentId);
    if (!assessmentToCopy) return;

    const newAssessment: TeacherAssessment = {
      ...assessmentToCopy,
      id: new Date().getTime().toString(),
      title: `${assessmentToCopy.title}${t.teacherAssessments.copySuffix}`,
      dateCreated: new Date().toISOString().split('T')[0],
      studentsCompleted: 0,
      averageScore: 0,
    };

    const updatedAssessments = [newAssessment, ...assessments];
    setAssessments(updatedAssessments);
    localStorage.setItem(LOCAL_STORAGE_KEY_ASSESSMENTS, JSON.stringify(updatedAssessments));

    toast({
      title: t.teacherAssessments.copyToast.title,
      description: t.teacherAssessments.copyToast.description.replace('{title}', assessmentToCopy.title),
    });
  }

  const handleDelete = (assessmentId: string) => {
    // Delete the assessment itself
    const updatedAssessments = assessments.filter(a => a.id !== assessmentId);
    setAssessments(updatedAssessments);
    localStorage.setItem(LOCAL_STORAGE_KEY_ASSESSMENTS, JSON.stringify(updatedAssessments));

    // Also delete associated student results to maintain data consistency
    const allResults: StudentResult[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_RESULTS) || '[]');
    const updatedResults = allResults.filter(r => r.assessmentId !== assessmentId);
    localStorage.setItem(LOCAL_STORAGE_KEY_RESULTS, JSON.stringify(updatedResults));

    toast({
      title: t.teacherAssessments.deleteToast.title,
      description: t.teacherAssessments.deleteToast.description
    });
  }
  
  const formatDateRange = (startDateStr?: Date, endDateStr?: Date) => {
    const { periodAlways, periodFrom, periodTo } = t.teacherAssessments;
    // Dates from localStorage might be strings, so convert them
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    if (startDate && endDate) {
      return `${format(startDate, "yy/MM/dd")} - ${format(endDate, "yy/MM/dd")}`;
    }
    if (startDate) {
      return periodFrom.replace('{date}', format(startDate, "yy/MM/dd"));
    }
    if (endDate) {
      return periodTo.replace('{date}', format(endDate, "yy/MM/dd"));
    }
    return periodAlways;
  };

  const getAssessmentTypeText = (assessment: TeacherAssessment) => {
    if (assessment.assessmentType === 'dialogue') {
      return t.teacherAssessments.assessmentTypes.dialogue;
    }
    return t.teacherAssessments.assessmentTypes.monologue;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">{t.teacherAssessments.title}</h2>
          <p className="text-muted-foreground">{t.teacherAssessments.description}</p>
        </div>
        <Link href="/teacher/assessments/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> {t.teacherAssessments.newAssessmentButton}
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t.teacherAssessments.listTitle}</CardTitle>
          <CardDescription>{t.teacherAssessments.listDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {assessments.length > 0 ? (
             <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>{t.teacherAssessments.tableHeaderTitle}</TableHead>
                 <TableHead>{t.teacherAssessments.tableHeaderType}</TableHead>
                 <TableHead>{t.teacherAssessments.tableHeaderPeriod}</TableHead>
                 <TableHead className="text-center">{t.teacherAssessments.tableHeaderCompleted}</TableHead>
                 <TableHead className="text-center">{t.teacherAssessments.tableHeaderAvgScore}</TableHead>
                 <TableHead><span className="sr-only">{t.teacherAssessments.tableHeaderActions}</span></TableHead>
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
                   <TableCell>
                      <Badge variant="outline">{getAssessmentTypeText(assessment)}</Badge>
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
                       {assessment.averageScore > 0 ? `${assessment.averageScore}%` : t.teacherAssessments.scoreNotApplicable}
                     </Badge>
                   </TableCell>
                   <TableCell>
                     <AlertDialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">{t.teacherAssessments.menuOpen}</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/teacher/assessment/${assessment.id}`}>{t.teacherAssessments.menuViewResults}</Link>
                          </DropdownMenuItem>
                           <DropdownMenuItem asChild>
                             <Link href={`/teacher/assessments/${assessment.id}/edit`}>{t.teacherAssessments.menuEdit}</Link>
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleCopy(assessment.id)}>
                            <Copy className="mr-2 h-4 w-4" />
                            {t.teacherAssessments.menuCopy}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                           <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                                {t.teacherAssessments.menuDelete}
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>{t.teacherAssessments.deleteDialogTitle}</AlertDialogTitle>
                              <AlertDialogDescription>
                                  {t.teacherAssessments.deleteDialogDescription}
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>{t.teacherAssessments.deleteDialogCancel}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(assessment.id)} className="bg-destructive hover:bg-destructive/90">{t.teacherAssessments.deleteDialogConfirm}</AlertDialogAction>
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
                <h3 className="text-lg font-medium text-muted-foreground">{t.teacherAssessments.noAssessments.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t.teacherAssessments.noAssessments.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

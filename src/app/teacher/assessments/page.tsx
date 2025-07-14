
"use client"

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Copy, Users } from 'lucide-react';
import Link from 'next/link';
import { type TeacherAssessment } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { format } from "date-fns";
import { useLanguage } from '@/context/language-context';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { MOCK_TEACHER_ASSESSMENTS } from '@/lib/mock-data';

type AssessmentWithCount = TeacherAssessment & {
    submissionCount: number;
}

export default function AssessmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [assessments, setAssessments] = useState<AssessmentWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useLanguage();

  const fetchAssessments = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    // 로컬 목업 데이터 사용
    const assessmentsWithCounts = MOCK_TEACHER_ASSESSMENTS.map(assessment => ({
        ...assessment,
        submissionCount: Math.floor(Math.random() * 15) // Generate random submission count
    }));

    setAssessments(assessmentsWithCounts);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/');
      } else {
        fetchAssessments();
      }
    }
  }, [user, authLoading, router, fetchAssessments]);


  const handleCopy = async (assessmentId: string) => {
    // This is a mock implementation
    const assessmentToCopy = assessments.find(a => a.id === assessmentId);
    if (!assessmentToCopy) return;

    const newAssessment = {
        ...assessmentToCopy,
        id: `mock-id-${Date.now()}`,
        title: `${assessmentToCopy.title} - 복사본`,
        createdAt: Date.now(),
        dateCreated: new Date().toISOString().split('T')[0],
        submissionCount: 0,
    };
    setAssessments(prev => [newAssessment, ...prev]);
    toast({
        title: "평가 복사됨 (목업)",
        description: `'${assessmentToCopy.title}' 평가의 복사본이 생성되었습니다.`,
    });
  }

  const handleDelete = async (assessmentId: string) => {
    // This is a mock implementation
    setAssessments(prev => prev.filter(a => a.id !== assessmentId));
    toast({
        title: "평가 삭제됨 (목업)",
        description: "평가가 성공적으로 삭제되었습니다."
    });
  }
  
  const formatDateRange = (startDate?: Date, endDate?: Date) => {
    const { periodAlways, periodFrom, periodTo } = t.teacherAssessments;
    
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
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-24">
              <p className="text-muted-foreground">평가 목록을 불러오는 중...</p>
            </div>
          ) : assessments.length > 0 ? (
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
                      <div className="flex items-center justify-center gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <Badge variant={assessment.submissionCount > 0 ? "default" : "secondary"}>
                          {assessment.submissionCount}
                        </Badge>
                      </div>
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
            <div className="text-center py-12 border-2 border-dashed rounded-lg m-4">
                <h3 className="text-lg font-medium text-muted-foreground">{t.teacherAssessments.noAssessments.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t.teacherAssessments.noAssessments.description}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


"use client"

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Copy, Users, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { type TeacherAssessment } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { format } from "date-fns";
import { useLanguage } from '@/context/language-context';
import { useAuth, mockStudents } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, deleteDoc, addDoc, writeBatch, orderBy } from 'firebase/firestore';

export default function AssessmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [assessments, setAssessments] = useState<TeacherAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const { toast } = useToast();
  const { t } = useLanguage();

  const fetchAssessments = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
        const assessmentsQuery = query(collection(db, "assessments"), where("uid", "==", user.uid));
        
        const allResultsQuery = query(collection(db, 'results'), where('teacherUid', '==', user.uid));

        const [assessmentsSnapshot, allResultsSnapshot] = await Promise.all([
            getDocs(assessmentsQuery),
            getDocs(allResultsQuery)
        ]);

        const submissionCounts = new Map<string, Set<string>>();
        allResultsSnapshot.forEach(resultDoc => {
            const result = resultDoc.data();
            if (!submissionCounts.has(result.assessmentId)) {
                submissionCounts.set(result.assessmentId, new Set());
            }
            submissionCounts.get(result.assessmentId)!.add(result.studentId);
        });

        const assessmentsData = assessmentsSnapshot.docs.map((doc) => {
            const assessment = { id: doc.id, ...doc.data() } as TeacherAssessment;
            assessment.submissionCount = submissionCounts.get(assessment.id)?.size || 0;
            return assessment;
        });

        // Sort assessments by createdAt in descending order (client-side)
        assessmentsData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        setAssessments(assessmentsData);
        setSelectedRowIds([]);
    } catch (error) {
        console.error("Error fetching assessments: ", error);
        toast({ title: "오류", description: "평가 목록을 불러오는 데 실패했습니다.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [user, toast]);

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
    const assessmentToCopy = assessments.find(a => a.id === assessmentId);
    if (!assessmentToCopy) return;

    try {
      const { id, ...copyData } = assessmentToCopy;
      
      await addDoc(collection(db, "assessments"), {
        ...copyData,
        title: `${copyData.title}`,
        topic: `${copyData.topic} (복사본)`,
        createdAt: Date.now(),
        dateCreated: new Date().toISOString().split('T')[0],
        submissionCount: 0,
        averageScore: 0,
      });

      toast({
        title: t.teacherAssessments.copyToast.title,
        description: t.teacherAssessments.copyToast.description.replace('{title}', assessmentToCopy.title),
      });
      fetchAssessments();
    } catch (error) {
      console.error("Error copying assessment:", error);
      toast({ title: "복사 실패", description: "평가를 복사하는 중 오류가 발생했습니다.", variant: "destructive"});
    }
  }

  const deleteAssessmentAndResults = async (assessmentIds: string[]) => {
    const batch = writeBatch(db);
    const resultsCollection = collection(db, 'results');

    // For each assessment, find and delete its results
    for (const id of assessmentIds) {
        // Delete the assessment itself
        const assessmentRef = doc(db, "assessments", id);
        batch.delete(assessmentRef);

        // Query for related results
        const resultsQuery = query(resultsCollection, where('assessmentId', '==', id));
        const resultsSnapshot = await getDocs(resultsQuery);

        // Add each result to the batch delete
        resultsSnapshot.forEach(resultDoc => {
            batch.delete(resultDoc.ref);
        });
    }

    // Commit the batch
    await batch.commit();
  }


  const handleDelete = async (assessmentId: string) => {
    try {
        await deleteAssessmentAndResults([assessmentId]);
        toast({
            title: t.teacherAssessments.deleteToast.title,
            description: t.teacherAssessments.deleteToast.description,
        });
        fetchAssessments(); 
    } catch (error) {
        console.error("Error deleting assessment:", error);
        toast({ title: "삭제 실패", description: "평가를 삭제하는 중 오류가 발생했습니다.", variant: "destructive" });
    }
  }

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteAssessmentAndResults(selectedRowIds);
      toast({
          title: "삭제 완료",
          description: `${selectedRowIds.length}개의 평가가 성공적으로 삭제되었습니다.`,
      });
      fetchAssessments();
    } catch (error) {
      console.error("Error deleting selected assessments:", error);
      toast({ title: "삭제 실패", description: "선택한 평가를 삭제하는 중 오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }
  
  const formatDateRange = (startDate?: string, endDate?: string) => {
    const { periodAlways, periodFrom, periodTo } = t.teacherAssessments;
    
    if (startDate && endDate) {
      return `${format(new Date(startDate), "yy/MM/dd")} - ${format(new Date(endDate), "yy/MM/dd")}`;
    }
    if (startDate) {
      return periodFrom.replace('{date}', format(new Date(startDate), "yy/MM/dd"));
    }
    if (endDate) {
      return periodTo.replace('{date}', format(new Date(endDate), "yy/MM/dd"));
    }
    return periodAlways;
  };

  const getAssessmentTypeText = (assessment: TeacherAssessment) => {
    if (assessment.assessmentType === 'dialogue') {
      return t.teacherAssessments.assessmentTypes.dialogue;
    }
    return t.teacherAssessments.assessmentTypes.monologue;
  }
  
  const getTargetAudienceText = (targetStudentIds?: string[] | 'all'): string => {
    if (!targetStudentIds || targetStudentIds === 'all') {
      return t.teacherAssessments.targetAudience.all;
    }
    if (Array.isArray(targetStudentIds)) {
      if (targetStudentIds.length === 1) {
        const student = mockStudents.find(s => s.uid === targetStudentIds[0]);
        return student ? student.displayName || '개별' : '개별';
      }
      if (targetStudentIds.length > 1) {
        return `${t.teacherAssessments.targetAudience.group} (${targetStudentIds.length})`;
      }
    }
    return t.teacherAssessments.targetAudience.all; // Fallback
  };
  
  const getCompletionFraction = (assessment: TeacherAssessment) => {
    const submissionCount = assessment.submissionCount ?? 0;
    const { targetStudentIds } = assessment;
    let totalStudents = 0;

    if (!targetStudentIds || targetStudentIds === 'all') {
      totalStudents = mockStudents.length;
    } else if (Array.isArray(targetStudentIds)) {
      totalStudents = targetStudentIds.length;
    }

    return `${submissionCount} / ${totalStudents}`;
  }

  const numSelected = selectedRowIds.length;
  const rowCount = assessments.length;

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
             <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : assessments.length > 0 ? (
            <div>
              <div className="p-4 border-b flex items-center gap-4">
                {numSelected > 0 ? (
                  <>
                    <span className="text-sm font-medium">{numSelected}개 선택됨</span>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive" size="sm" disabled={isDeleting}>
                              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                              선택 항목 삭제
                           </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                            <AlertDialogDescription>
                              선택된 {numSelected}개의 평가를 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">삭제</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">삭제할 평가를 선택하세요.</span>
                )}
              </div>
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead padding="checkbox" className="w-12 text-center">
                      <Checkbox
                        checked={rowCount > 0 && numSelected === rowCount}
                        onCheckedChange={(value) => {
                          if (value) {
                            setSelectedRowIds(assessments.map((a) => a.id));
                          } else {
                            setSelectedRowIds([]);
                          }
                        }}
                        aria-label="모두 선택"
                      />
                    </TableHead>
                    <TableHead>{t.teacherAssessments.tableHeaderTitle}</TableHead>
                    <TableHead className="text-center">{t.teacherAssessments.tableHeaderType}</TableHead>
                    <TableHead className="text-center">{t.teacherAssessments.tableHeaderPeriod}</TableHead>
                    <TableHead className="text-center">{t.teacherAssessments.tableHeaderCompleted}</TableHead>
                    <TableHead className="text-center">{t.teacherAssessments.tableHeaderAvgScore}</TableHead>
                    <TableHead className="text-center"><span className="sr-only">{t.teacherAssessments.tableHeaderActions}</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map((assessment) => (
                    <TableRow key={assessment.id} data-state={selectedRowIds.includes(assessment.id) && "selected"}>
                      <TableCell padding="checkbox" className="text-center">
                         <Checkbox
                          checked={selectedRowIds.includes(assessment.id)}
                          onCheckedChange={(value) => {
                            if (value) {
                              setSelectedRowIds([...selectedRowIds, assessment.id]);
                            } else {
                              setSelectedRowIds(selectedRowIds.filter((id) => id !== assessment.id));
                            }
                          }}
                          aria-label={`${assessment.title} 선택`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/teacher/assessment/${assessment.id}`} className="hover:underline text-primary">
                          {`${assessment.title}`}
                        </Link>
                        <p className="text-sm text-muted-foreground">{assessment.topic} ({getTargetAudienceText(assessment.targetStudentIds)})</p>
                      </TableCell>
                      <TableCell className="text-center">
                         <Badge variant="outline">{getAssessmentTypeText(assessment)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground text-center">
                         {formatDateRange(assessment.startDate, assessment.endDate)}
                      </TableCell>
                      <TableCell className="text-center">
                         <div className="flex items-center justify-center gap-1.5">
                           <Users className="h-4 w-4 text-muted-foreground" />
                           <Badge variant={(assessment.submissionCount ?? 0) > 0 ? "default" : "secondary"}>
                             {getCompletionFraction(assessment)}
                           </Badge>
                         </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono">
                          {assessment.averageScore > 0 ? `${assessment.averageScore}%` : t.teacherAssessments.scoreNotApplicable}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
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
            </div>
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

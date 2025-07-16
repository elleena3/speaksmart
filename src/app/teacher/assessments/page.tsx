
"use client"

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Copy, Users, Loader2 } from 'lucide-react';
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
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, deleteDoc, addDoc, orderBy } from 'firebase/firestore';

export default function AssessmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [assessments, setAssessments] = useState<TeacherAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useLanguage();

  const fetchAssessments = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
        const q = query(collection(db, "assessments"), where("uid", "==", user.uid), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const assessmentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherAssessment));
        setAssessments(assessmentsData);
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
        title: `${copyData.title}${t.teacherAssessments.copySuffix}`,
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

  const handleDelete = async (assessmentId: string) => {
    try {
        await deleteDoc(doc(db, "assessments", assessmentId));
        // Note: In a real-world scenario, you might want to handle related student results (e.g., delete them or archive them).
        toast({
            title: t.teacherAssessments.deleteToast.title,
            description: t.teacherAssessments.deleteToast.description,
        });
        fetchAssessments(); // Re-fetch to update the list
    } catch (error) {
        console.error("Error deleting assessment:", error);
        toast({ title: "삭제 실패", description: "평가를 삭제하는 중 오류가 발생했습니다.", variant: "destructive" });
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
                        <Badge variant={(assessment.submissionCount ?? 0) > 0 ? "default" : "secondary"}>
                          {assessment.submissionCount ?? 0}
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

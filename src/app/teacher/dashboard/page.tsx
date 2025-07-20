
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Users, Loader2 } from "lucide-react"
import Link from "next/link"
import { type TeacherAssessment } from "@/lib/types"
import { OverviewChart } from "./overview-chart"
import { useLanguage } from "@/context/language-context"
import { useAuth, mockStudents } from '@/context/auth-context';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function TeacherDashboard() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [assessments, setAssessments] = useState<TeacherAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAssessments = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
        const assessmentsQuery = query(
            collection(db, "assessments"), 
            where("uid", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(5)
        );
        
        const resultsQuery = query(
            collection(db, "results"),
            where("teacherUid", "==", user.uid)
        );

        const [assessmentsSnapshot, resultsSnapshot] = await Promise.all([
            getDocs(assessmentsQuery),
            getDocs(resultsQuery),
        ]);
        
        const assessmentsData = assessmentsSnapshot.docs.map(doc => {
            const assessmentData = { id: doc.id, ...doc.data() } as TeacherAssessment;
            
            // Filter results for the current assessment
            const relevantResults = resultsSnapshot.docs
                .map(rDoc => rDoc.data())
                .filter(r => r.assessmentId === assessmentData.id);

            // Get unique student IDs from the filtered results
            const uniqueStudentIds = new Set(relevantResults.map(r => r.studentId));
            
            // Update submissionCount to be the number of unique students
            assessmentData.submissionCount = uniqueStudentIds.size;
            
            return assessmentData;
        });
        
        setAssessments(assessmentsData);

    } catch (error) {
        console.error("Error fetching assessments:", error);
    } finally {
        setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        router.push('/');
        return;
    }
    fetchAssessments();

  }, [user, authLoading, router, fetchAssessments]);
  
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


  if (isLoading || authLoading) {
    return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">{t.teacherDashboard.dashboard}</h2>
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
                <TableHead className="text-right">{t.teacherDashboard.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.length > 0 ? assessments.map((assessment) => (
                <TableRow key={assessment.id}>
                  <TableCell className="font-medium">
                    <Link href={`/teacher/assessment/${assessment.id}`} className="hover:underline text-primary">
                      {`${assessment.title} (${getTargetAudienceText(assessment.targetStudentIds)})`}
                    </Link>
                     <p className="text-sm text-muted-foreground">{assessment.topic}</p>
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
                      {assessment.averageScore > 0 ? `${assessment.averageScore}%` : t.teacherDashboard.noScore}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {(assessment.submissionCount ?? 0) > 0 ? (
                       <Link href={`/teacher/assessment/${assessment.id}`} passHref>
                          <Button variant="outline" size="sm">
                            {t.teacherDashboard.viewResults}
                          </Button>
                       </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t.teacherDashboard.noResults}</span>
                    )}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    {t.teacherDashboard.noAssessments}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="justify-end border-t pt-4">
             <Link href="/teacher/assessments" passHref>
                <Button variant="secondary" size="sm">
                   {t.teacherDashboard.viewAllAssessments}
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </Link>
        </CardFooter>
      </Card>
    </div>
  )
}

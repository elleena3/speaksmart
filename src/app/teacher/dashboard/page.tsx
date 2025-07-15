
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, MoreHorizontal, ArrowRight, Users, Loader2 } from "lucide-react"
import Link from "next/link"
import { type TeacherAssessment } from "@/lib/types"
import { OverviewChart } from "./overview-chart"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useLanguage } from "@/context/language-context"
import { useAuth } from '@/context/auth-context';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from "date-fns";


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
        const q = query(
            collection(db, "assessments"), 
            where("uid", "==", user.uid), 
            limit(5)
        );

        const querySnapshot = await getDocs(q);
        const assessmentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherAssessment));
        // Sort manually after fetching
        assessmentsData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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
              {assessments.length > 0 ? assessments.map((assessment) => (
                <TableRow key={assessment.id}>
                  <TableCell className="font-medium">
                    <Link href={`/teacher/assessment/${assessment.id}`} className="hover:underline text-primary">
                      {assessment.title}
                    </Link>
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
                      {assessment.averageScore > 0 ? `${assessment.averageScore}%` : t.teacherDashboard.noScore}
                    </Badge>
                  </TableCell>
                  <TableCell>{assessment.createdAt ? format(new Date(assessment.createdAt), 'yyyy-MM-dd') : 'N/A'}</TableCell>
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
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    생성된 평가가 없습니다.
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

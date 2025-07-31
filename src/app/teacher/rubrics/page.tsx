
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { type TeacherAssessment } from '@/lib/types'; // Using this for type consistency, can be improved
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { format } from 'date-fns';

type Rubric = {
    id: string;
    name: string;
    createdAt: number;
    criteria: any[];
}

export default function RubricsPage() {
  const { user, loading: authLoading } = useAuth();
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchRubrics = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, "rubrics"), where("uid", "==", user.uid), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedRubrics = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Rubric));
      setRubrics(fetchedRubrics);
    } catch (e) {
      console.error("Error fetching rubrics: ", e);
      toast({ title: "오류", description: "루브릭 목록을 불러오는 데 실패했습니다.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchRubrics();
    }
  }, [user, authLoading, fetchRubrics]);

  const handleDeleteRubric = async (rubricId: string, rubricName: string) => {
    try {
        await deleteDoc(doc(db, "rubrics", rubricId));
        toast({ title: "삭제 완료", description: `'${rubricName}' 루브릭이 삭제되었습니다.` });
        fetchRubrics(); // Refresh the list
    } catch (error) {
        console.error("Error deleting rubric: ", error);
        toast({ title: "삭제 실패", description: "루브릭을 삭제하는 중 오류가 발생했습니다.", variant: "destructive" });
    }
  }


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">루브릭 평가 관리</h2>
          <p className="text-muted-foreground">
            여기에서 평가에 사용할 루브릭(채점 기준표)을 생성, 수정 및 관리할 수 있습니다.
          </p>
        </div>
        <Link href="/teacher/rubrics/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            새 루브릭 만들기
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>저장된 루브릭 목록</CardTitle>
          <CardDescription>지금까지 생성한 모든 루브릭의 목록입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rubrics.length > 0 ? (
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60%]">이름</TableHead>
                  <TableHead className="text-center">항목 수</TableHead>
                  <TableHead className="text-center">생성일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rubrics.map((rubric) => (
                  <TableRow key={rubric.id}>
                    <TableCell className="font-medium">{rubric.name}</TableCell>
                    <TableCell className="text-center">{rubric.criteria.length}</TableCell>
                    <TableCell className="text-center">{format(new Date(rubric.createdAt), 'yyyy-MM-dd')}</TableCell>
                    <TableCell className="text-right">
                       <AlertDialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">메뉴 열기</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem disabled>편집 (개발 중)</DropdownMenuItem>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive focus:text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" /> 삭제
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                      '{rubric.name}' 루브릭을 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteRubric(rubric.id, rubric.name)} className="bg-destructive hover:bg-destructive/90">삭제</AlertDialogAction>
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
              <h3 className="text-lg font-medium text-muted-foreground">저장된 루브릭 없음</h3>
              <p className="text-sm text-muted-foreground mt-1">
                '새 루브릭 만들기'를 클릭하여 첫 번째 루브릭을 생성하세요.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

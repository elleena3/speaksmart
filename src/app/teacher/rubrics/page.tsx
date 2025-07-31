
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, Loader2, MoreHorizontal, Trash2, Eye, Copy, Edit } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, getDocs, deleteDoc, doc, orderBy, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
  DropdownMenuSeparator,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

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
      const q = query(collection(db, "rubrics"), where("uid", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const fetchedRubrics = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Rubric));
      
      // Sort on the client-side instead of in the query
      fetchedRubrics.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      
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
  
  const handleCopyRubric = async (rubricId: string) => {
    const rubricToCopy = rubrics.find(r => r.id === rubricId);
    if (!rubricToCopy || !user) return;

    try {
      const { id, ...copyData } = rubricToCopy;
      
      await addDoc(collection(db, "rubrics"), {
        ...copyData,
        name: `${copyData.name} (복사본)`, 
        createdAt: Date.now(),
        uid: user.uid,
      });

      toast({
        title: "루브릭 복사 완료",
        description: `'${rubricToCopy.name}'의 복사본이 생성되었습니다.`,
      });
      fetchRubrics(); // Refresh the list
    } catch (error) {
      console.error("Error copying rubric:", error);
      toast({ title: "복사 실패", description: "루브릭을 복사하는 중 오류가 발생했습니다.", variant: "destructive"});
    }
  };


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
                  <TableHead className="w-[50%]">이름</TableHead>
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
                    <TableCell className="text-right space-x-2">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="sm"><Eye className="mr-2 h-4 w-4" /> 자세히 보기</Button>
                            </DialogTrigger>
                             <DialogContent className="max-w-4xl h-[600px] flex flex-col">
                                <DialogHeader>
                                    <DialogTitle>{rubric.name}</DialogTitle>
                                </DialogHeader>
                                <iframe 
                                    srcDoc={`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;margin:2em}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background-color:#f2f2f2}</style></head><body><h2>${rubric.name}</h2>${rubric.criteria.map((c:any) => `<h3>${c.name} (만점: ${c.maxScore}점)</h3><table><tr><th>점수</th><th>설명</th></tr>${c.details.map((d:any) => `<tr><td>${d.score}</td><td>${d.description}</td></tr>`).join('')}</table>`).join('')}</body></html>`}
                                    className="w-full flex-grow border-0"
                                    title={`${rubric.name} - 루브릭 미리보기`}
                                />
                            </DialogContent>
                        </Dialog>
                       <AlertDialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">메뉴 열기</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem disabled>
                                <Edit className="mr-2 h-4 w-4" />
                                편집 (개발 중)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopyRubric(rubric.id)}>
                                <Copy className="mr-2 h-4 w-4" />
                                복사
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
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

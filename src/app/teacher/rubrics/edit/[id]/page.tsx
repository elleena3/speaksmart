
'use client';

import { useState, useId, useEffect } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Trash2,
  PlusCircle,
  Save,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/auth-context';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { type TeacherAssessment } from '@/lib/types';


type RubricCriterion = {
  id: string;
  name: string;
  maxScore: number;
  details: { score: number; description: string }[];
};


export default function EditRubricPage() {
  const [verifiedCriteria, setVerifiedCriteria] = useState<RubricCriterion[]>([]);
  const [rubricName, setRubricName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const rubricId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (!user || !rubricId) return;
    
    const fetchRubricData = async () => {
        setIsLoading(true);
        try {
            const docRef = doc(db, "rubrics", rubricId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists() && docSnap.data().uid === user.uid) {
                const data = docSnap.data();
                setRubricName(data.name);
                setVerifiedCriteria(data.criteria.map((c: any) => ({ ...c, id: crypto.randomUUID() })));
            } else {
                toast({ title: "오류", description: "루브릭을 찾을 수 없거나 접근 권한이 없습니다.", variant: "destructive" });
                notFound();
            }
        } catch (e) {
            console.error("Error fetching rubric:", e);
            toast({ title: "오류", description: "루브릭 정보를 불러오는 데 실패했습니다.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }
    fetchRubricData();

  }, [user, rubricId, toast, notFound]);


  // --- Editing Functions ---
  const handleCriterionChange = (criterionId: string, field: 'name' | 'maxScore', value: string | number) => {
    setVerifiedCriteria(prev => 
      prev.map(c => c.id === criterionId ? { ...c, [field]: field === 'maxScore' ? Number(value) : value } : c)
    );
  };

  const handleDetailChange = (criterionId: string, detailIndex: number, field: 'score' | 'description', value: string | number) => {
    setVerifiedCriteria(prev => 
      prev.map(c => {
        if (c.id === criterionId) {
          const newDetails = [...c.details];
          newDetails[detailIndex] = { ...newDetails[detailIndex], [field]: field === 'score' ? Number(value) : value };
          return { ...c, details: newDetails };
        }
        return c;
      })
    );
  };
  
  const handleAddDetail = (criterionId: string) => {
    setVerifiedCriteria(prev =>
      prev.map(c => 
        c.id === criterionId 
        ? { ...c, details: [...c.details, { score: 0, description: "" }] } 
        : c
      )
    );
  };

  const handleDeleteDetail = (criterionId: string, detailIndex: number) => {
    setVerifiedCriteria(prev =>
      prev.map(c => 
        c.id === criterionId 
        ? { ...c, details: c.details.filter((_, i) => i !== detailIndex) } 
        : c
      )
    );
  };

  const handleDeleteCriterion = (criterionId: string) => {
    setVerifiedCriteria(prev => prev.filter(c => c.id !== criterionId));
  };
  
  const handleAddCriterion = () => {
    setVerifiedCriteria(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "새로운 평가 항목",
        maxScore: 5,
        details: [{ score: 5, description: "최고 수준" }],
      },
    ]);
  };
  
  const handleUpdateDb = async () => {
    if (!user || !rubricId) {
        toast({ title: "오류", description: "필수 정보가 없습니다.", variant: "destructive" });
        return;
    }
    if (!rubricName.trim()) {
        toast({ title: "이름 입력 필요", description: "루브릭의 이름을 입력해주세요.", variant: "destructive" });
        return;
    }
    if (verifiedCriteria.length === 0) {
        toast({ title: "기준 없음", description: "하나 이상의 평가 기준이 있어야 합니다.", variant: "destructive" });
        return;
    }
    
    setIsSaving(true);
    try {
        const docRef = doc(db, "rubrics", rubricId);
        await updateDoc(docRef, {
            name: rubricName,
            criteria: verifiedCriteria.map(({ id, ...rest }) => rest), // Remove temporary id before saving
        });
        toast({ title: '수정 완료', description: `'${rubricName}' 루브릭이 성공적으로 업데이트되었습니다.` });
        router.push('/teacher/rubrics');
    } catch (e: any) {
        console.error("Error updating rubric:", e);
        toast({ title: '수정 실패', description: "루브릭을 수정하는 중 오류가 발생했습니다.", variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  }
  
  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>루브릭 편집</CardTitle>
          <CardDescription>루브릭의 이름과 세부 채점 기준을 수정하고 저장하세요.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="rubric-name" className="text-base font-semibold">루브릭 이름</Label>
                    <Input 
                        id="rubric-name"
                        placeholder="예: 1학기 영어 말하기 평가 기준표"
                        value={rubricName}
                        onChange={(e) => setRubricName(e.target.value)}
                    />
                </div>
                 <Accordion type="multiple" defaultValue={verifiedCriteria.map(c => c.id)} className="w-full">
                    {verifiedCriteria.map((criterion) => (
                      <AccordionItem key={criterion.id} value={criterion.id} className="border-b-0">
                        <Card className="mb-2">
                            <CardHeader className="p-0">
                                <AccordionTrigger className="p-4 hover:no-underline">
                                    <Input 
                                        value={criterion.name} 
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleCriterionChange(criterion.id, 'name', e.target.value)}
                                        className="text-lg font-semibold border-none shadow-none focus-visible:ring-1 p-1 h-auto flex-grow"
                                    />
                                   <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                        <Label htmlFor={`max-score-${criterion.id}`} className="text-sm">만점</Label>
                                        <Input
                                            id={`max-score-${criterion.id}`}
                                            type="number"
                                            value={criterion.maxScore}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => handleCriterionChange(criterion.id, 'maxScore', e.target.value)}
                                            className="w-16"
                                        />
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCriterion(criterion.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                   </div>
                                </AccordionTrigger>
                            </CardHeader>
                            <AccordionContent>
                               <div className="p-4 space-y-4 border-t">
                                    {criterion.details.map((detail, index) => (
                                        <div key={index} className="flex items-start gap-4">
                                            <div className="flex items-center gap-2">
                                                <Label htmlFor={`score-${criterion.id}-${index}`} className="whitespace-nowrap">점수</Label>
                                                <Input
                                                    id={`score-${criterion.id}-${index}`}
                                                    type="number"
                                                    value={detail.score}
                                                    onChange={(e) => handleDetailChange(criterion.id, index, 'score', e.target.value)}
                                                    className="w-20"
                                                />
                                            </div>
                                            <Textarea
                                                placeholder="세부 채점 기준을 입력하세요..."
                                                value={detail.description}
                                                onChange={(e) => handleDetailChange(criterion.id, index, 'description', e.target.value)}
                                                className="flex-grow"
                                                rows={2}
                                            />
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteDetail(criterion.id, index)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button variant="outline" size="sm" onClick={() => handleAddDetail(criterion.id)}>
                                        <PlusCircle className="mr-2 h-4 w-4"/> 세부 기준 추가
                                    </Button>
                               </div>
                            </AccordionContent>
                        </Card>
                      </AccordionItem>
                    ))}
                </Accordion>
                 <Button variant="secondary" onClick={handleAddCriterion} className="w-full">
                    <PlusCircle className="mr-2 h-4 w-4" /> 평가 요소 추가
                </Button>
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => router.back()}>취소</Button>
                    <Button onClick={handleUpdateDb} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        변경사항 저장
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

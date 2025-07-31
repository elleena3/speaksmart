
'use client';

import { useState, useId } from 'react';
import { useRouter } from 'next/navigation';
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
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Upload,
  ChevronDown,
  Trash2,
  PlusCircle,
  Save,
  PenSquare,
} from 'lucide-react';
import { analyzeRubricFile, type AnalyzeRubricFileOutput } from '@/ai/flows/analyze-rubric-file-flow';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/auth-context';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type AnalysisState = 'idle' | 'analyzing' | 'analyzed' | 'error';
type RubricCriterion = AnalyzeRubricFileOutput['criteria'][0] & { id: string };

const defaultRubricTemplate: RubricCriterion[] = [
  {
    id: crypto.randomUUID(),
    name: "유창성 (Fluency)",
    maxScore: 5,
    details: [
      { score: 5, description: "원어민과 가까운 속도와 리듬으로 매우 자연스럽게 말함." },
      { score: 4, description: "큰 막힘 없이 안정적인 속도로 말함." },
      { score: 3, description: "비교적 이해 가능한 속도로 말하지만, 머뭇거림이 눈에 띔." },
      { score: 2, description: "매우 느리고 자주 끊어지며 말함." },
      { score: 1, description: "단어 단위로 말함." },
    ],
  },
  {
    id: crypto.randomUUID(),
    name: "발음 및 억양 (Pronunciation & Intonation)",
    maxScore: 5,
    details: [
      { score: 5, description: "발음이 매우 명확하고 자연스러운 억양을 사용함." },
      { score: 4, description: "대부분의 발음이 정확하여 쉽게 이해할 수 있음." },
      { score: 3, description: "일부 단어의 발음이 부정확하여 가끔 재확인이 필요함." },
      { score: 2, description: "부정확한 발음이 많아 이해하기 위해 노력이 필요함." },
      { score: 1, description: "발음을 거의 이해할 수 없음." },
    ],
  },
  {
    id: crypto.randomUUID(),
    name: "문법 (Grammar)",
    maxScore: 5,
    details: [
      { score: 5, description: "복잡한 문장 구조를 포함하여 다양한 문법을 거의 실수 없이 사용함." },
      { score: 4, description: "일상적인 문법 구조를 대부분 정확하게 사용함." },
      { score: 3, description: "기본적인 문장 구조는 사용하나, 반복적인 실수가 나타남." },
      { score: 2, description: "기본적인 문장 구성에도 오류가 많음." },
      { score: 1, description: "문장을 거의 구성하지 못함." },
    ],
  },
  {
    id: crypto.randomUUID(),
    name: "어휘 (Vocabulary)",
    maxScore: 5,
    details: [
      { score: 5, description: "주제에 맞게 폭넓고 수준 높은 어휘를 정확하게 사용함." },
      { score: 4, description: "주제에 대해 논의하기에 충분한 어휘를 구사함." },
      { score: 3, description: "기본적인 어휘는 구사하나, 어휘의 폭이 좁아 반복적인 단어를 사용함." },
      { score: 2, description: "매우 제한적인 어휘만 알고 있음." },
      { score: 1, description: "극소수의 기본 단어만 알고 있음." },
    ],
  },
];


export default function NewRubricPage() {
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [verifiedCriteria, setVerifiedCriteria] = useState<RubricCriterion[]>([]);
  const [rubricName, setRubricName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const fileInputId = useId();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: '지원하지 않는 파일 형식',
        description: '이미지(JPG, PNG) 또는 PDF 파일을 선택해주세요.',
        variant: 'destructive',
      });
      return;
    }
    setRubricFile(file);
    setAnalysisState('idle');
  };

  const handleAnalyze = async () => {
    if (!rubricFile) {
      toast({ title: '파일 없음', description: '분석할 루브릭 파일을 먼저 업로드해주세요.', variant: 'destructive' });
      return;
    }
    setAnalysisState('analyzing');
    setError(null);
    setVerifiedCriteria([]);
    toast({ title: 'AI 분석 시작', description: '루브릭 파일을 분석하여 기준을 추출합니다.' });

    try {
      const reader = new FileReader();
      reader.readAsDataURL(rubricFile);
      reader.onloadend = async () => {
        const fileDataUri = reader.result as string;
        const result = await analyzeRubricFile({ fileDataUri });
        setVerifiedCriteria(result.criteria.map(c => ({...c, id: crypto.randomUUID() })));
        setAnalysisState('analyzed');
        toast({ title: '분석 완료', description: 'AI가 루브릭 기준을 추출했습니다. 내용을 확인하고 수정하세요.' });
      }
    } catch (e: any) {
      setError(e.message || '알 수 없는 오류가 발생했습니다.');
      setAnalysisState('error');
      toast({ title: '분석 실패', description: e.message, variant: 'destructive' });
    }
  };
  
  const handleDirectCreate = () => {
    setVerifiedCriteria(defaultRubricTemplate);
    setAnalysisState('analyzed');
    toast({ title: '기본 루브릭 생성됨', description: '표준 템플릿을 기반으로 루브릭을 편집할 수 있습니다.' });
  };

  const handleReset = () => {
    setAnalysisState('idle');
    setRubricFile(null);
    setVerifiedCriteria([]);
    setError(null);
    setRubricName('');
    const input = document.getElementById(fileInputId) as HTMLInputElement;
    if(input) input.value = '';
  };

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
  
  const handleSaveToDb = async () => {
    if (!user) {
        toast({ title: "로그인 필요", description: "루브릭을 저장하려면 로그인이 필요합니다.", variant: "destructive" });
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
        await addDoc(collection(db, "rubrics"), {
            uid: user.uid,
            name: rubricName,
            criteria: verifiedCriteria.map(({ id, ...rest }) => rest), // Remove temporary id before saving
            createdAt: Date.now(),
        });
        toast({ title: '저장 완료', description: `'${rubricName}' 루브릭이 데이터베이스에 저장되었습니다.` });
        router.push('/teacher/rubrics');
    } catch (e: any) {
        console.error("Error saving rubric:", e);
        toast({ title: '저장 실패', description: "루브릭을 저장하는 중 오류가 발생했습니다.", variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI 기반 루브릭 생성 도구</CardTitle>
          <CardDescription>
            한글(hwp) 같은 문서를 pdf 또는 이미지로 변환하여 그 변환된 파일을 업로드하면 AI가 루브릭을 추출해줍니다. 표준 템플릿으로 직접 만들 수도 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={fileInputId}>옵션 1: 파일에서 추출하기</Label>
                <div className="flex gap-2">
                  <Input id={fileInputId} type="file" accept="image/*,application/pdf" onChange={handleFileChange} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>옵션 2: 직접 만들기</Label>
                 <Button onClick={handleDirectCreate} variant="secondary" className="w-full">
                    <PenSquare className="mr-2 h-4 w-4" />
                    표준 템플릿으로 직접 만들기
                </Button>
              </div>
            </div>
            <div className="flex justify-center gap-2">
              <Button onClick={handleAnalyze} disabled={!rubricFile || analysisState === 'analyzing'}>
                {analysisState === 'analyzing' ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />}
                파일에서 기준 추출
              </Button>
              <Button onClick={handleReset} variant="outline"><RefreshCw /></Button>
            </div>
        </CardContent>
      </Card>
      
      {(analysisState === 'analyzing' || analysisState === 'error' || analysisState === 'analyzed') && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: AI 분석 결과 확인 및 수정</CardTitle>
            <CardDescription>AI가 추출한 평가 기준입니다. 내용을 자유롭게 수정, 추가, 삭제한 후 이름을 정해 저장하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            {analysisState === 'analyzing' && (
              <div className="text-center p-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="mt-4 text-muted-foreground">AI가 파일을 읽고 평가 기준을 정리하고 있습니다...</p>
              </div>
            )}
            {analysisState === 'error' && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-1" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {analysisState === 'analyzed' && (
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
                                <CardHeader className="p-4 bg-muted/50">
                                    <div className="flex justify-between items-center">
                                       <AccordionTrigger className="p-0 hover:no-underline flex-grow">
                                            <div className="flex items-center gap-2">
                                                <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
                                                <Input 
                                                    value={criterion.name} 
                                                    onChange={(e) => handleCriterionChange(criterion.id, 'name', e.target.value)}
                                                    className="text-lg font-semibold border-none shadow-none focus-visible:ring-1 p-1 h-auto"
                                                />
                                            </div>
                                       </AccordionTrigger>
                                       <div className="flex items-center gap-2 ml-4">
                                            <Label htmlFor={`max-score-${criterion.id}`} className="text-sm">만점</Label>
                                            <Input
                                                id={`max-score-${criterion.id}`}
                                                type="number"
                                                value={criterion.maxScore}
                                                onChange={(e) => handleCriterionChange(criterion.id, 'maxScore', e.target.value)}
                                                className="w-16"
                                            />
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCriterion(criterion.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                       </div>
                                    </div>
                                </CardHeader>
                                <AccordionContent>
                                   <div className="p-4 space-y-4">
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
                        <Button onClick={handleSaveToDb} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            루브릭 데이터베이스에 저장
                        </Button>
                    </div>
                </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

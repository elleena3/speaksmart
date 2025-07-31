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
            이미지 또는 PDF 형식의 채점 기준표를 업로드하면 AI가 평가 항목을 자동으로 추출하고 편집할 수 있도록 도와줍니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={fileInputId}>Step 1: 루브릭 파일 업로드 (이미지/PDF)</Label>
            <div className="flex gap-2">
              <Input id={fileInputId} type="file" accept="image/*,application/pdf" onChange={handleFileChange} />
              <Button onClick={handleAnalyze} disabled={!rubricFile || analysisState === 'analyzing'}>
                {analysisState === 'analyzing' ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />}
                AI로 기준 추출
              </Button>
              <Button onClick={handleReset} variant="outline"><RefreshCw /></Button>
            </div>
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
                                                <div className="flex items-center gap-2 w-24">
                                                    <Label htmlFor={`score-${criterion.id}-${index}`} className="whitespace-nowrap">점수:</Label>
                                                    <Input
                                                        id={`score-${criterion.id}-${index}`}
                                                        type="number"
                                                        value={detail.score}
                                                        onChange={(e) => handleDetailChange(criterion.id, index, 'score', e.target.value)}
                                                        className="w-full"
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

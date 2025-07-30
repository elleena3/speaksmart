"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  FileText,
  Trash2,
  CircleDashed,
  CheckCircle2,
  BookCheck,
  Users
} from "lucide-react";
import { gradePdfSubmission, type GradePdfSubmissionOutput } from "@/ai/flows/grade-pdf-submission-flow";
import { Label } from "@/components/ui/label";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type FileStatus = "pending" | "analyzing" | "analyzed" | "error";
type FileWithStatus = {
  file: File;
  status: FileStatus;
  result?: GradePdfSubmissionOutput;
  id: string;
};

export function PdfGradingTool() {
  const [studentFiles, setStudentFiles] = useState<FileWithStatus[]>([]);
  const [criteriaFile, setCriteriaFile] = useState<File | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'student' | 'criteria') => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;

    const pdfFiles = Array.from(selectedFiles).filter(
      (file) => file.type === "application/pdf"
    );

    if (pdfFiles.length !== selectedFiles.length) {
      toast({
        title: "지원하지 않는 파일 형식 포함",
        description: "PDF 파일만 선택해주세요. 다른 형식의 파일은 제외되었습니다.",
        variant: "destructive",
      });
    }

    if (type === 'student') {
        setStudentFiles(pdfFiles.map(file => ({
            file,
            status: 'pending',
            id: `${file.name}-${file.lastModified}`
        })));
    } else { // criteria
        if(pdfFiles.length > 0) {
            setCriteriaFile(pdfFiles[0]);
        }
    }
  };
  
  const handleRemoveStudentFile = (idToRemove: string) => {
    setStudentFiles(prev => prev.filter((fw) => fw.id !== idToRemove));
  };
  
  const handleRemoveCriteriaFile = () => {
    setCriteriaFile(null);
    const fileInput = document.getElementById("criteria-upload") as HTMLInputElement;
    if(fileInput) fileInput.value = "";
  }

  const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleGrade = async () => {
    if (studentFiles.length === 0 || !criteriaFile) {
      toast({
        title: "정보 부족",
        description: "하나 이상의 학생 답안 PDF와 채점 기준표 PDF를 모두 업로드해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsGrading(true);
    toast({ title: "AI 채점 시작", description: `${studentFiles.length}개의 답안지를 순차적으로 채점합니다.` });

    const criteriaDataUri = await fileToDataUri(criteriaFile);

    const gradingPromises = studentFiles.map(async (sf) => {
      setStudentFiles(prev => prev.map(f => f.id === sf.id ? { ...f, status: 'analyzing' } : f));
      
      const studentDataUri = await fileToDataUri(sf.file);
      const result = await gradePdfSubmission({
        studentSubmission: { fileName: sf.file.name, dataUri: studentDataUri },
        criteria: { fileName: criteriaFile.name, dataUri: criteriaDataUri },
      });

      setStudentFiles(prev => prev.map(f => f.id === sf.id ? { ...f, status: result.error ? 'error' : 'analyzed', result } : f));
      return result;
    });

    await Promise.all(gradingPromises);
    
    setIsGrading(false);
    toast({ title: "모든 채점 완료", description: "모든 답안지에 대한 채점이 완료되었습니다." });
  };

  const handleReset = () => {
    setIsGrading(false);
    setStudentFiles([]);
    setCriteriaFile(null);
    const studentInput = document.getElementById("student-files-upload") as HTMLInputElement;
    if (studentInput) studentInput.value = "";
    const criteriaInput = document.getElementById("criteria-upload") as HTMLInputElement;
    if(criteriaInput) criteriaInput.value = "";
  };
  
  const isGradeButtonDisabled = useMemo(
    () => studentFiles.length === 0 || !criteriaFile || isGrading,
    [studentFiles, criteriaFile, isGrading]
  );

  return (
    <CardContent className="pt-6">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <Label htmlFor="student-files-upload" className="flex items-center gap-2"><Users/> 학생 답안 파일 (PDF, 다중 선택 가능)</Label>
                <Input id="student-files-upload" type="file" accept="application/pdf" onChange={(e) => handleFileChange(e, 'student')} multiple disabled={isGrading}/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="criteria-upload" className="flex items-center gap-2"><BookCheck/> 채점 기준 파일 (PDF, 1개)</Label>
                <Input id="criteria-upload" type="file" accept="application/pdf" onChange={(e) => handleFileChange(e, 'criteria')} disabled={isGrading} />
            </div>
        </div>
        
        {criteriaFile && (
            <div className="p-2 border rounded-md bg-green-50 border-green-200">
                <div className="flex items-center justify-between text-sm p-1 rounded">
                    <span className="truncate font-medium text-green-800">기준 파일: {criteriaFile.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRemoveCriteriaFile} disabled={isGrading}>
                        <Trash2 className="h-4 w-4 text-green-700"/>
                    </Button>
                </div>
            </div>
        )}

        <div className="flex gap-2 pt-2">
            <Button onClick={handleGrade} disabled={isGradeButtonDisabled} className="w-full">
                {isGrading ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />}
                {isGrading ? "채점 중..." : "AI 일괄 채점 시작"}
            </Button>
            <Button onClick={handleReset} variant="outline" disabled={isGrading}>
                <RefreshCw className="mr-2" /> 초기화
            </Button>
        </div>

        {studentFiles.length > 0 && (
            <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2 pt-4">개별 채점 결과</h3>
                {studentFiles.map((fw) => (
                    <Card key={fw.id}>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between text-base">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-5 w-5"/>
                                  {fw.file.name}
                                </div>
                                <div className="flex items-center gap-2">
                                  {fw.status === 'pending' && <span className="text-xs text-muted-foreground flex items-center gap-1"><CircleDashed className="h-4 w-4"/>대기중</span>}
                                  {fw.status === 'analyzing' && <span className="text-xs text-blue-500 flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin"/>분석중</span>}
                                  {fw.status === 'analyzed' && <span className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 className="h-4 w-4"/>완료</span>}
                                  {fw.status === 'error' && <span className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="h-4 w-4"/>오류</span>}
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveStudentFile(fw.id)} disabled={isGrading}>
                                      <Trash2 className="h-4 w-4"/>
                                  </Button>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        {fw.result && (
                            <CardContent>
                                {fw.result.error ? (
                                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                                        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-1"/>
                                        <p className="text-sm text-destructive">{fw.result.error}</p>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed markdown-content">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {fw.result.analysis || "분석 내용이 없습니다."}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </CardContent>
                        )}
                    </Card>
                ))}
            </div>
        )}
      </div>
    </CardContent>
  );
}

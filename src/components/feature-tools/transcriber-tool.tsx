
"use client";

import { useState, useRef, useId } from "react";
import { prepareMediaInput } from '@/lib/upload-tool-file';
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Mic, Sparkles } from "lucide-react";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { transcribeFile, type TranscriptionResult } from "@/ai/flows/transcribe-file";
import { useLanguage } from "@/context/language-context";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUDIO_MODELS, DEFAULT_AUDIO_MODEL } from "@/lib/evaluation-models";

const mimeType = 'audio/webm;codecs=opus';
type RecordingState = 'idle' | 'recording';

function AudioProcessor({
  onAnalyze,
  children,
  analyzeButtonText,
  analyzeButtonIcon: AnalyzeIcon = Sparkles,
}: {
  onAnalyze: (dataUri: string) => Promise<void>;
  children: React.ReactNode;
  analyzeButtonText: string;
  analyzeButtonIcon?: React.ElementType;
}) {
  // 여러 도구가 한 페이지에 함께 렌더링되므로 id 가 겹치지 않도록 생성합니다.
  const fileUploadId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        if (selectedFile.type.startsWith('audio/webm') || selectedFile.name.endsWith('.webm')) {
            setFile(selectedFile);
        } else {
            toast({
                title: t.teacherMisc.errors.invalidFileTitle,
                description: t.teacherMisc.errors.invalidFileDescription,
                variant: "destructive",
            });
            event.target.value = ''; // Reset file input
        }
    }
  };

  const processAudioBlob = async (blob: Blob) => {
    try {
      // 긴 녹음·큰 파일은 요청 본문 한도를 넘으므로 Storage 를 거칩니다.
      await onAnalyze(await prepareMediaInput(blob, 'transcribe', 'audio.webm'));
      setIsProcessing(false);
      return;
    } catch (error) {
      console.error("File reading error:", error);
      toast({ title: t.teacherMisc.errors.fileReadErrorTitle, description: t.teacherMisc.errors.fileReadErrorDescription, variant: "destructive" });
      setIsProcessing(false);
    };
  };

  const handleAnalyzeClick = async () => {
    if (!file) {
      toast({ title: t.teacherMisc.errors.noFileTitle, description: t.teacherMisc.errors.noFileDescription, variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    processAudioBlob(file);
  };

  const handleStartRecording = async () => {
    setFile(null); // Clear any selected file
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setFile(audioBlob as File); // Set the recorded blob as the file to be analyzed
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setRecordingState('recording');
    } catch (err) {
      console.error("Microphone access error:", err);
      toast({ title: t.teacherMisc.errors.micAccessErrorTitle, description: t.teacherMisc.errors.micAccessErrorDescription, variant: "destructive" });
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingState('idle');
    }
  };
  
  return (
    <CardContent className="space-y-4 pt-6">
      <div className="grid gap-2">
        <label htmlFor={fileUploadId} className="text-sm font-medium">{t.teacherMisc.audioProcessor.label}</label>
        <div className="flex gap-2">
            <Input id={fileUploadId} type="file" accept="audio/webm" onChange={handleFileChange} className="flex-grow" />
            {recordingState === 'idle' ? (
                <Button onClick={handleStartRecording} variant="outline" className="shrink-0">
                    <Mic className="mr-2 h-4 w-4" /> {t.teacherMisc.audioProcessor.recordButton}
                </Button>
            ) : (
                <Button onClick={handleStopRecording} variant="destructive" className="shrink-0">
                    <Loader2 className="mr-2 h-4 w-4 animate-pulse" /> {t.teacherMisc.audioProcessor.stopButton}
                </Button>
            )}
        </div>
        {file && <p className="text-sm text-muted-foreground">{t.teacherMisc.audioProcessor.selectedFileText.replace('{fileName}', (file.name || `${t.teacherMisc.audioProcessor.recordedAudio} (${(file.size/1024).toFixed(1)} KB)`))}</p>}
      </div>
      <Button onClick={handleAnalyzeClick} disabled={isProcessing || !file} className="w-full">
        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AnalyzeIcon className="mr-2 h-4 w-4" />}
        {isProcessing ? t.teacherMisc.audioProcessor.processingButton : analyzeButtonText}
      </Button>
      <div className="space-y-4">
        {isProcessing && (
            <div className="text-center p-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                <p className="mt-2 text-sm text-muted-foreground">{t.teacherMisc.audioProcessor.processingMessage}</p>
            </div>
        )}
        {children}
      </div>
    </CardContent>
  );
}

export function TranscriberTool() {
  const modelSelectId = useId();

  const [transcripts, setTranscripts] = useState<TranscriptionResult[]>([]);
  const [model, setModel] = useState<string>(DEFAULT_AUDIO_MODEL);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleAnalyze = async (dataUri: string) => {
    setTranscripts([]);
    toast({ title: t.teacherMisc.transcriberTool.toastStartTitle, description: t.teacherMisc.transcriberTool.toastStartDescription });
    try {
      const results = await transcribeFile(dataUri, model);
      setTranscripts(results);
      toast({ title: t.teacherMisc.transcriberTool.toastCompleteTitle, description: t.teacherMisc.transcriberTool.toastCompleteDescription });
    } catch (error: any) {
      console.error("Transcription error:", error);
      toast({ title: t.teacherMisc.errors.analysisErrorTitle, description: error.message || t.teacherMisc.errors.unknownError, variant: "destructive" });
    }
  };

  return (
    <AudioProcessor onAnalyze={handleAnalyze} analyzeButtonText={t.teacherMisc.transcriberTool.buttonText} analyzeButtonIcon={FileText}>
        <div className="grid gap-2">
          <Label htmlFor={modelSelectId} className="text-sm font-medium">AI 모델 선택</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger id={modelSelectId}>
              <SelectValue placeholder="모델을 선택하세요..." />
            </SelectTrigger>
            <SelectContent>
              {AUDIO_MODELS.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            음성을 직접 처리할 수 있는 모델만 표시됩니다. OpenAI·Claude 모델은 음성 입력을 지원하지 않습니다.
          </p>
        </div>

        {transcripts.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              <h3 className="text-lg font-semibold border-b pb-2">{t.teacherMisc.transcriberTool.resultsTitle}</h3>
              {transcripts.map((result, index) => (
                <div key={index} className="grid gap-2">
                  <label htmlFor={`transcript-output-${index}`} className="text-sm font-medium font-mono">{result.model}</label>
                  <Textarea id={`transcript-output-${index}`} readOnly value={result.transcript} className="text-sm bg-muted/50" rows={3} />
                </div>
              ))}
            </div>
        )}
    </AudioProcessor>
  );
}

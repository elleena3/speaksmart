
"use client"

import { useState, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Target, Mic, Bot, BookOpen, Sparkles, ScanText, KeyRound, AlertTriangle, MessageCircle, MicVocal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { transcribeFile, type TranscriptionResult } from "@/ai/flows/transcribe-file";
import { analyzePronunciation, type PronunciationAnalysisResult } from "@/ai/flows/analyze-pronunciation";
import { Progress } from "@/components/ui/progress";
import { RealtimeConversationTool } from "./realtime-conversation-tool";
import { ReadAloudTool } from "./read-aloud-tool";
import { HandwritingAnalyzerTool } from "./handwriting-analyzer-tool";
import { ConcurrentConversationTool } from "./concurrent-conversation-tool";
import { useLanguage } from "@/context/language-context";


// This component now handles the entire result creation and feedback display process.
export default function MiscPage() {
    const { t } = useLanguage();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === '2918') {
            setIsAuthenticated(true);
            setError('');
        } else {
            setError(t.teacherMisc.incorrectPasswordError);
            setPassword('');
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Card className="w-full max-w-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <KeyRound className="h-6 w-6"/> {t.teacherMisc.accessTitle}
                        </CardTitle>
                        <CardDescription>
                            {t.teacherMisc.accessDescription}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t.teacherMisc.passwordPlaceholder}
                                autoFocus
                            />
                            {error && (
                                <div className="flex items-center text-sm font-medium text-destructive">
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    {error}
                                </div>
                            )}
                            <Button type="submit" className="w-full">
                                {t.teacherMisc.confirmButton}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">{t.teacherMisc.title}</h2>
                <p className="text-muted-foreground">{t.teacherMisc.description}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FileText className="h-6 w-6"/> {t.teacherMisc.transcriberTool.title}</CardTitle>
                        <CardDescription>
                            {t.teacherMisc.transcriberTool.description}
                        </CardDescription>
                    </CardHeader>
                    <TranscriberTool />
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Target className="h-6 w-6"/> {t.teacherMisc.pronunciationAnalyzerTool.title}</CardTitle>
                        <CardDescription>
                            {t.teacherMisc.pronunciationAnalyzerTool.description}
                        </CardDescription>
                    </CardHeader>
                    <PronunciationAnalyzerTool />
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MessageCircle className="h-6 w-6"/> {t.teacherMisc.realtimeConversationTool.title}</CardTitle>
                        <CardDescription>
                            {t.teacherMisc.realtimeConversationTool.description}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <RealtimeConversationTool />
                    </CardContent>
                </Card>

                 <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MicVocal className="h-6 w-6"/> {t.teacherMisc.concurrentConversationTool.title}</CardTitle>
                        <CardDescription>
                           {t.teacherMisc.concurrentConversationTool.description}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <ConcurrentConversationTool />
                    </CardContent>
                </Card>

                 <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BookOpen className="h-6 w-6"/> {t.teacherMisc.readAloudTool.title}</CardTitle>
                        <CardDescription>
                            {t.teacherMisc.readAloudTool.description}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <ReadAloudTool />
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ScanText className="h-6 w-6"/> {t.teacherMisc.handwritingAnalyzerTool.title}</CardTitle>
                        <CardDescription>
                            {t.teacherMisc.handwritingAnalyzerTool.description}
                            <span className="block text-xs mt-1 text-blue-500">{t.teacherMisc.handwritingAnalyzerTool.note}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <HandwritingAnalyzerTool />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Reusable components from the original file - no change needed for them, but they must be present.
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

  const processAudioBlob = (blob: Blob) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      const base64Audio = reader.result as string;
      await onAnalyze(base64Audio);
      setIsProcessing(false);
    };
    reader.onerror = (error) => {
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
        setFile(audioBlob); // Set the recorded blob as the file to be analyzed
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
        <label htmlFor="file-upload" className="text-sm font-medium">{t.teacherMisc.audioProcessor.label}</label>
        <div className="flex gap-2">
            <Input id="file-upload" type="file" accept="audio/webm" onChange={handleFileChange} className="flex-grow" />
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
        {file && <p className="text-sm text-muted-foreground">{t.teacherMisc.audioProcessor.selectedFileText.replace('{fileName}', file.name.startsWith('blob:') ? `${t.teacherMisc.audioProcessor.recordedAudio} (${(file.size/1024).toFixed(1)} KB)` : file.name)}</p>}
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


function TranscriberTool() {
  const [transcripts, setTranscripts] = useState<TranscriptionResult[]>([]);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleAnalyze = async (dataUri: string) => {
    setTranscripts([]);
    toast({ title: t.teacherMisc.transcriberTool.toastStartTitle, description: t.teacherMisc.transcriberTool.toastStartDescription });
    try {
      const results = await transcribeFile(dataUri);
      setTranscripts(results);
      toast({ title: t.teacherMisc.transcriberTool.toastCompleteTitle, description: t.teacherMisc.transcriberTool.toastCompleteDescription });
    } catch (error: any) {
      console.error("Transcription error:", error);
      toast({ title: t.teacherMisc.errors.analysisErrorTitle, description: error.message || t.teacherMisc.errors.unknownError, variant: "destructive" });
    }
  };

  return (
    <AudioProcessor onAnalyze={handleAnalyze} analyzeButtonText={t.teacherMisc.transcriberTool.buttonText} analyzeButtonIcon={FileText}>
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

function PronunciationAnalyzerTool() {
  const [analysisResults, setAnalysisResults] = useState<PronunciationAnalysisResult[]>([]);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleAnalyze = async (dataUri: string) => {
    setAnalysisResults([]);
    toast({ title: t.teacherMisc.pronunciationAnalyzerTool.toastStartTitle, description: t.teacherMisc.pronunciationAnalyzerTool.toastStartDescription });
    try {
        const results = await analyzePronunciation(dataUri);
        setAnalysisResults(results);
        toast({ title: t.teacherMisc.pronunciationAnalyzerTool.toastCompleteTitle, description: t.teacherMisc.pronunciationAnalyzerTool.toastCompleteDescription });
    } catch (e) {
         console.error("Pronunciation analysis error:", e);
         toast({ title: t.teacherMisc.errors.analysisErrorTitle, description: (e as Error).message || t.teacherMisc.errors.unknownError, variant: "destructive" });
    }
  };

  return (
    <AudioProcessor onAnalyze={handleAnalyze} analyzeButtonText={t.teacherMisc.pronunciationAnalyzerTool.buttonText} analyzeButtonIcon={Target}>
        {analysisResults.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
            <h3 className="text-lg font-semibold border-b pb-2">{t.teacherMisc.pronunciationAnalyzerTool.resultsTitle}</h3>
            {analysisResults.map((result, index) => (
                <Card key={index}>
                <CardHeader>
                    <CardTitle className="text-base font-mono">{result.model}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="w-full">
                        <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-primary">{t.studentHistory.pronunciationScore}</span>
                            <span className="text-sm font-medium text-primary">{result.pronunciationScore}%</span>
                        </div>
                        <Progress value={result.pronunciationScore} className="h-2" />
                    </div>
                    <Textarea 
                        readOnly 
                        value={result.pronunciationFeedback} 
                        rows={6}
                        className="text-sm bg-muted/50"
                    />
                </CardContent>
                </Card>
            ))}
            </div>
        )}
    </AudioProcessor>
  );
}

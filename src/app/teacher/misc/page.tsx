
"use client";

import { useLanguage } from "@/context/language-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TranscriberTool } from "@/components/feature-tools/transcriber-tool";
import { PronunciationAnalyzerTool } from "@/components/feature-tools/pronunciation-analyzer-tool";
import { ReadAloudTool } from "@/components/feature-tools/read-aloud-tool";
import { HandwritingAnalyzerTool } from "@/components/feature-tools/handwriting-analyzer-tool";
import { PresentationAnalyzerTool } from "@/components/feature-tools/presentation-analyzer-tool";
import { InteractiveTextAnalyzer } from "@/components/feature-tools/interactive-text-analyzer";
import { YoutubeSummarizerTool } from "./youtube-summarizer-tool";
import { PdfGradingTool } from "./pdf-grading-tool";
import { PdfSequentialAnalyzerTool } from "./pdf-sequential-analyzer-tool";
import { PdfStorageAnalyzerTool } from "./pdf-storage-analyzer-tool";
import { HandwritingSubmissionAnalyzerTool } from "./handwriting-submission-analyzer-tool";
import { PdfMultiAnalyzerTool } from "./pdf-multi-analyzer-tool";
import { FirestoreTestTool } from "@/components/feature-tools/firestore-test-tool";
import { StorageUploaderTool } from "@/components/feature-tools/storage-uploader-tool";
import { TtsModelTesterTool } from "@/components/feature-tools/tts-model-tester-tool";

export default function MiscPage() {
    const { t } = useLanguage();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">{t.teacherMisc.title}</h2>
                <p className="text-muted-foreground">{t.teacherMisc.description}</p>
            </div>
            <div className="grid grid-cols-1 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>TTS 모델별 음성 테스트</CardTitle>
                        <CardDescription>현재 사용 가능한 Gemini TTS 모델의 목소리를 직접 들어보고 비교할 수 있습니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TtsModelTesterTool />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Firebase Firestore 테스트 도구</CardTitle>
                        <CardDescription>데이터베이스에 테스트 데이터를 쓰고, 읽고, 삭제하여 Firestore 연결 및 보안 규칙이 올바르게 작동하는지 확인합니다.</CardDescription>
                    </CardHeader>
                    <FirestoreTestTool />
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Firebase Storage 파일 업로드 도구</CardTitle>
                        <CardDescription>파일을 직접 Firebase Storage에 업로드하고 진행 상태와 결과 URL을 확인하여 파일 저장소 기능이 정상 작동하는지 테스트합니다.</CardDescription>
                    </CardHeader>
                    <StorageUploaderTool />
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>유튜브 영상 요약 도구</CardTitle>
                        <CardDescription>유튜브 영상 링크를 입력하면 AI가 영상 내용을 요약해줍니다. (자막이 있는 영상만 가능)</CardDescription>
                    </CardHeader>
                    <YoutubeSummarizerTool />
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>{t.teacherMisc.transcriberTool.title}</CardTitle>
                        <CardDescription>{t.teacherMisc.transcriberTool.description}</CardDescription>
                    </CardHeader>
                    <TranscriberTool />
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>{t.teacherMisc.pronunciationAnalyzerTool.title}</CardTitle>
                        <CardDescription>{t.teacherMisc.pronunciationAnalyzerTool.description}</CardDescription>
                    </CardHeader>
                    <PronunciationAnalyzerTool />
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>{t.teacherMisc.readAloudTool.title}</CardTitle>
                        <CardDescription>{t.teacherMisc.readAloudTool.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ReadAloudTool />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>상호작용 텍스트 분석기</CardTitle>
                        <CardDescription>지문의 단어를 클릭하여 번역, 사전, 해설, AI 리딩 기능을 사용해보세요.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <InteractiveTextAnalyzer />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>{t.teacherMisc.handwritingAnalyzerTool.title}</CardTitle>
                        <CardDescription>{t.teacherMisc.handwritingAnalyzerTool.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <HandwritingAnalyzerTool />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>자필 과제 채점 도구 (Beta)</CardTitle>
                        <CardDescription>학생의 손글씨 과제물(이미지, PDF)과 채점 기준(텍스트, 파일)을 함께 업로드하여 AI 자동 채점 및 피드백을 받아보세요.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <HandwritingSubmissionAnalyzerTool />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>{t.teacherMisc.presentationAnalyzerTool.title}</CardTitle>
                        <CardDescription>{t.teacherMisc.presentationAnalyzerTool.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <PresentationAnalyzerTool />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>다중 PDF 동시 분석기 (병렬 처리)</CardTitle>
                        <CardDescription>여러 개의 PDF 파일을 동시에 업로드하고 동일한 프롬프트를 적용하여 모든 파일의 분석 결과를 한 번에 받아봅니다.</CardDescription>
                    </CardHeader>
                    <PdfMultiAnalyzerTool />
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>다중 PDF 순차 분석기</CardTitle>
                        <CardDescription>여러 개의 PDF 파일을 순차적으로 분석하여 각 파일의 결과가 나오는대로 UI에 표시합니다.</CardDescription>
                    </CardHeader>
                    <PdfSequentialAnalyzerTool />
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>PDF 일괄 채점 도구</CardTitle>
                        <CardDescription>하나의 채점 기준표(PDF)와 여러 학생의 답안지(PDF)를 업로드하여 일괄 채점을 수행합니다.</CardDescription>
                    </CardHeader>
                    <PdfGradingTool />
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>클라우드 저장소 PDF 분석 도구</CardTitle>
                        <CardDescription>Firebase Storage에 업로드된 PDF 파일을 서버에서 직접 분석합니다. (서버 사이드 처리)</CardDescription>
                    </CardHeader>
                    <PdfStorageAnalyzerTool />
                </Card>
            </div>
        </div>
    );
}

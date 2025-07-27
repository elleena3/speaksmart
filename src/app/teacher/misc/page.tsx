
"use client"

import { useLanguage } from "@/context/language-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TranscriberTool } from "@/components/feature-tools/transcriber-tool";
import { PronunciationAnalyzerTool } from "@/components/feature-tools/pronunciation-analyzer-tool";
import { RealtimeConversationTool } from "@/app/teacher/misc/realtime-conversation-tool";
import { ConcurrentConversationTool } from "@/app/teacher/misc/concurrent-conversation-tool";
import { VadConversationTool } from "@/app/teacher/misc/vad-conversation-tool";
import { ParallelConversationTool } from "@/app/teacher/misc/parallel-conversation-tool";
import { HybridConversationTool } from "@/app/teacher/misc/hybrid-conversation-tool";
import { ReadAloudTool } from "@/app/teacher/misc/read-aloud-tool";
import { HandwritingAnalyzerTool } from "@/components/feature-tools/handwriting-analyzer-tool";
import { PresentationAnalyzerTool } from "./presentation-analyzer-tool";
import { InteractiveTextAnalyzer } from "@/components/feature-tools/interactive-text-analyzer";
import { SpeculativeConversationTool } from "@/components/feature-tools/speculative-conversation-tool";
import { StorageUploaderTool } from "@/components/feature-tools/storage-uploader-tool";


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
                        <CardTitle>Storage 파일 업로더</CardTitle>
                        <CardDescription>파일을 선택하여 Firebase Storage에 직접 업로드하는 기능입니다.</CardDescription>
                    </CardHeader>
                    <StorageUploaderTool />
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
                        <CardTitle>{t.teacherMisc.presentationAnalyzerTool.title}</CardTitle>
                        <CardDescription>{t.teacherMisc.presentationAnalyzerTool.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <PresentationAnalyzerTool />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>AI 원어민 대화 (기본)</CardTitle>
                        <CardDescription>턴 기반으로 AI와 대화합니다. 사용자 응답이 끝나면 AI가 응답을 생성합니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <RealtimeConversationTool />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>AI 원어민 대화 (VAD - Web Speech API)</CardTitle>
                        <CardDescription>브라우저의 Web Speech API를 사용하여 사용자의 발화 종료를 감지하고 턴을 넘깁니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <VadConversationTool />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>AI 원어민 대화 (VAD - 수동)</CardTitle>
                        <CardDescription>사용자가 직접 녹음을 시작하고 중지하여 턴을 제어합니다. (서버 STT)</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <HybridConversationTool />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>AI 원어민 대화 (VAD - 오디오 청크)</CardTitle>
                        <CardDescription>오디오를 짧은 조각으로 계속 서버에 보내는 대신, 침묵이 감지될 때까지 클라이언트에서 녹음한 후 한 번에 보냅니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ParallelConversationTool />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>AI 원어민 대화 (예측 발화 모델)</CardTitle>
                        <CardDescription>사용자의 발화 시작과 거의 동시에 AI가 응답을 미리 생성하여 대화의 속도감을 높인 프로토타입입니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SpeculativeConversationTool />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>AI 원어민 대화 (동시 녹음)</CardTitle>
                        <CardDescription>AI 음성과 사용자 음성을 동시에 녹음하여 하나의 오디오 파일로 저장하는 기능입니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ConcurrentConversationTool />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

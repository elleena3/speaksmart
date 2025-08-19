
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RealtimeConversationTool } from "@/app/teacher/misc/realtime-conversation-tool";
import { ConcurrentConversationTool } from "@/app/teacher/misc/concurrent-conversation-tool";
import { VadConversationTool } from "@/app/teacher/misc/vad-conversation-tool";
import { ParallelConversationTool } from "@/app/teacher/misc/parallel-conversation-tool";
import { HybridConversationTool } from "@/app/teacher/misc/hybrid-conversation-tool";
import { SpeculativeConversationTool } from "@/components/feature-tools/speculative-conversation-tool";
import { StandaloneDialogueTool } from "@/components/feature-tools/standalone-dialogue-tool";
import { Neural2DialogueTool } from "@/components/feature-tools/neural2-dialogue-tool";


export default function ConversationToolsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">대화형 도구</h2>
                <p className="text-muted-foreground">다양한 방식의 AI 대화 시뮬레이션 프로토타입입니다.</p>
            </div>
            <div className="grid grid-cols-1 gap-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>AI와 대화하기 (연습용 - Gemini TTS)</CardTitle>
                        <CardDescription>학생들이 응시하는 'AI와 대화하기' 평가와 동일한 환경에서 Genkit 기반 Gemini TTS 모델을 사용하여 자유롭게 대화를 연습할 수 있는 도구입니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <StandaloneDialogueTool />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>AI와 대화하기 (Google Cloud TTS)</CardTitle>
                        <CardDescription>Google Cloud의 표준 Text-to-Speech API('en-US-Neural2-A' 음성)를 사용하여 대화를 연습합니다. 가장 안정적이고 표준적인 발음을 제공합니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Neural2DialogueTool />
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

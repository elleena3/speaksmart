
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StandaloneDialogueTool } from "@/components/feature-tools/standalone-dialogue-tool";
import { OpenAiTtsDialogueTool } from "@/components/feature-tools/openai-tts-dialogue-tool";
import { LiveConversationTool } from "@/components/feature-tools/live-conversation-tool";
import { OpenAiRealtimeConversationTool } from "@/components/feature-tools/openai-realtime-conversation-tool";


export default function ConversationToolsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">대화형 도구</h2>
                <p className="text-muted-foreground">다양한 방식의 AI 대화 시뮬레이션 프로토타입입니다.</p>
            </div>
            <div className="grid grid-cols-1 gap-6">
                <Card className="border-blue-500 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-blue-600">실시간 원어민 대화 도구 (Live API)</CardTitle>
                        <CardDescription>Gemini Live API를 사용한 WebSocket 실시간 영어 대화 연습 및 평가 도구입니다.</CardDescription>
                    </CardHeader>
                    <LiveConversationTool />
                </Card>
                <Card className="border-emerald-500 shadow-md">
                    <CardHeader>
                        <CardTitle className="text-emerald-600">실시간 원어민 대화 도구 (OpenAI Realtime API)</CardTitle>
                        <CardDescription>WebRTC 음성 데이터 스트리밍 기반의 초저지연 OpenAI 실시간 영어 대화 연습 및 평가 도구입니다.</CardDescription>
                    </CardHeader>
                    <OpenAiRealtimeConversationTool />
                </Card>
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
                        <CardTitle>AI와 대화하기 (OpenAI TTS)</CardTitle>
                        <CardDescription>사용량 제한이 넉넉한 OpenAI의 TTS 모델('tts-1')을 사용하여 대화를 연습합니다. 동시 접속 및 잦은 사용에 더 안정적입니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <OpenAiTtsDialogueTool />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

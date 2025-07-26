
"use client";

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Home } from 'lucide-react';
import Link from 'next/link';

// Import all the tools
import { HandwritingAnalyzerTool } from '@/components/feature-tools/handwriting-analyzer-tool';
import { ReadAloudTool } from '@/components/feature-tools/read-aloud-tool';
import { InteractiveTextAnalyzer } from '@/components/feature-tools/interactive-text-analyzer';
import { PresentationAnalyzerTool } from '@/components/feature-tools/presentation-analyzer-tool';
import { TranscriberTool } from '@/components/feature-tools/transcriber-tool';
import { PronunciationAnalyzerTool } from '@/components/feature-tools/pronunciation-analyzer-tool';
import { SpeculativeConversationTool } from '@/components/feature-tools/speculative-conversation-tool';
import { Logo } from '@/components/icons';

const toolComponents: { [key: string]: React.FC } = {
    'handwriting-analyzer': HandwritingAnalyzerTool,
    'read-aloud': ReadAloudTool,
    'interactive-text-analyzer': InteractiveTextAnalyzer,
    'presentation-analyzer': PresentationAnalyzerTool,
    'transcriber': TranscriberTool,
    'pronunciation-analyzer': PronunciationAnalyzerTool,
    'speculative-conversation': SpeculativeConversationTool,
};

const toolInfo: { [key: string]: { title: string; description: string } } = {
    'handwriting-analyzer': { title: "AI 자필 분석 도구", description: "학생의 자필 영어 사진을 업로드하여 AI에게 글씨체 교정 피드백을 받아보세요." },
    'read-aloud': { title: "Read Aloud 연습 도구", description: "제공된 지문을 따라 읽고 AI에게 발음, 정확도, 유창성 피드백을 받아보세요." },
    'interactive-text-analyzer': { title: "상호작용 텍스트 분석기", description: "지문의 단어를 클릭하여 번역, 사전, 해설, AI 리딩 기능을 사용해보세요." },
    'presentation-analyzer': { title: "영어 발표 동영상 분석 도구", description: "학생의 발표 동영상과 발표 자료를 업로드하여 종합적인 피드백을 받아보세요." },
    'transcriber': { title: "음성-텍스트 변환 도구", description: "오디오 파일을 업로드하거나 녹음하여 여러 모델의 음성-텍스트 변환 결과를 비교 테스트합니다." },
    'pronunciation-analyzer': { title: "영어 발음 분석 도구", description: "오디오 파일을 업로드하거나 녹음하여 여러 AI 모델의 발음 피드백과 점수를 비교해보세요." },
    'speculative-conversation': { title: "AI 원어민 대화 (예측 발화)", description: "사용자의 발화 시작과 거의 동시에 AI가 응답을 미리 생성하여 대화의 속도감을 높인 프로토타입입니다." },
};

function LabContent() {
    const searchParams = useSearchParams();
    const tool = searchParams.get('tool');

    const ToolComponent = tool ? toolComponents[tool] : null;
    const info = tool ? toolInfo[tool] : null;
    
    return (
        <div className="container mx-auto p-4 md:p-8">
             <header className="flex justify-between items-center mb-8">
                 <Link href="/" className="flex items-center gap-2">
                    <Logo className="size-7 text-primary" />
                    <h1 className="text-xl font-semibold font-headline">SpeakSmart 실험실</h1>
                </Link>
                <Button variant="outline" asChild>
                    <Link href="/">
                        <Home className="mr-2 h-4 w-4"/>
                        메인으로 돌아가기
                    </Link>
                </Button>
            </header>

            {ToolComponent && info ? (
                 <Card>
                    <CardHeader>
                        <CardTitle>{info.title}</CardTitle>
                        <CardDescription>{info.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ToolComponent />
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>AI 기능 실험실</CardTitle>
                        <CardDescription>테스트하고 싶은 AI 기능을 선택해주세요.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(toolInfo).map(([key, {title, description}]) => (
                             <Link key={key} href={`/lab?tool=${key}`} passHref>
                                <Card className="hover:shadow-lg hover:border-primary transition-all flex flex-col h-full">
                                    <CardHeader>
                                        <CardTitle className="text-lg">{title}</CardTitle>
                                        <CardDescription className="text-xs">{description}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow"/>
                                </Card>
                            </Link>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export default function LabPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin"/></div>}>
            <LabContent />
        </Suspense>
    );
}

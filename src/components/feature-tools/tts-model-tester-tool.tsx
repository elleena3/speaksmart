
"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Speaker, RefreshCw, Wand2 } from 'lucide-react';
import { generateTtsByModelFlow } from '@/ai/flows/generate-tts-by-model-flow';

const ttsModels = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"] as const;
type TtsModel = (typeof ttsModels)[number];

export function TtsModelTesterTool() {
    const [text, setText] = useState("Hello, how are you? Welcome to the Text-to-Speech model test.");
    const [isLoading, setIsLoading] = useState<TtsModel | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement>(null);
    const { toast } = useToast();

    const handlePlay = async (model: TtsModel) => {
        if (!text.trim()) {
            toast({ title: "텍스트 필요", description: "음성으로 변환할 텍스트를 입력해주세요.", variant: "destructive" });
            return;
        }
        setIsLoading(model);
        toast({ title: `${model} 테스트 시작`, description: "음성 생성을 요청했습니다..." });

        try {
            const result = await generateTtsByModelFlow({ text, model });
            if (audioPlayerRef.current) {
                audioPlayerRef.current.src = result.audioDataUri;
                audioPlayerRef.current.play();
            }
        } catch (e: any) {
            toast({ title: `${model} 오류`, description: e.message, variant: "destructive" });
        } finally {
            setIsLoading(null);
        }
    };
    
    const handleReset = () => {
        setText("Hello, how are you? Welcome to the Text-to-Speech model test.");
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.src = "";
        }
    };

    return (
        <div className="space-y-4">
            <Textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="음성으로 변환할 텍스트를 입력하세요..."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ttsModels.map(model => (
                    <Button 
                        key={model}
                        onClick={() => handlePlay(model)} 
                        disabled={!!isLoading}
                        variant={isLoading === model ? "secondary" : "outline"}
                    >
                        {isLoading === model ? (
                             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                             <Wand2 className="mr-2 h-4 w-4" />
                        )}
                        {model} 테스트
                    </Button>
                ))}
            </div>
             <Button onClick={handleReset} variant="ghost" size="sm" className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" /> 텍스트 초기화
            </Button>
            <audio ref={audioPlayerRef} className="w-full" controls/>
        </div>
    );
}

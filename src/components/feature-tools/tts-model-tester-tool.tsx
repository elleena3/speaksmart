
"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Speaker, RefreshCw } from 'lucide-react';
import { allVoices, voiceDescriptions, type AiVoice } from '@/lib/types';
import { generateTtsByModelFlow } from '@/ai/flows/generate-tts-by-model-flow';

export function TtsModelTesterTool() {
    const [text, setText] = useState("Hello, how are you?");
    const [isLoading, setIsLoading] = useState<AiVoice | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement>(null);
    const { toast } = useToast();

    const handlePlay = async (voice: AiVoice) => {
        if (!text.trim()) {
            toast({ title: "텍스트 필요", description: "음성으로 변환할 텍스트를 입력해주세요.", variant: "destructive" });
            return;
        }
        setIsLoading(voice);

        try {
            const result = await generateTtsByModelFlow({ text, voice });
            if (audioPlayerRef.current) {
                audioPlayerRef.current.src = result.audioDataUri;
                audioPlayerRef.current.play();
            }
        } catch (e: any) {
            toast({ title: "음성 생성 오류", description: e.message, variant: "destructive" });
        } finally {
            setIsLoading(null);
        }
    };
    
    const handleReset = () => {
        setText("Hello, how are you?");
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.src = "";
        }
    }

    return (
        <div className="space-y-4">
            <Textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="음성으로 변환할 텍스트를 입력하세요..."
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {allVoices.map(voice => (
                    <Button 
                        key={voice}
                        onClick={() => handlePlay(voice)} 
                        disabled={!!isLoading}
                        variant={isLoading === voice ? "secondary" : "outline"}
                    >
                        {isLoading === voice ? (
                             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                             <Speaker className="mr-2 h-4 w-4" />
                        )}
                        {voiceDescriptions[voice]}
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

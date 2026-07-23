import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Bot, User } from 'lucide-react';
import { chatYoutubeScript } from '@/ai/flows/chat-youtube-script-flow';
import ReactMarkdown from 'react-markdown';

interface YoutubeChatPanelProps {
    transcript: string;
    model: string;
    onJumpToTime: (timeStr: string) => void;
}

export function YoutubeChatPanel({ transcript, model, onJumpToTime }: YoutubeChatPanelProps) {
    const [messages, setMessages] = useState<{ role: 'user' | 'model', content: string }[]>([
        { role: 'model', content: '안녕하세요! 이 영상의 내용에 대해 궁금한 점이 있으신가요?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() || !transcript) return;
        const userMsg = input;
        setInput('');

        const newHistory = [...messages, { role: 'user' as const, content: userMsg }];
        setMessages(newHistory);
        setIsTyping(true);

        try {
            const apiHistory = newHistory.map(m => ({
                role: m.role,
                content: [{ text: m.content }]
            }));

            const { reply } = await chatYoutubeScript({
                transcript,
                messageHistory: apiHistory,
                evaluationModel: model
            });

            setMessages([...newHistory, { role: 'model', content: reply }]);
        } catch (e: any) {
            setMessages([...newHistory, { role: 'model', content: `[에러 발생] ${e.message}` }]);
        } finally {
            setIsTyping(false);
        }
    };

    const renderMarkdown = (text: string) => (
        <ReactMarkdown
            components={{
                a: ({ node, ...props }) => {
                    const txt = props.children?.toString() || '';
                    if (txt.match(/^\[\d{2}:\d{2}\]$/)) {
                        return (
                            <button
                                onClick={(e) => { e.preventDefault(); onJumpToTime(txt.replace(/\[|\]/g, '')); }}
                                className="text-blue-500 hover:underline px-1 py-0.5 rounded cursor-pointer font-medium"
                            >
                                {txt}
                            </button>
                        );
                    }
                    return <a {...props} className="text-blue-500 hover:underline" />;
                }
            }}
        >
            {text.replace(/(\[\d{2}:\d{2}\])/g, '[$1]($1)')}
        </ReactMarkdown>
    );

    return (
        <Card className="flex flex-col h-full border-l-0 rounded-l-none shadow-none">
            <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold text-sm flex items-center">
                    <Bot className="w-4 h-4 mr-2 text-primary" />
                    팩트체크 AI 어시스턴트
                </h3>
            </div>

            <ScrollArea className="flex-grow p-4" ref={scrollRef}>
                <div className="space-y-4">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-3 text-sm ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && (
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-4 h-4 text-primary" />
                                </div>
                            )}
                            <div className={`p-3 rounded-lg max-w-[85%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 markdown-content'}`}>
                                {msg.role === 'model' ? renderMarkdown(msg.content) : msg.content}
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                    <User className="w-4 h-4 text-primary-foreground" />
                                </div>
                            )}
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex gap-3 text-sm justify-start">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4 text-primary" />
                            </div>
                            <div className="p-3 rounded-lg bg-muted/50 flex space-x-1 items-center">
                                <div className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce [animation-delay:0.2s]" />
                                <div className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            <div className="p-4 border-t mt-auto">
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                    <Input
                        placeholder="요약 내용에 대해 질문해주세요..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isTyping || !transcript}
                    />
                    <Button type="submit" disabled={isTyping || !input.trim() || !transcript} size="icon">
                        {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                </form>
            </div>
        </Card>
    );
}

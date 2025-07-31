
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, DatabaseZap, CheckCircle, AlertTriangle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from '@/context/auth-context';

type TestState = 'idle' | 'testing' | 'success' | 'error';

const TEST_COLLECTION = '_test_collection';
const TEST_DOC_ID = 'test_document';

export function FirestoreTestTool() {
    const [testState, setTestState] = useState<TestState>('idle');
    const [message, setMessage] = useState<string>('데이터베이스 테스트를 시작하려면 아래 버튼을 클릭하세요.');
    const { user } = useAuth();
    const { toast } = useToast();

    const runTest = async (operation: 'write' | 'read' | 'delete') => {
        if (!user) {
            toast({ title: "로그인 필요", description: "Firestore를 테스트하려면 먼저 로그인해주세요.", variant: "destructive" });
            return;
        }
        setTestState('testing');
        setMessage('테스트 진행 중...');

        try {
            const testDocRef = doc(db, TEST_COLLECTION, `${TEST_DOC_ID}_${user.uid}`);
            
            if (operation === 'write') {
                await setDoc(testDocRef, { 
                    message: "Hello Firestore!", 
                    timestamp: serverTimestamp(),
                    uid: user.uid 
                });
                setMessage("성공: Firestore에 테스트 문서를 성공적으로 작성했습니다.");
                toast({ title: "쓰기 테스트 성공" });
            } else if (operation === 'read') {
                const docSnap = await getDoc(testDocRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setMessage(`성공: 문서를 읽었습니다. 내용: ${JSON.stringify(data)}`);
                    toast({ title: "읽기 테스트 성공" });
                } else {
                    throw new Error("테스트 문서를 찾을 수 없습니다. 먼저 쓰기 테스트를 실행하세요.");
                }
            } else if (operation === 'delete') {
                await deleteDoc(testDocRef);
                setMessage("성공: 테스트 문서를 성공적으로 삭제했습니다.");
                toast({ title: "삭제 테스트 성공" });
            }
            setTestState('success');

        } catch (e: any) {
            console.error("Firestore test error:", e);
            setMessage(`오류: ${e.message}`);
            setTestState('error');
            toast({ title: "테스트 실패", description: e.message, variant: "destructive" });
        }
    };

    const getStatusIcon = () => {
        switch(testState) {
            case 'testing': return <Loader2 className="h-5 w-5 animate-spin"/>;
            case 'success': return <CheckCircle className="h-5 w-5 text-green-500"/>;
            case 'error': return <AlertTriangle className="h-5 w-5 text-destructive"/>;
            default: return <DatabaseZap className="h-5 w-5 text-muted-foreground"/>;
        }
    }

    return (
        <CardContent className="pt-6">
            <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg flex items-start gap-4 min-h-[80px]">
                    <div className="flex-shrink-0 mt-1">{getStatusIcon()}</div>
                    <p className="text-sm text-foreground flex-grow">{message}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Button onClick={() => runTest('write')} disabled={testState === 'testing'}>쓰기 테스트</Button>
                    <Button onClick={() => runTest('read')} disabled={testState === 'testing'}>읽기 테스트</Button>
                    <Button onClick={() => runTest('delete')} disabled={testState === 'testing'} variant="destructive">삭제 테스트</Button>
                </div>
            </div>
        </CardContent>
    );
}

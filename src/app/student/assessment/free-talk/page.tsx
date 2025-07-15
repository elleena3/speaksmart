
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FreeTalkView } from "./free-talk-view"
import { useSearchParams, useRouter, notFound } from "next/navigation"
import { type TeacherAssessment } from "@/lib/types"
import { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Loader2 } from "lucide-react"

export default function FreeTalkPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [assessment, setAssessment] = useState<TeacherAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const assessmentId = searchParams.get('id');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        router.push('/');
        return;
    }

    const fetchDetails = async () => {
        if (assessmentId) {
            const docRef = doc(db, "assessments", assessmentId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setAssessment({ id: docSnap.id, ...docSnap.data() } as TeacherAssessment);
            } else {
                notFound();
            }
        } else {
            // This is a generic free-talk practice, not tied to a specific assessment
            setAssessment({
                id: "free-talk-practice",
                uid: "system",
                title: "자유 대화 연습",
                prompt: "AI와 자유롭게 영어로 대화해 보세요. 이 대화는 저장되지 않습니다.",
                assessmentType: "dialogue",
                scenario: "free-talk",
                expectedFormat: "자연스러운 대화 능력 평가"
            } as any);
        }
        setIsLoading(false);
    }
    
    fetchDetails();

  }, [searchParams, user, authLoading, router, assessmentId]);


  if (isLoading || authLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin"/></div>; 
  }

  if (!assessment) {
    notFound();
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{assessment.title}</CardTitle>
          <CardDescription>{assessment.prompt}</CardDescription>
        </CardHeader>
        <CardContent>
          <FreeTalkView 
            assessment={assessment} 
          />
        </CardContent>
      </Card>
    </div>
  )
}


"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AssessmentView } from "./assessment-view"
import { useEffect, useState } from "react";
import { useParams, notFound, useRouter } from "next/navigation";
import { type TeacherAssessment } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

export default function AssessmentPage() {
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [assessmentDetails, setAssessmentDetails] = useState<TeacherAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
        router.push('/');
        return;
    }
    if (id) {
        const fetchAssessment = async () => {
            const docRef = doc(db, "assessments", id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setAssessmentDetails({ id: docSnap.id, ...docSnap.data() } as TeacherAssessment);
            } else {
                console.warn(`Assessment with ID ${id} not found in Firestore.`);
                notFound();
            }
            setIsLoading(false);
        }
        fetchAssessment();
    }
  }, [id, user, authLoading, router]);

  if (isLoading || authLoading) {
    return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  if (!assessmentDetails) {
    // This will render the not-found.tsx file if it exists, or a default Next.js 404 page.
    notFound();
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{assessmentDetails.title}</CardTitle>
          <CardDescription>{assessmentDetails.prompt}</CardDescription>
        </CardHeader>
        <CardContent>
          <AssessmentView assessmentDetails={assessmentDetails} />
        </CardContent>
      </Card>
    </div>
  )
}

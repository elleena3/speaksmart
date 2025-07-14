
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AssessmentView } from "./assessment-view"
import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { type TeacherAssessment } from "@/lib/types";

export default function AssessmentPage() {
  const params = useParams();
  const [assessmentDetails, setAssessmentDetails] = useState<TeacherAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (id) {
        const storedAssessments: TeacherAssessment[] = JSON.parse(localStorage.getItem('assessments') || '[]');
        const foundAssessment = storedAssessments.find(a => a.id === id);

        if (foundAssessment) {
            setAssessmentDetails(foundAssessment);
        } else {
            // In a real app, you might fetch from a DB here as a fallback.
            // For this app, if it's not in localStorage, it's considered not found.
            console.warn(`Assessment with ID ${id} not found in localStorage.`);
        }
        setIsLoading(false);
    }
  }, [id]);

  if (isLoading) {
    return <div className="max-w-3xl mx-auto p-8 text-center">Loading assessment...</div>;
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


import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { type TeacherAssessment } from "@/lib/types"
import { CheckCircle2, MessageCircle, Mic } from "lucide-react"
import { getLanguage } from "@/lib/get-language"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, orderBy } from "firebase/firestore"
import { cookies } from "next/headers"

type CombinedAssessment = TeacherAssessment & {
    status: '할 일' | '채점 완료';
};

async function getAssessments(studentId: string): Promise<CombinedAssessment[]> {
    try {
        const assessmentsQuery = query(collection(db, "assessments"), orderBy("createdAt", "desc"));
        const assessmentsSnapshot = await getDocs(assessmentsQuery);
        const teacherAssessments = assessmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherAssessment));
        
        const resultsQuery = query(collection(db, "results"), where("studentId", "==", studentId));
        const resultsSnapshot = await getDocs(resultsQuery);
        const completedAssessmentIds = new Set(resultsSnapshot.docs.map(doc => doc.data().assessmentId));

        const combined = teacherAssessments.map(assessment => ({
            ...assessment,
            status: completedAssessmentIds.has(assessment.id) ? '채점 완료' : '할 일',
        }));
        
        return combined;
    } catch (error) {
        console.error("Failed to load assessments from Firestore", error);
        return [];
    }
}


function AssessmentCard({ assessment, t }: { assessment: CombinedAssessment, t: any }) {
  const isToDo = assessment.status === '할 일';

  const getStatusText = (status: CombinedAssessment['status']) => {
    switch (status) {
      case '할 일':
        return t.studentDashboard.status.todo;
      case '채점 완료':
        return t.studentDashboard.status.graded;
      default:
        return status;
    }
  }
  
  const getBadgeVariant = (status: CombinedAssessment['status']) => {
    switch (status) {
      case '할 일':
        return 'destructive';
      case '채점 완료':
        return 'default';
      default:
        return 'secondary';
    }
  }

  const getIcon = () => {
    if (!isToDo) return <CheckCircle2 className="h-5 w-5" />;
    return assessment.assessmentType === 'dialogue' ? <MessageCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />;
  }

  const getLink = () => {
    if (!isToDo) return `/student/assessment/${assessment.id}/results`;
    if (assessment.assessmentType === 'dialogue') {
      return `/student/assessment/free-talk?id=${assessment.id}`;
    }
    return `/student/assessment/${assessment.id}`;
  }


  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl">{assessment.title}</CardTitle>
          <Badge variant={getBadgeVariant(assessment.status)}>
            {getStatusText(assessment.status)}
          </Badge>
        </div>
        <CardDescription>{assessment.topic}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow" />
      <CardFooter>
        <Link href={getLink()} passHref className="w-full">
          <Button className="w-full">
            {getIcon()}
            <span className="ml-2">{isToDo ? t.studentDashboard.startAssessment : t.studentDashboard.viewResults}</span>
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}

export default async function StudentDashboard() {
  const t = getLanguage();
  // We'll use a mock user ID since login is disabled
  const mockStudentId = "test-user-id";
  const allAssessments = await getAssessments(mockStudentId);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">{t.studentDashboard.welcome}</h2>
        <p className="text-muted-foreground">{t.studentDashboard.description}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {allAssessments.length > 0 ? allAssessments.map((assessment) => (
          <AssessmentCard key={assessment.id} assessment={assessment} t={t} />
        )) : (
            <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg">
                <h3 className="text-lg font-medium text-muted-foreground">할당된 평가 없음</h3>
                <p className="text-sm text-muted-foreground mt-1">현재 참여할 수 있는 평가가 없습니다.</p>
            </div>
        )}
      </div>
    </div>
  )
}

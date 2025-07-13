import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { type Assessment } from "@/lib/types"
import { ArrowRight, CheckCircle2, History } from "lucide-react"

const assessments: Assessment[] = [
  { id: "4", title: "Unit 7: Hobbies and Interests", topic: "Talk about your favorite hobbies for 1 minute.", status: "To Do", dueDate: "2024-06-07" },
  { id: "3", title: "Mid-term Speaking Test", topic: "Review your performance and feedback.", status: "Graded" },
  { id: "2", title: "Unit 6: Describing People", topic: "Review your performance and feedback.", status: "Graded" },
  { id: "1", title: "Unit 5: My Daily Routine", topic: "Review your performance and feedback.", status: "Graded" },
];

function AssessmentCard({ assessment }: { assessment: Assessment }) {
  const isToDo = assessment.status === 'To Do';
  
  const getBadgeVariant = (status: Assessment['status']) => {
    switch (status) {
      case 'To Do':
        return 'destructive';
      case 'Graded':
        return 'default';
      default:
        return 'secondary';
    }
  }

  const getIcon = (status: Assessment['status']) => {
    switch (status) {
      case 'To Do':
        return <ArrowRight className="h-5 w-5" />;
      case 'Graded':
        return <CheckCircle2 className="h-5 w-5" />;
      default:
        return <History className="h-5 w-5" />;
    }
  }

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl">{assessment.title}</CardTitle>
          <Badge variant={getBadgeVariant(assessment.status)}>{assessment.status}</Badge>
        </div>
        <CardDescription>{assessment.topic}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {assessment.dueDate && <p className="text-sm text-muted-foreground">Due: {assessment.dueDate}</p>}
      </CardContent>
      <CardFooter>
        <Link href={isToDo ? `/student/assessment/${assessment.id}` : `/student/assessment/${assessment.id}/results`} passHref className="w-full">
          <Button className="w-full">
            {getIcon(assessment.status)}
            <span className="ml-2">{isToDo ? 'Start Assessment' : 'View Results'}</span>
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}

export default function StudentDashboard() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">Welcome back!</h2>
        <p className="text-muted-foreground">Here are your pending and completed assessments.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {assessments.map((assessment) => (
          <AssessmentCard key={assessment.id} assessment={assessment} />
        ))}
      </div>
    </div>
  )
}

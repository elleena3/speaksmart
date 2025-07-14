
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { type TeacherAssessment } from "@/lib/types"
import { OverviewChart } from "./overview-chart"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getLanguage } from "@/lib/get-language"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, orderBy } from "firebase/firestore"

async function getAssessments(teacherId: string): Promise<TeacherAssessment[]> {
    try {
      const q = query(
        collection(db, "assessments"), 
        where("uid", "==", teacherId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TeacherAssessment));
    } catch (error) {
      console.error("Error fetching assessments: ", error);
      return [];
    }
}


export default async function TeacherDashboard() {
  const t = getLanguage();
  // We'll use a mock user ID since login is disabled
  const mockTeacherId = "test-user-id";
  const assessments = await getAssessments(mockTeacherId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">{t.teacherDashboard.dashboard}</h2>
        <Link href="/teacher/assessments/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> {t.teacherDashboard.createAssessment}
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.teacherDashboard.performanceOverview}</CardTitle>
          <CardDescription>{t.teacherDashboard.avgScoreDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <OverviewChart />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.teacherDashboard.recentAssessments}</CardTitle>
          <CardDescription>{t.teacherDashboard.recentAssessmentsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.teacherDashboard.title}</TableHead>
                <TableHead className="text-center">{t.teacherDashboard.completed}</TableHead>
                <TableHead className="text-center">{t.teacherDashboard.avgScore}</TableHead>
                <TableHead>{t.teacherDashboard.dateCreated}</TableHead>
                <TableHead><span className="sr-only">{t.teacherDashboard.actions}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.length > 0 ? assessments.slice(0, 5).map((assessment) => (
                <TableRow key={assessment.id}>
                  <TableCell className="font-medium">
                    <Link href={`/teacher/assessment/${assessment.id}`} className="hover:underline text-primary">
                      {assessment.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={assessment.studentsCompleted === assessment.totalStudents ? "default" : "secondary"}>
                      {assessment.studentsCompleted} / {assessment.totalStudents}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-mono">
                      {assessment.averageScore > 0 ? `${assessment.averageScore}%` : t.teacherDashboard.noScore}
                    </Badge>
                  </TableCell>
                  <TableCell>{assessment.dateCreated}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">{t.teacherDashboard.openMenu}</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/teacher/assessment/${assessment.id}`}>{t.teacherDashboard.viewResults}</Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    생성된 평가가 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

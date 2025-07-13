import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Paperclip, Download } from "lucide-react"

const studentResults = [
  { studentId: "s1", name: "Alice Johnson", score: 92, status: "Graded", date: "2024-05-12" },
  { studentId: "s2", name: "Bob Williams", score: 88, status: "Graded", date: "2024-05-12" },
  { studentId: "s3", name: "Charlie Brown", score: 76, status: "Graded", date: "2024-05-13" },
  { studentId: "s4", name: "Diana Prince", status: "Submitted", date: "2024-05-14" },
  { studentId: "s5", name: "Ethan Hunt", score: 95, status: "Graded", date: "2024-05-12" },
]

const curricularRemarks = "Students demonstrated strong comprehension of daily routine vocabulary. Many excelled at using present simple tense correctly. Common areas for improvement include pronunciation of 'th' sounds and using a wider range of adverbs of frequency. Overall, performance was very good, with most students meeting or exceeding expectations for this unit."

export default function AssessmentResultsPage({ params }: { params: { id: string } }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Unit 5: My Daily Routine - Results</CardTitle>
            <CardDescription>Showing results for assessment ID: {params.id}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Submission Date</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentResults.map((result) => (
                  <TableRow key={result.studentId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={`https://placehold.co/40x40.png?text=${result.name.charAt(0)}`} alt={result.name} data-ai-hint="person portrait" />
                          <AvatarFallback>{result.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{result.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={result.status === "Graded" ? "default" : "secondary"}>
                        {result.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{result.score ? `${result.score}%` : "N/A"}</TableCell>
                    <TableCell>{result.date}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Draft Curricular Remarks</CardTitle>
            <CardDescription>AI-generated draft based on class performance.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea readOnly value={curricularRemarks} className="h-48 bg-muted/50" />
            <Button className="w-full mt-4">
              <Paperclip className="mr-2 h-4 w-4" /> Save to Records
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Student Feedback Summary</CardTitle>
             <CardDescription>AI-summarized feedback from students about this assessment.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg italic">
              "The prompts were clear, but some found the time limit a bit stressful. A few students suggested adding a practice mode before the real assessment."
             </div>
            <Button variant="outline" className="w-full mt-4">
              <Download className="mr-2 h-4 w-4" /> Download Full Feedback
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

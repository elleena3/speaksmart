import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Paperclip, Download } from "lucide-react"

const studentResults = [
  { studentId: "s1", name: "Alice Johnson", score: 92, status: "채점 완료", date: "2024-05-12" },
  { studentId: "s2", name: "Bob Williams", score: 88, status: "채점 완료", date: "2024-05-12" },
  { studentId: "s3", name: "Charlie Brown", score: 76, status: "채점 완료", date: "2024-05-13" },
  { studentId: "s4", name: "Diana Prince", status: "제출", date: "2024-05-14" },
  { studentId: "s5", name: "Ethan Hunt", score: 95, status: "채점 완료", date: "2024-05-12" },
]

const curricularRemarks = "학생들은 일상생활 어휘에 대한 높은 이해도를 보였습니다. 많은 학생들이 현재 시제를 정확하게 사용하는 데 뛰어났습니다. 공통적인 개선 영역에는 'th' 발음과 다양한 빈도 부사 사용이 포함됩니다. 전반적으로, 대부분의 학생들이 이 단원에 대한 기대치를 충족하거나 초과하는 등 매우 우수한 성과를 보였습니다."

export default function AssessmentResultsPage({ params }: { params: { id: string } }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>5단원: 나의 일과 - 결과</CardTitle>
            <CardDescription>평가 ID 결과 보기: {params.id}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>학생</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>점수</TableHead>
                  <TableHead>제출일</TableHead>
                  <TableHead>작업</TableHead>
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
                      <Badge variant={result.status === "채점 완료" ? "default" : "secondary"}>
                        {result.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{result.score ? `${result.score}%` : "해당 없음"}</TableCell>
                    <TableCell>{result.date}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">보기</Button>
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
            <CardTitle>교과과정 비고 초안</CardTitle>
            <CardDescription>수업 성과에 기반한 AI 생성 초안입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea readOnly value={curricularRemarks} className="h-48 bg-muted/50" />
            <Button className="w-full mt-4">
              <Paperclip className="mr-2 h-4 w-4" /> 기록에 저장
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>학생 피드백 요약</CardTitle>
             <CardDescription>이 평가에 대한 학생들의 AI 요약 피드백입니다.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg italic">
              "지시문은 명확했지만, 일부 학생들은 시간제한이 약간 부담스럽다고 느꼈습니다. 몇몇 학생들은 실제 평가 전에 연습 모드를 추가할 것을 제안했습니다."
             </div>
            <Button variant="outline" className="w-full mt-4">
              <Download className="mr-2 h-4 w-4" /> 전체 피드백 다운로드
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

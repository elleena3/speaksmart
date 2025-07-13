import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default function AssessmentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">평가</h2>
          <p className="text-muted-foreground">모든 평가를 생성, 편집 및 관리합니다.</p>
        </div>
        <Link href="/teacher/assessments/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> 새 평가 만들기
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>평가 목록</CardTitle>
          <CardDescription>생성된 모든 평가 목록이 여기에 나타납니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <h3 className="text-lg font-medium text-muted-foreground">아직 생성된 평가가 없습니다.</h3>
            <p className="text-sm text-muted-foreground mt-1">첫 번째 평가를 만들려면 위 버튼을 클릭하세요!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

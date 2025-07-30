
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle } from "lucide-react";

export default function RubricsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">루브릭 평가 관리</h2>
            <p className="text-muted-foreground">
                여기에서 평가에 사용할 루브릭(채점 기준표)을 생성, 수정 및 관리할 수 있습니다.
            </p>
        </div>
        <Link href="/teacher/rubrics/new" passHref>
            <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                새 루브릭 만들기
            </Button>
        </Link>
      </div>
       <Card>
        <CardHeader>
            <CardTitle>저장된 루브릭 목록</CardTitle>
            <CardDescription>이 페이지는 현재 개발 중입니다.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <h3 className="text-lg font-medium text-muted-foreground">저장된 루브릭 없음</h3>
                <p className="text-sm text-muted-foreground mt-1">
                    '새 루브릭 만들기'를 클릭하여 첫 번째 루브릭을 생성하세요.
                </p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

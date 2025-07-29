"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function RubricsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">교사 포털 - 루브릭 평가</h2>
            <p className="text-muted-foreground">
                여기에서 평가에 사용할 루브릭(채점 기준표)을 생성, 수정 및 관리할 수 있습니다.
            </p>
        </div>
        <Link href="/teacher/assessments" passHref>
            <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                평가 관리로 돌아가기
            </Button>
        </Link>
      </div>
       <Card>
        <CardHeader>
            <CardTitle>루브릭 관리</CardTitle>
            <CardDescription>이 페이지는 현재 개발 중입니다.</CardDescription>
        </CardHeader>
        <CardContent>
            <p>향후 이 곳에서 사용자 정의 루브릭을 관리하는 기능이 제공될 예정입니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}

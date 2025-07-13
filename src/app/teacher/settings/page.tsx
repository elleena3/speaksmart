import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">설정</h2>
            <p className="text-muted-foreground">계정 및 알림 설정을 관리합니다.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>계정 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2">
                    <Label htmlFor="name">전체 이름</Label>
                    <Input id="name" defaultValue="Jane Doe" />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="email">이메일</Label>
                    <Input id="email" type="email" defaultValue="jane.doe@example.com" />
                </div>
                 <Button>프로필 업데이트</Button>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>알림 설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="new-submission" className="font-medium">새로운 제출</Label>
                        <p className="text-sm text-muted-foreground">학생이 평가를 제출하면 알림을 받습니다.</p>
                    </div>
                    <Switch id="new-submission" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="feedback-received" className="font-medium">피드백 수신</Label>
                        <p className="text-sm text-muted-foreground">학생이 평가에 대한 피드백을 제공하면 알림을 받습니다.</p>
                    </div>
                    <Switch id="feedback-received" />
                </div>
            </CardContent>
        </Card>
    </div>
  );
}

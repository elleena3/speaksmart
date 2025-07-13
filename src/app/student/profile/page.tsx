import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ProfilePage() {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>내 프로필</CardTitle>
        <CardDescription>프로필 설정 및 개인 정보를 관리하세요.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
                <AvatarImage src="https://placehold.co/80x80.png" alt="User" data-ai-hint="person portrait"/>
                <AvatarFallback>U</AvatarFallback>
            </Avatar>
            <div>
                <h3 className="text-lg font-semibold">Alex Doe</h3>
                <p className="text-sm text-muted-foreground">alex.doe@example.com</p>
            </div>
        </div>
        <div className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="name">전체 이름</Label>
                <Input id="name" defaultValue="Alex Doe" />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="email">이메일 주소</Label>
                <Input id="email" type="email" defaultValue="alex.doe@example.com" />
            </div>
            <Button>변경사항 저장</Button>
        </div>
      </CardContent>
    </Card>
  );
}

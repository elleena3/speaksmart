import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
            <p className="text-muted-foreground">Manage your account and notification settings.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" defaultValue="Jane Doe" />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" defaultValue="jane.doe@example.com" />
                </div>
                 <Button>Update Profile</Button>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="new-submission" className="font-medium">New Submissions</Label>
                        <p className="text-sm text-muted-foreground">Notify me when a student submits an assessment.</p>
                    </div>
                    <Switch id="new-submission" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="feedback-received" className="font-medium">Feedback Received</Label>
                        <p className="text-sm text-muted-foreground">Notify me when a student provides feedback on an assessment.</p>
                    </div>
                    <Switch id="feedback-received" />
                </div>
            </CardContent>
        </Card>
    </div>
  );
}

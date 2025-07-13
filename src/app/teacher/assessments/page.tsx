import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export default function AssessmentsPage() {
  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">Assessments</h2>
                <p className="text-muted-foreground">Create, edit, and manage all your assessments.</p>
            </div>
             <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Assessment
            </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Assessment List</CardTitle>
            <CardDescription>A list of all created assessments will appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <h3 className="text-lg font-medium text-muted-foreground">No assessments created yet.</h3>
                <p className="text-sm text-muted-foreground mt-1">Click the button above to create your first one!</p>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}

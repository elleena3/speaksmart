import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { User, GraduationCap } from "lucide-react";
import { Logo } from "@/components/icons";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="text-center mb-12">
        <div className="flex justify-center items-center mb-4">
          <Logo className="w-16 h-16 text-primary" />
          <h1 className="text-5xl font-bold font-headline ml-4">SpeakSmart Evaluator</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          AI-powered English speaking assessment platform
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Card className="hover:shadow-lg transition-shadow duration-300 transform hover:-translate-y-1">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <GraduationCap className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-headline">For Students</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              Take assessments, practice your speaking skills, and receive instant AI feedback to help you improve.
            </p>
            <Link href="/student/dashboard" passHref>
              <Button className="w-full" size="lg">
                Go to Student Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-300 transform hover:-translate-y-1">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <User className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-headline">For Teachers</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              Manage assessments, view student performance, and gain insights to enhance your teaching methods.
            </p>
            <Link href="/teacher/dashboard" passHref>
              <Button className="w-full" size="lg">
                Go to Teacher Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      <footer className="mt-16 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} SpeakSmart Evaluator. All rights reserved.</p>
      </footer>
    </main>
  );
}

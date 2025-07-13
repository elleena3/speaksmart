"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Send, ThumbsUp, ThumbsDown, MessageSquareQuote } from "lucide-react"

type FeedbackViewProps = {
  assessmentId: string;
  assessmentTitle: string;
  aiFeedback: string;
}

export function FeedbackView({ assessmentId, assessmentTitle, aiFeedback }: FeedbackViewProps) {
  const [teacherFeedback, setTeacherFeedback] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [satisfaction, setSatisfaction] = useState<"good" | "bad" | null>(null);
  const { toast } = useToast()

  const handleSubmitFeedback = async () => {
    if (!teacherFeedback.trim()) {
      toast({
        title: "Feedback is empty",
        description: "Please write some feedback before submitting.",
        variant: "destructive"
      })
      return
    }
    setIsSubmitting(true)
    toast({ title: "Submitting your feedback..." })
    
    // Simulate API call to summarizeStudentFeedback
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false)
    setTeacherFeedback("")
    toast({
      title: "Feedback submitted!",
      description: "Thank you for helping us improve."
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-3">
            <MessageSquareQuote className="w-8 h-8 text-primary shrink-0" />
            <div>
              <CardTitle className="text-2xl">Your Feedback for "{assessmentTitle}"</CardTitle>
              <CardDescription>AI-generated analysis of your performance.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-body text-sm leading-relaxed">
            {aiFeedback}
          </div>
        </CardContent>
        <CardFooter className="flex-col items-start gap-4">
            <p className="text-sm font-medium">Was this feedback helpful?</p>
            <div className="flex gap-2">
                <Button variant={satisfaction === 'good' ? 'default' : 'outline'} onClick={() => setSatisfaction('good')}>
                    <ThumbsUp className="mr-2 h-4 w-4" /> Helpful
                </Button>
                <Button variant={satisfaction === 'bad' ? 'destructive' : 'outline'} onClick={() => setSatisfaction('bad')}>
                    <ThumbsDown className="mr-2 h-4 w-4" /> Not Helpful
                </Button>
            </div>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Feedback for your Teacher</CardTitle>
          <CardDescription>Let your teacher know how you found this assessment activity.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea 
            placeholder="e.g., The topic was interesting, but the time was a bit short."
            value={teacherFeedback}
            onChange={(e) => setTeacherFeedback(e.target.value)}
            rows={6}
          />
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleSubmitFeedback} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {isSubmitting ? "Submitting..." : "Send Feedback"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

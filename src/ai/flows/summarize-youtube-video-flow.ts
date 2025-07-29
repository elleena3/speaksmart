
'use server';
/**
 * @fileOverview A flow to summarize a YouTube video.
 * It fetches the transcript of a YouTube video and uses Gemini to summarize it.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { YoutubeTranscript } from 'youtube-transcript';

const SummarizeYoutubeVideoInputSchema = z.object({
  youtubeUrl: z.string().url().describe("The URL of the YouTube video to summarize."),
});
export type SummarizeYoutubeVideoInput = z.infer<typeof SummarizeYoutubeVideoInputSchema>;

const SummarizeYoutubeVideoOutputSchema = z.object({
  summary: z.string().describe("A concise summary of the YouTube video content in Korean, formatted in Markdown."),
});
export type SummarizeYoutubeVideoOutput = z.infer<typeof SummarizeYoutubeVideoOutputSchema>;

export async function summarizeYoutubeVideo(input: SummarizeYoutubeVideoInput): Promise<SummarizeYoutubeVideoOutput> {
  return summarizeYoutubeVideoFlow(input);
}

const summarizePrompt = ai.definePrompt({
    name: 'summarizeYoutubeTranscriptPrompt',
    model: googleAI.model('gemini-2.5-pro'),
    input: { schema: z.object({ transcript: z.string() }) },
    output: { schema: SummarizeYoutubeVideoOutputSchema },
    prompt: `You are an expert content summarizer. Your task is to read the following transcript from a YouTube video and create a clear, concise summary in Korean. The summary should be well-structured and easy to read.

Please perform the following steps:
1.  Read the entire transcript to understand the main topic and key arguments.
2.  Create a summary that includes:
    -   A main title for the summary.
    -   A brief introductory paragraph explaining the overall topic of the video.
    -   A bulleted list of the main points or key takeaways.
    -   A concluding sentence that wraps up the video's core message.
3.  Format the entire output in Markdown. Use headings, bold text, and bullet points for readability.
4.  The final output must be only the summary text.

Here is the transcript:
"""
{{{transcript}}}
"""
`,
});

const summarizeYoutubeVideoFlow = ai.defineFlow(
  {
    name: 'summarizeYoutubeVideoFlow',
    inputSchema: SummarizeYoutubeVideoInputSchema,
    outputSchema: SummarizeYoutubeVideoOutputSchema,
  },
  async ({ youtubeUrl }) => {
    let transcriptParts;
    try {
        console.log(`Fetching transcript for: ${youtubeUrl}`);
        // Attempt to fetch the transcript.
        transcriptParts = await YoutubeTranscript.fetchTranscript(youtubeUrl);
    } catch (error: any) {
        console.error("Could not fetch transcript:", error.message);
        // If an error occurs (e.g., subtitles disabled), return a user-friendly message.
        return {
            summary: "### 요약 실패\n\n이 영상은 자막 기능이 비활성화되어 있거나, 지원하지 않아 내용을 요약할 수 없습니다. 다른 영상을 시도해주세요."
        };
    }

    // This case handles videos that have a transcript track but it's empty.
    if (!transcriptParts || transcriptParts.length === 0) {
        return {
            summary: "### 요약 실패\n\n이 영상은 자막을 지원하지만, 자막 내용이 비어 있어 요약할 수 없습니다. 다른 영상을 시도해주세요."
        };
    }
    
    // If we have a valid transcript, proceed to summarize.
    try {
        const transcript = transcriptParts.map(part => part.text).join(' ');
        console.log("Transcript fetched, generating summary...");
        const { output } = await summarizePrompt({ transcript });

        if (!output) {
            throw new Error("AI 모델이 요약을 생성하지 못했습니다.");
        }

        return output;

    } catch (error: any) {
        console.error("An error occurred during AI summarization:", error);
        // This catches errors from the AI model call itself.
        throw new Error(error.message || "AI 요약 중 알 수 없는 오류가 발생했습니다.");
    }
  }
);

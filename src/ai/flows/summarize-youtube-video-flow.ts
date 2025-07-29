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
    let transcript_parts;
    try {
        console.log(`Fetching transcript for: ${youtubeUrl}`);
        // Fetch the transcript
        transcript_parts = await YoutubeTranscript.fetchTranscript(youtubeUrl);
    } catch (error: any) {
         // Catch errors from the library itself (e.g., video not found, subtitles disabled)
         console.error("An error occurred during transcript fetch:", error);
         if (error.message.includes('subtitles are disabled') || error.message.includes('No transcripts are available')) {
             throw new Error("해당 영상의 자막이 비활성화되어 있거나, 지원하지 않아 요약할 수 없습니다.");
         }
         throw new Error("자막을 가져오는 중 오류가 발생했습니다: " + error.message);
    }

    if (!transcript_parts || transcript_parts.length === 0) {
        throw new Error("자막을 찾을 수 없거나, 해당 영상은 자막을 지원하지 않습니다.");
    }
    
    try {
        // Concatenate the transcript parts into a single string
        const transcript = transcript_parts.map(part => part.text).join(' ');

        console.log("Transcript fetched, generating summary...");
        // Summarize the transcript
        const { output } = await summarizePrompt({ transcript });

        if (!output) {
            throw new Error("AI 모델이 요약을 생성하지 못했습니다.");
        }

        return output;

    } catch (error: any) {
        console.error("An error occurred in summarizeYoutubeVideoFlow during AI processing:", error);
        throw new Error(error.message || "유튜브 영상 요약 중 알 수 없는 오류가 발생했습니다.");
    }
  }
);


'use server';
/**
 * @fileOverview A flow to summarize a YouTube video.
 * It fetches the transcript of a YouTube video and uses Gemini to summarize it.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import { YoutubeTranscript } from 'youtube-transcript';

const SummarizeYoutubeVideoInputSchema = z.object({
  youtubeUrl: z.string().url().describe("The URL of the YouTube video to summarize."),
  evaluationModel: z.string().optional().describe("The AI model to use for summarization. Defaults to Gemini 3.1 Pro."),
  outputFormat: z.enum(['default', 'blog', 'mindmap', 'script']).optional().describe("The requested output format."),
});
export type SummarizeYoutubeVideoInput = z.infer<typeof SummarizeYoutubeVideoInputSchema>;

const SummarizeYoutubeVideoOutputSchema = z.object({
  summary: z.string().describe("A concise summary of the YouTube video content in Korean, formatted in Markdown."),
  transcript: z.string().optional().describe("The raw transcript text to run further analysis via chat models."),
});
export type SummarizeYoutubeVideoOutput = z.infer<typeof SummarizeYoutubeVideoOutputSchema>;

export async function summarizeYoutubeVideo(input: SummarizeYoutubeVideoInput): Promise<SummarizeYoutubeVideoOutput> {
  return summarizeYoutubeVideoFlow(input);
}

const summarizePrompt = ai.definePrompt({
  name: 'summarizeYoutubeTranscriptPrompt',
  model: 'googleai/gemini-3.1-pro-preview', // Default model
  input: { schema: z.object({ transcript: z.string(), outputFormat: z.string().optional() }) },
  output: { schema: SummarizeYoutubeVideoOutputSchema },
  prompt: `You are an expert content analyst. Your task is to read the following transcript from a YouTube video and create a clear, concise summary in Korean.

Please perform the following steps:
1. Read the entire transcript to understand the main topic, key arguments, and underlying message.
2. The user has requested the output format to be: {{outputFormat}}. 
   - If outputFormat is empty or "default", create a standard well-structured bulleted summary.
   - If it is "blog", create a highly readable blog post draft with catchy headings.
   - If it is "mindmap", create a text-based hierarchical mindmap structure.
   - If it is "script", create a formatted dialogue transcript with time blocks.
3. **CRITICAL REQUIREMENT:** Throughout your response, you MUST include frequent and accurate timestamps in the exact format \`[MM:SS]\` (e.g., \`[01:15]\` or \`[12:30]\`). Match the timestamps to the original transcript time blocks where the corresponding topics are discussed.
4. Translate any foreign language, academic, or professional terms into highly natural Korean context. DO NOT use awkward literal translations.
5. Format the entire output in Markdown. Use headings, bold text, and bullet points. Do not wrap the output in a markdown code block.
6. The final output must be only the summary text, written in Korean.

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
  async ({ youtubeUrl, evaluationModel, outputFormat }) => {
    let transcriptParts;
    try {
      const videoId = new URL(youtubeUrl).searchParams.get('v');
      if (!videoId) {
        return {
          summary: "### 요약 실패\n\n유효하지 않은 유튜브 URL입니다. 주소에 'v=' 파라미터가 포함되어 있는지 확인해주세요."
        };
      }

      console.log(`Fetching transcript for video ID: ${videoId}`);
      transcriptParts = await YoutubeTranscript.fetchTranscript(videoId);

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
      const formatTime = (offsetMs: number) => {
        const totalSeconds = Math.floor(offsetMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
      };

      const transcript = transcriptParts.map(part => `${formatTime(part.offset)} ${part.text}`).join(' ');

      console.log(`Transcript fetched, generating summary with model: ${evaluationModel || 'googleai/gemini-3.1-pro-preview'} and format: ${outputFormat}`);
      const { output } = await summarizePrompt({ transcript, outputFormat: outputFormat || 'default' }, { model: evaluationModel || 'googleai/gemini-3.1-pro-preview' });

      if (!output) {
        throw new Error("AI 모델이 요약을 생성하지 못했습니다.");
      }

      return { ...output, transcript };

    } catch (error: any) {
      console.error("An error occurred during AI summarization:", error);
      // This catches errors from the AI model call itself.
      throw new Error(error.message || "AI 요약 중 알 수 없는 오류가 발생했습니다.");
    }
  }
);

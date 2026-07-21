'use server';

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

/**
 * @fileOverview A flow to grade a student's PDF submission against a criteria PDF.
 *
 * - gradePdfSubmission - The main function to call for grading a single submission.
 * - GradePdfSubmissionInput - The input type for the flow.
 * - GradePdfSubmissionOutput - The output type for the flow.
 */

const GradePdfSubmissionInputSchema = z.object({
  studentSubmission: z.object({
    fileName: z.string(),
    dataUri: z.string(),
  }),
  criteria: z.object({
    fileName: z.string(),
    dataUri: z.string(),
  }),
});
export type GradePdfSubmissionInput = z.infer<typeof GradePdfSubmissionInputSchema>;

const GradePdfSubmissionOutputSchema = z.object({
  fileName: z.string(),
  analysis: z.string().optional(),
  error: z.string().optional(),
});
export type GradePdfSubmissionOutput = z.infer<typeof GradePdfSubmissionOutputSchema>;

export async function gradePdfSubmission(input: GradePdfSubmissionInput): Promise<GradePdfSubmissionOutput> {
  try {
    const { text } = await ai.generate({
      model: googleAI.model('gemini-3.1-pro-preview'),
      prompt: [
        {
          text: `You are an expert teacher grading an assignment. Your task is to evaluate the student's submission based *strictly* on the provided grading criteria document. Provide a detailed analysis, including strengths, weaknesses, and a final score or grade if applicable from the criteria.

          Here are the documents:
          - The Grading Criteria Document is the primary source of truth for evaluation.
          - The Student Submission Document is the work to be graded.
          `,
        },
        {
          text: "Grading Criteria Document:",
        },
        {
          media: {
            url: input.criteria.dataUri,
          },
        },
        {
          text: "Student Submission Document:",
        },
        {
          media: {
            url: input.studentSubmission.dataUri,
          },
        },
      ],
    });

    if (!text) {
      throw new Error("AI model did not return a valid text analysis.");
    }

    return {
      fileName: input.studentSubmission.fileName,
      analysis: text,
    };
  } catch (error: any) {
    console.error(`Error grading file ${input.studentSubmission.fileName}:`, error);
    return {
      fileName: input.studentSubmission.fileName,
      error: `[${input.studentSubmission.fileName}] 채점 실패: ${error.message || '알 수 없는 오류'}`,
    };
  }
}

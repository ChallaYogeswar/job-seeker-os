/**
 * Score Gate
 * Orchestrates: tailor → ATS score → Human score → retry if needed
 * Max 3 attempts. Returns best result with full diagnostics.
 */

import { tailorResume, buildFeedbackPrompt } from './tailorPrompt.js';
import { scoreATS } from './atsScorer.js';
import { scoreHuman } from './humanScorer.js';

const ATS_THRESHOLD = 90;
const HUMAN_THRESHOLD = 85;
const MAX_RETRIES = 3;

/**
 * @param {object} opts
 * @param {object} opts.parsedResume   - from resumeParser
 * @param {object} opts.job            - from IndexedDB jobs store
 * @param {string} opts.experienceLevel - 'fresher' | 'experienced'
 * @param {string} opts.apiKey
 * @param {string} opts.provider
 * @param {function} opts.onProgress   - (step: string, attempt: number) => void
 * @param {function} opts.onStream     - (partialText: string) => void  (streaming)
 * @returns {object} { resumeText, atsResult, humanResult, passed, attempt, allAttempts }
 */
export async function runScoredTailoring({
  parsedResume,
  job,
  experienceLevel = 'fresher',
  apiKey,
  provider = 'groq',
  onProgress,
  onStream,
}) {
  const allAttempts = [];
  let feedbackFromPrev = null;
  let bestAttempt = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    onProgress?.(`Generating resume (attempt ${attempt}/${MAX_RETRIES})...`, attempt);

    // ── Step 1: Tailor ──────────────────────────────────────────────────────
    let resumeText;
    try {
      resumeText = await tailorResume({
        parsedResume,
        job,
        experienceLevel,
        apiKey,
        provider,
        feedbackFromPrevAttempt: feedbackFromPrev,
        onStream: attempt === 1 ? onStream : null, // only stream first attempt
      });
    } catch (err) {
      onProgress?.(`Tailoring failed: ${err.message}`, attempt);
      throw err;
    }

    // ── Step 2: ATS Score ───────────────────────────────────────────────────
    onProgress?.(`Scoring ATS compliance...`, attempt);
    const atsResult = scoreATS(resumeText, job, experienceLevel);

    // ── Step 3: Human Score ─────────────────────────────────────────────────
    onProgress?.(`Running recruiter evaluation...`, attempt);
    let humanResult = null;
    try {
      humanResult = await scoreHuman(resumeText, job, apiKey, provider);
    } catch (err) {
      // Human scoring failing shouldn't block — use partial result
      console.warn('Human scoring failed:', err.message);
      humanResult = { totalScore: 0, passed: false, error: err.message };
    }

    const attemptData = {
      attempt,
      resumeText,
      atsResult,
      humanResult,
      passed: atsResult.passed && (humanResult?.passed ?? false),
    };

    allAttempts.push(attemptData);

    // Track best so far (highest combined score)
    const combined = atsResult.score + (humanResult?.totalScore || 0);
    const bestCombined = bestAttempt
      ? bestAttempt.atsResult.score + (bestAttempt.humanResult?.totalScore || 0)
      : -1;
    if (combined > bestCombined) bestAttempt = attemptData;

    // ── Pass? ───────────────────────────────────────────────────────────────
    if (attemptData.passed) {
      onProgress?.(`✓ Passed! ATS: ${atsResult.score}, Human: ${humanResult.totalScore}`, attempt);
      return { ...attemptData, allAttempts, needsManualReview: false };
    }

    onProgress?.(
      `Attempt ${attempt} scores: ATS ${atsResult.score}/${ATS_THRESHOLD} · Human ${humanResult?.totalScore || '?'}/${HUMAN_THRESHOLD}. Retrying...`,
      attempt
    );

    // Build feedback for next attempt
    if (attempt < MAX_RETRIES) {
      feedbackFromPrev = buildFeedbackPrompt(atsResult, humanResult);
    }
  }

  // All attempts exhausted — return best result with manual review flag
  onProgress?.(`Max retries reached. Returning best result.`, MAX_RETRIES);
  return { ...bestAttempt, allAttempts, needsManualReview: true };
}

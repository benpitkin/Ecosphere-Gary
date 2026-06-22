import {
  REVIEW_CONTRACT_VERSION,
  type ReviewInput,
  type ReviewResult,
  type ReviewSuggestions,
} from "@/gary/contracts/review";
import { runReviewChecks } from "@/gary/lib/review/checks";
import {
  isReviewReasoningConfigured,
  writeReviewSuggestions,
  type ReviewAgentDeps,
} from "@/gary/lib/review/agent";

/**
 * Design & quote reviewer orchestrator.
 * =====================================
 *
 * `ReviewInput` → `ReviewResult`. Always runs the deterministic checks (verdict +
 * findings + metrics); adds Claude-written suggestions when the reasoning layer
 * is configured (`ANTHROPIC_API_KEY`). An internal review aid for an accredited
 * installer — never a substitute for Ben's own sign-off.
 */

export const REVIEW_DISCLAIMER =
  "Automated review aid — deterministic checks plus AI suggestions. The findings are advisory; an accredited designer must still review and sign off before anything goes to the customer.";

export interface ReviewDeps extends ReviewAgentDeps {
  /** Force-skip the reasoning layer; defaults to env gating. */
  skipSuggestions?: boolean;
}

export async function reviewDesignQuote(
  input: ReviewInput,
  deps: ReviewDeps = {},
): Promise<ReviewResult> {
  const checks = runReviewChecks(input);

  let suggestions: ReviewSuggestions | null = null;
  const useReasoning =
    !deps.skipSuggestions && (deps.client !== undefined || isReviewReasoningConfigured());
  if (useReasoning) {
    suggestions = await writeReviewSuggestions(input, checks, deps);
  }

  return {
    version: REVIEW_CONTRACT_VERSION,
    verdict: checks.verdict,
    findings: checks.findings,
    metrics: checks.metrics,
    suggestions,
    disclaimer: REVIEW_DISCLAIMER,
  };
}

export { runReviewChecks } from "@/gary/lib/review/checks";
export { isReviewReasoningConfigured, writeReviewSuggestions } from "@/gary/lib/review/agent";

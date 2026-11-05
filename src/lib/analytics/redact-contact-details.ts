const EMAIL_PATTERN = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;

// Digits possibly separated by spaces, dots, dashes or parentheses,
// optionally prefixed with + or 00.
const PHONE_CANDIDATE_PATTERN = /(?:\+|\b00)?\(?\d[\d\s.()-]{6,}\d/g;

const MIN_PHONE_DIGITS = 9;

/**
 * Masks e-mail addresses and phone numbers before a question is stored.
 * This reduces the risk of keeping contact details; it is not anonymization.
 */
export function redactContactDetails(text: string): string {
  return text
    .replace(EMAIL_PATTERN, "[email]")
    .replace(PHONE_CANDIDATE_PATTERN, (candidate) => {
      const digits = candidate.replace(/\D/g, "").length;

      return digits >= MIN_PHONE_DIGITS ? "[téléphone]" : candidate;
    });
}

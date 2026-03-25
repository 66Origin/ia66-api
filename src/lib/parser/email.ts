export type EmailTemplate = {
  to: string;
  subject: string;
  body: string;
};

export function extractEmailTemplate(text: string): EmailTemplate | null {
  if (!text) return null;

  // 1. Détecter bloc ---
  const blockMatch = text.match(/---([\s\S]*?)---/);
  if (!blockMatch) return null;

  const block = blockMatch[1].trim();

  // 2. Sécurité : vérifier que c'est bien un email
  if (!/Objet\s*:/i.test(block)) return null;

  // 3. Sujet
  const subjectMatch = block.match(/Objet\s*:\s*(.+)/i);

  // 4. Body (tout sauf la ligne Objet)
  const body = block.replace(/Objet\s*:\s*.+/i, "").trim();

  // 5. Email (dans tout le texte)
  const emailMatch = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);

  return {
    to: emailMatch?.[0] || "o@66origin.com",
    subject: subjectMatch?.[1]?.trim() || "",
    body,
  };
}

export type EmailTemplate = {
  to: string;
  subject: string;
  body: string;
};

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "o@66origin.com";

function cleanMarkdown(text: string) {
  return text.replace(/\*\*/g, "").replace(/__+/g, "").trim();
}

export function extractEmailTemplate(text: string): EmailTemplate | null {
  if (!text) return null;

  // Détecte le bloc email encadré par ---
  const blockMatch = text.match(/---([\s\S]*?)---/);
  if (!blockMatch) return null;

  const block = blockMatch[1].trim();

  // Vérifie qu'il s'agit bien d'un template email
  if (!/Objet\s*:/i.test(block)) return null;

  // Extrait le sujet
  const subjectMatch = block.match(/Objet\s*:\s*(.+)/i);

  // Extrait le body (tout sauf la ligne Objet)
  const body = block.replace(/Objet\s*:\s*.+/i, "").trim();

  return {
    to: CONTACT_EMAIL,
    subject: cleanMarkdown(subjectMatch?.[1] || ""),
    body: cleanMarkdown(body),
  };
}

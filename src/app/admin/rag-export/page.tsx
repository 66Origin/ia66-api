"use client";

import { useState, type SubmitEvent } from "react";
import styles from "./page.module.css";

type GenerationReport = {
  startedAt: string;
  completedAt: string;
  source: string;
  discovered: number;
  created: number;
  updated: number;
  unchanged: number;
  missing: number;
  failed: number;
  failures: Array<{
    url: string;
    error: string;
  }>;
};

type ExportResponse = {
  export: {
    id: string;
    status: "completed" | "completed_with_errors";
    archiveSizeBytes: number;
    report: GenerationReport;
  };
  openaiFileResponse: Array<{
    name: string;
    mime_type: string;
    content: string;
  }>;
};

type Archive = {
  name: string;
  blob: Blob;
};

function base64ToBlob(content: string, mimeType: string): Blob {
  const binary = window.atob(content);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function downloadArchive(archive: Archive) {
  const url = URL.createObjectURL(archive.blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = archive.name;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function RagExportPage() {
  const [password, setPassword] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<GenerationReport | null>(null);
  const [archive, setArchive] = useState<Archive | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsGenerating(true);
    setError(null);
    setReport(null);
    setArchive(null);

    try {
      const response = await fetch("/api/v1/rag/export", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${password}`,
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Le mot de passe est incorrect.");
        }

        if (response.status === 409) {
          throw new Error(
            "Une génération est déjà en cours. Réessaie dans quelques instants.",
          );
        }

        throw new Error(
          payload.detail ||
            payload.error ||
            "La génération des fichiers a échoué.",
        );
      }

      const result = payload as ExportResponse;
      const exportedFile = result.openaiFileResponse[0];

      if (!exportedFile) {
        throw new Error("L’archive générée est introuvable.");
      }

      const generatedArchive = {
        name: exportedFile.name,
        blob: base64ToBlob(
          exportedFile.content,
          exportedFile.mime_type || "application/zip",
        ),
      };

      setReport(result.export.report);
      setArchive(generatedArchive);
      setPassword("");

      downloadArchive(generatedArchive);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Une erreur inattendue est survenue.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>66 Origin</p>

        <h1>Générateur de fichiers Markdown</h1>

        <p className={styles.introduction}>
          Analyse le site 66origin.com, compare les contenus au dernier
          instantané et génère une archive ZIP prête à être vérifiée.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label htmlFor="password">Mot de passe</label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            disabled={isGenerating}
          />

          <button type="submit" disabled={isGenerating || !password}>
            {isGenerating
              ? "Génération en cours…"
              : "Générer les fichiers Markdown"}
          </button>
        </form>

        <div className={styles.status} aria-live="polite">
          {isGenerating && (
            <p>
              Le site est en cours d’analyse. Cette opération peut prendre
              quelques secondes.
            </p>
          )}

          {error && <p className={styles.error}>{error}</p>}
        </div>

        {report && (
          <section className={styles.result}>
            <div className={styles.resultHeader}>
              <div>
                <p className={styles.success}>Export terminé</p>
                <h2>{archive?.name}</h2>
              </div>

              {archive && (
                <button
                  className={styles.download}
                  type="button"
                  onClick={() => downloadArchive(archive)}
                >
                  Télécharger à nouveau
                </button>
              )}
            </div>

            <dl className={styles.metrics}>
              <div>
                <dt>Détectées</dt>
                <dd>{report.discovered}</dd>
              </div>

              <div>
                <dt>Créées</dt>
                <dd>{report.created}</dd>
              </div>

              <div>
                <dt>Modifiées</dt>
                <dd>{report.updated}</dd>
              </div>

              <div>
                <dt>Inchangées</dt>
                <dd>{report.unchanged}</dd>
              </div>

              <div>
                <dt>Manquantes</dt>
                <dd>{report.missing}</dd>
              </div>

              <div>
                <dt>En erreur</dt>
                <dd>{report.failed}</dd>
              </div>
            </dl>

            {report.failures.length > 0 && (
              <div className={styles.failures}>
                <h3>Pages en erreur</h3>

                <ul>
                  {report.failures.map((failure) => (
                    <li key={failure.url}>
                      <strong>{failure.url}</strong>
                      <span>{failure.error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

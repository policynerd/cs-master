/**
 * Renders the small Markdown subset clerks use in minutes: paragraphs and
 * **bold** lead-ins. Text is rendered as React nodes, never as raw HTML.
 */
export function MinutesText({ source }: { source: string }) {
  const paragraphs = source.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="minutes">
      {paragraphs.map((p, i) => (
        <p key={i}>
          {p.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : part,
          )}
        </p>
      ))}
    </div>
  );
}

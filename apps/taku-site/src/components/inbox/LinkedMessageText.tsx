import { splitMessageLinks } from "./helpers";

export function LinkedMessageText({
  text,
  className,
  linkClassName,
}: {
  text: string | null | undefined;
  className?: string;
  linkClassName?: string;
}) {
  if (!text) return <p className={className} />;
  return (
    <p className={className}>
      {splitMessageLinks(text).map((part, index) =>
        part.type === "link" ? (
          <a
            key={`${part.href}-${index}`}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
          >
            {part.value}
          </a>
        ) : (
          <span key={`text-${index}`}>{part.value}</span>
        ),
      )}
    </p>
  );
}

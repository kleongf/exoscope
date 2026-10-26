import { Fragment } from "react";

// A standalone number, optionally with an uncertainty ("4.153 (+0.161/-0.159)", "0.92 ± 0.013").
// Digits inside names ("TRAPPIST-1", "TOI-700", "55 Cnc e" stays) are left alone.
const NUMBER =
  /(?<![\w-])(\d[\d,]*(?:\.\d+)?(?:e[-+]?\d+)?)(?![\w-])(\s*(?:\(\+[\d.]+\/[-−][\d.]+\)|±\s*[\d.]+))?/gi;

/** The assistant's reply with its numbers picked out in the value colour, uncertainties dimmed. */
export function ReplyText({ text }: { text: string }) {
  const pieces: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(NUMBER)) {
    const index = match.index;
    if (index > last) pieces.push(text.slice(last, index));
    pieces.push(
      <Fragment key={index}>
        <span className="font-semibold text-qty-value">{match[1]}</span>
        {match[2] && <span className="text-qty-err">{match[2]}</span>}
      </Fragment>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) pieces.push(text.slice(last));
  return <>{pieces}</>;
}

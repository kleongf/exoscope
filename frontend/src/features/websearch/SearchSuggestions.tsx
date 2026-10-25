export function SearchSuggestions({ html }: { html: string }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium">Search suggestions</h4>
      <iframe
        className="h-44 w-full rounded-md border bg-white [color-scheme:light]"
        title="Provider search suggestions"
        sandbox=""
        referrerPolicy="no-referrer"
        srcDoc={html}
      />
    </div>
  );
}

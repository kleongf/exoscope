import { useEffect, useMemo } from "react";
import { Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TurnHistory } from "./TurnHistory";
import { useExoStore } from "../../store/store";
import { VoiceCapture } from "./capture";
import { ReplyAudio } from "./ReplyAudio";
import { projectTurnController } from "./turnController";

const statusLabels = {
  idle: "Ready for a question",
  requesting: "Requesting microphone permission… keep holding",
  recording: "Recording… release to send",
  processing: "Processing your question…",
};
function projectUnavailable() {
  const state = useExoStore.getState();
  return !state.currentProject || state.projectTransition;
}

export function TurnPanel() {
  const state = useExoStore();
  const turns = useMemo(() => projectTurnController, []);
  const capture = useMemo(
    () =>
      new VoiceCapture({
        status: (status) => {
          useExoStore.getState().setStatus(status);
        },
        complete: (audio) => {
          void turns.submit({ audio });
        },
        error: (message) => {
          useExoStore.getState().fail(message);
        },
      }),
    [turns],
  );
  useEffect(() => {
    const cancel = () => {
      capture.cancel();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    const hidden = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", escape);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", escape);
      document.removeEventListener("visibilitychange", hidden);
      capture.dispose();
      turns.dispose();
    };
  }, [capture, turns]);
  const unavailable = projectUnavailable();
  const start = () => {
    if (!unavailable && useExoStore.getState().status === "idle") void capture.start();
  };
  return (
    <aside
      aria-label="Project chat"
      className="flex min-h-[32rem] min-w-0 flex-col bg-card lg:min-h-0"
    >
      <header className="border-b px-4 py-3">
        <h2 id="ask-heading" className="text-sm font-semibold">
          Project chat
        </h2>
        <p className="text-xs text-muted-foreground">Ask, explore, and follow the evidence.</p>
      </header>
      <TurnHistory />
      <section className="space-y-3 border-t p-3" aria-labelledby="ask-heading">
        <div className="text-xs text-muted-foreground" aria-label="Transcript">
          <span className="font-medium">Transcript</span>
          <p className="mt-1 break-words" data-testid="transcript">
            {state.transcript || "Your spoken or typed question will appear here."}
          </p>
        </div>
        <p className="sr-only" data-testid="reply">
          {state.replyText}
        </p>
        <Button
          type="button"
          variant={state.status === "recording" ? "destructive" : "secondary"}
          className="w-full touch-none"
          data-testid="push-to-talk"
          disabled={unavailable || state.status === "processing"}
          aria-label="Hold to talk"
          aria-pressed={state.status === "recording"}
          aria-describedby="voice-help"
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            start();
          }}
          onPointerUp={() => {
            capture.stop();
          }}
          onPointerCancel={() => {
            capture.cancel();
          }}
          onLostPointerCapture={() => {
            capture.cancel();
          }}
          onBlur={() => {
            capture.cancel();
          }}
          onKeyDown={(event) => {
            if (event.key !== " " && event.key !== "Enter") return;
            event.preventDefault();
            if (!event.repeat) start();
          }}
          onKeyUp={(event) => {
            if (event.key !== " " && event.key !== "Enter") return;
            event.preventDefault();
            capture.stop();
          }}
        >
          <Mic />
          {state.status === "recording" ? "Release to send" : "Hold to talk"}
        </Button>
        <p id="voice-help" className="text-xs text-muted-foreground">
          Hold with pointer, Space or Enter. Escape cancels. Up to 30 seconds.
        </p>
        <p className="text-xs text-muted-foreground" role="status" data-testid="turn-status">
          {statusLabels[state.status]}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (unavailable || state.status !== "idle" || !state.draft.trim()) return;
            void turns.submit({ text: state.draft.trim() });
          }}
          className="flex gap-2"
        >
          <Input
            id="question"
            aria-label="Or type your question"
            disabled={unavailable}
            maxLength={2000}
            value={state.draft}
            placeholder="Type a question…"
            onChange={(event) => {
              state.setDraft(event.target.value);
            }}
            className="min-w-0 flex-1"
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Send question"
            disabled={unavailable || state.status !== "idle" || !state.draft.trim()}
          >
            <Send />
          </Button>
        </form>
        {state.error && state.turns.at(-1)?.error !== state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <ReplyAudio />
      </section>
    </aside>
  );
}

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useExoStore } from "../../store/store";

/** This effect runs after the response's commands and their DOM update have committed. */
export function ReplyAudio() {
  const audio = useExoStore((state) => state.replyAudio);
  const playback = useExoStore((state) => state.playback);
  const player = useRef<HTMLAudioElement | null>(null);
  const play = async () => {
    const current = player.current;
    if (!current) return;
    try {
      await current.play();
      if (player.current === current) useExoStore.getState().setPlayback("playing");
    } catch {
      if (player.current === current) useExoStore.getState().setPlayback("blocked");
    }
  };
  useEffect(() => {
    if (!audio) return;
    let url: string;
    try {
      const bytes = Uint8Array.from(atob(audio.data_base64), (character) =>
        character.charCodeAt(0),
      );
      url = URL.createObjectURL(new Blob([bytes], { type: audio.mime_type }));
    } catch {
      useExoStore.getState().setPlayback("error");
      return;
    }
    const current = new Audio(url);
    player.current = current;
    current.onended = () => {
      useExoStore.getState().setPlayback("idle");
    };
    current.onerror = () => {
      useExoStore.getState().setPlayback("error");
    };
    void play();
    return () => {
      player.current = null;
      current.onended = null;
      current.onerror = null;
      current.pause();
      current.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [audio]);
  if (!audio) return null;
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => {
          void play();
        }}
      >
        {playback === "blocked" ? "Play spoken reply" : "Replay spoken reply"}
      </Button>
      <span role="status">
        {playback === "blocked" && "Playback needs a click. Your reply is shown above."}
        {playback === "playing" && "Playing spoken reply"}
        {playback === "error" && "Audio could not play. Read the reply above."}
      </span>
    </div>
  );
}

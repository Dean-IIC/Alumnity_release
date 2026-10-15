"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { removeStoryAction, seenStoryAction, storyAction } from "../../lib/actions/content";
import { mediaUrl } from "../../lib/media-url";
import { Icon } from "./icons";

export type ReelData = {
  author: { id: number; name: string; first: string; photoId: string | null; initials: string };
  stories: { id: number; mediaId: string; kind: "image" | "video" | "html"; caption: string; ago: string }[];
  allSeen: boolean;
  mine: boolean;
};

const IMAGE_TIME = 5000;

/** A face in the stories row: their photo or initials, ringed in red pen while there's something new. */
function Face({ reel, size = 64 }: { reel: Pick<ReelData, "author">; size?: number }) {
  return reel.author.photoId ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="story-face__img" src={mediaUrl(reel.author.photoId)} alt="" width={size} height={size} />
  ) : (
    <span className="story-face__initials" style={{ width: size, height: size }}>
      {reel.author.initials}
    </span>
  );
}

/**
 * Stories along the top of Home: yours first (or "Add a story"), then your connections'
 * and the people you follow, new ones first. Opens a full-screen viewer.
 */
export function StoriesBar({ reels, me }: { reels: ReelData[]; me: ReelData["author"] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const mine = reels.find((r) => r.mine);
  const others = reels.filter((r) => !r.mine);
  const order = mine ? [mine, ...others] : others;

  return (
    <section className="stories" aria-label="Stories">
      <ol className="stories__row">
        <li>
          {mine ? (
            <button type="button" className="story-face" onClick={() => setOpen(0)}>
              <span className="story-face__ring story-face__ring--seen">
                <Face reel={mine} />
              </span>
              <span className="story-face__name">Your story</span>
            </button>
          ) : (
            <button type="button" className="story-face" onClick={() => setAdding(true)}>
              <span className="story-face__ring story-face__ring--add">
                <Face reel={{ author: me }} />
                <span className="story-face__plus" aria-hidden="true">
                  <Icon name="plus" size={14} />
                </span>
              </span>
              <span className="story-face__name">Add a story</span>
            </button>
          )}
        </li>
        {others.map((reel) => (
          <li key={reel.author.id}>
            <button type="button" className="story-face" onClick={() => setOpen(order.indexOf(reel))}>
              <span className={`story-face__ring ${reel.allSeen ? "story-face__ring--seen" : "story-face__ring--new"}`}>
                {!reel.allSeen && (
                  <svg className="story-face__pen" viewBox="0 0 80 80" aria-hidden="true">
                    {/* A ring drawn in one stroke, a little uneven, its end overrunning its start. */}
                    <path d="M40 4.5c19.8 0 35.4 15.7 35.4 35.6 0 19.6-15.9 35.5-35.6 35.5C20.1 75.6 4.5 59.6 4.5 40 4.5 20.2 20.4 4.9 40.6 4.2c4.5-.1 8.5.7 12.2 2" />
                  </svg>
                )}
                <Face reel={reel} />
              </span>
              <span className="story-face__name">{reel.author.first}</span>
              {!reel.allSeen && <span className="sr-only"> (new)</span>}
            </button>
          </li>
        ))}
      </ol>
      {open !== null && <StoryViewer reels={order} start={open} onClose={() => setOpen(null)} onAdd={() => (setOpen(null), setAdding(true))} />}
      {adding && <AddStory onClose={() => setAdding(false)} />}
    </section>
  );
}

/** Full screen: one story at a time, a bar per story, tap the sides to move, and it moves on by itself. */
function StoryViewer({ reels, start, onClose, onAdd }: { reels: ReelData[]; start: number; onClose: () => void; onAdd: () => void }) {
  const [reelAt, setReelAt] = useState(start);
  const [storyAt, setStoryAt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // Focus moves into the viewer, and back to where it was when it closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => before?.focus?.();
  }, []);

  const togglePause = () => {
    setPaused((p) => {
      if (p) void video.current?.play();
      else video.current?.pause();
      return !p;
    });
  };
  const reel = reels[reelAt];
  const story = reel?.stories[storyAt];

  const next = useCallback(() => {
    setProgress(0);
    if (storyAt + 1 < reel.stories.length) setStoryAt(storyAt + 1);
    else if (reelAt + 1 < reels.length) {
      setReelAt(reelAt + 1);
      setStoryAt(0);
    } else onClose();
  }, [storyAt, reelAt, reel, reels.length, onClose]);

  const back = () => {
    setProgress(0);
    if (storyAt > 0) setStoryAt(storyAt - 1);
    else if (reelAt > 0) {
      setReelAt(reelAt - 1);
      setStoryAt(reels[reelAt - 1].stories.length - 1);
    }
  };

  // Remember what was seen (not your own).
  useEffect(() => {
    if (story && !reel.mine) void seenStoryAction(story.id);
  }, [story, reel]);

  // Photos stay five seconds; videos as long as they last. Held down, it waits.
  useEffect(() => {
    if (!story || paused || story.kind === "video") return;
    const began = performance.now() - progress * IMAGE_TIME;
    let frame = 0;
    const tick = (now: number) => {
      const p = (now - began) / IMAGE_TIME;
      if (p >= 1) return next();
      setProgress(p);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, paused, next]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
      if (e.key === " " && (e.target as HTMLElement).tagName !== "BUTTON") {
        e.preventDefault();
        togglePause();
      }
      // Keep Tab inside the viewer while it's open.
      if (e.key === "Tab" && dialog.current) {
        const focusable = [...dialog.current.querySelectorAll<HTMLElement>("button, [href], input")].filter((el) => !el.hasAttribute("disabled"));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    document.documentElement.classList.add("story-open");
    return () => {
      document.removeEventListener("keydown", key);
      document.documentElement.classList.remove("story-open");
    };
  });

  if (!story) return null;
  return (
    <div className="story-viewer" role="dialog" aria-modal="true" aria-label={`${reel.author.name}'s story`} ref={dialog}>
      <div className="story-viewer__frame">
        <div className="story-viewer__bars">
          {reel.stories.map((s, i) => (
            <span key={s.id} className="story-viewer__bar">
              <span style={{ transform: `scaleX(${i < storyAt ? 1 : i === storyAt ? progress : 0})` }} />
            </span>
          ))}
        </div>
        <header className="story-viewer__head">
          <span className="story-viewer__face">
            <Face reel={reel} size={36} />
          </span>
          <span>
            <strong>{reel.mine ? "Your story" : reel.author.name}</strong> <span className="story-viewer__ago">{story.ago}</span>
          </span>
          <button type="button" className="story-viewer__pause" onClick={togglePause} aria-label={paused ? "Play" : "Pause"} aria-pressed={paused}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              {paused ? <path d="M8 5.5v13l10.5-6.5z" /> : <path d="M7.5 5h3v14h-3zM13.5 5h3v14h-3z" />}
            </svg>
          </button>
          <button type="button" className="story-viewer__close" onClick={onClose} aria-label="Close" ref={closeButton}>
            <Icon name="close" size={24} />
          </button>
        </header>
        <div
          className="story-viewer__media"
          onPointerDown={() => {
            setPaused(true);
            video.current?.pause();
          }}
          onPointerUp={() => {
            setPaused(false);
            void video.current?.play();
          }}
        >
          {story.kind === "video" ? (
            <video
              ref={video}
              key={story.id}
              src={mediaUrl(story.mediaId)}
              autoPlay
              playsInline
              onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime / (e.currentTarget.duration || 1))}
              onEnded={next}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={story.id} src={mediaUrl(story.mediaId)} alt={story.caption || `${reel.author.name}'s story`} />
          )}
          <button type="button" className="story-viewer__tap story-viewer__tap--back" onClick={back} aria-label="Previous" />
          <button type="button" className="story-viewer__tap story-viewer__tap--next" onClick={next} aria-label="Next" />
        </div>
        {story.caption && <p className="story-viewer__caption">{story.caption}</p>}
        {reel.mine && (
          <div className="story-viewer__own">
            <button type="button" className="button button--secondary wf-small" onClick={onAdd}>
              Add another
            </button>
            <OwnStoryDelete id={story.id} />
          </div>
        )}
      </div>
    </div>
  );
}

function OwnStoryDelete({ id }: { id: number }) {
  const [, run, pending] = useActionState(removeStoryAction, null);
  return (
    <form action={run} onSubmit={(e) => !window.confirm("Delete this story?") && e.preventDefault()}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="story-viewer__delete" disabled={pending}>
        Delete
      </button>
    </form>
  );
}

/** Choosing a photo or video for a story, a line to go with it, and sharing it. */
function AddStory({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<{ preview: string; kind: "image" | "video"; id?: string; error?: string } | null>(null);
  const [state, run, pending] = useActionState(storyAction, null);
  const input = useRef<HTMLInputElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // Focus into the sheet (and back after); Escape closes it; the file chooser opens at once.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    input.current?.click();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    document.documentElement.classList.add("story-open");
    return () => {
      document.removeEventListener("keydown", esc);
      document.documentElement.classList.remove("story-open");
      before?.focus?.();
    };
  }, [onClose]);
  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  const choose = async (f: File | undefined) => {
    if (!f) return;
    const preview = URL.createObjectURL(f);
    const kind = f.type.startsWith("video/") ? "video" : "image";
    setFile({ preview, kind });
    const body = new FormData();
    body.set("use", "story");
    body.set("file", f);
    const answer = await fetch("/api/media", { method: "POST", body })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "That didn't upload. Try again." }));
    setFile({ preview, kind, ...(answer.ok ? { id: answer.id } : { error: answer.error }) });
  };

  return (
    <div className="story-viewer" role="dialog" aria-modal="true" aria-label="Add a story">
      <form action={run} className="story-viewer__frame story-add">
        <header className="story-viewer__head">
          <strong>Add a story</strong>
          <button type="button" className="story-viewer__close" onClick={onClose} aria-label="Close" ref={closeButton}>
            <Icon name="close" size={24} />
          </button>
        </header>
        <div className="story-viewer__media">
          {file ? (
            file.kind === "video" ? (
              <video src={file.preview} autoPlay muted loop playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={file.preview} alt="" />
            )
          ) : (
            <button type="button" className="story-add__choose" onClick={() => input.current?.click()}>
              <Icon name="photo" size={40} />
              Choose a photo or video
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" hidden onChange={(e) => choose(e.target.files?.[0])} />
        {file?.id && <input type="hidden" name="media" value={file.id} />}
        <label className="sr-only" htmlFor="story-caption">
          A line to go with it
        </label>
        <input id="story-caption" name="caption" className="story-add__caption" maxLength={200} placeholder="A line to go with it (optional)" />
        {(file?.error || state?.error) && (
          <p className="story-add__error" role="alert">
            {file?.error ?? state?.error}
          </p>
        )}
        <p className="story-add__note">Your connections and followers can see it for 24 hours.</p>
        <button className="button button--primary" type="submit" disabled={!file?.id || pending}>
          {file && !file.id && !file.error ? "Uploading…" : pending ? "Sharing…" : "Share to your story"}
        </button>
      </form>
    </div>
  );
}

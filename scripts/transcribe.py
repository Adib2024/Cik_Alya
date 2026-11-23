#!/usr/bin/env python3
"""Transcribe a video/audio file with faster-whisper.

Writes <name>.srt (subtitles) and <name>.words.json (word-level timestamps,
for karaoke-style captions where the spoken word is highlighted).

    python scripts/transcribe.py footage/clip.mp4 [--model small] [--lang ms]

Filler words ("aaa", "erm") are dropped from the word list.
"""
import argparse
import json
import re
from pathlib import Path

from faster_whisper import WhisperModel

FILLERS = {"aa", "aaa", "aaaa", "er", "erm", "em", "emm", "uh", "um", "hmm", "ha"}


def ts(t: float) -> str:
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02}:{int(m):02}:{int(s):02},{int((s % 1) * 1000):03}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--model", default="small", help="tiny, base, small, medium, large-v3")
    ap.add_argument("--lang", default="ms", help="language code, e.g. ms or en; 'auto' to detect")
    ap.add_argument("--out", default=None, help="output directory (default: next to input)")
    args = ap.parse_args()

    src = Path(args.input)
    out_dir = Path(args.out) if args.out else src.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        str(src),
        language=None if args.lang == "auto" else args.lang,
        word_timestamps=True,
        vad_filter=True,  # skips long pauses
    )

    words, srt = [], []
    for i, seg in enumerate(segments, 1):
        srt.append(f"{i}\n{ts(seg.start)} --> {ts(seg.end)}\n{seg.text.strip()}\n")
        for w in seg.words or []:
            text = w.word.strip()
            if re.sub(r"[^\w]", "", text.lower()) in FILLERS:
                continue
            words.append({"word": text, "start": round(w.start, 3), "end": round(w.end, 3)})

    (out_dir / f"{src.stem}.srt").write_text("\n".join(srt), encoding="utf-8")
    (out_dir / f"{src.stem}.words.json").write_text(
        json.dumps({"language": info.language, "words": words}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"{info.language}: {len(srt)} segments, {len(words)} words -> {out_dir}")


if __name__ == "__main__":
    main()

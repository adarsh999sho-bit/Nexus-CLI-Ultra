import React, { useEffect, useState, useRef } from "react";
import { Text } from "ink";

interface StreamingTextProps {
  /** Full text to stream */
  text: string;
  /** Characters per tick */
  speed?: number;
  /** Tick interval in ms */
  interval?: number;
  /** Color of the text */
  color?: string;
  /** Whether to show a cursor at the end */
  showCursor?: boolean;
  /** Callback when streaming completes */
  onComplete?: () => void;
  /** Force immediate display of all text */
  immediate?: boolean;
}

export function StreamingText({
  text,
  speed = 3,
  interval = 16,
  color,
  showCursor = true,
  onComplete,
  immediate = false,
}: StreamingTextProps) {
  const [displayedLength, setDisplayedLength] = useState(immediate ? text.length : 0);
  const [done, setDone] = useState(immediate);
  const indexRef = useRef(0);
  const timerRef = useRef<Timer | null>(null);

  useEffect(() => {
    if (immediate) {
      setDisplayedLength(text.length);
      setDone(true);
      onComplete?.();
      return;
    }

    indexRef.current = 0;
    setDisplayedLength(0);
    setDone(false);

    timerRef.current = setInterval(() => {
      indexRef.current += speed;
      if (indexRef.current >= text.length) {
        setDisplayedLength(text.length);
        setDone(true);
        clearInterval(timerRef.current!);
        onComplete?.();
      } else {
        setDisplayedLength(indexRef.current);
      }
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [text, speed, interval, immediate]);

  const displayedText = text.slice(0, displayedLength);
  const cursor = showCursor && !done ? "█" : "";

  if (color) {
    return (
      <Text>
        <Text color={color}>{displayedText}</Text>
        <Text dimColor>{cursor}</Text>
      </Text>
    );
  }

  return (
    <Text>
      {displayedText}
      {cursor}
    </Text>
  );
}

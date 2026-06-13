import React, { useEffect, useState } from "react";
import { Text } from "ink";

interface SpinnerProps {
  /** Message to display next to the spinner */
  message?: string;
  /** Spinner type */
  type?: "dots" | "line" | "bounce";
}

const FRAMES: Record<string, string[]> = {
  dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  line: ["|", "/", "-", "\\"],
  bounce: ["◰", "◳", "◲", "◱"],
};

export function Spinner({ message = "", type = "dots" }: SpinnerProps) {
  const [frame, setFrame] = useState(0);
  const frames = FRAMES[type] || FRAMES.dots;

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, 80);
    return () => clearInterval(timer);
  }, [frames.length]);

  return (
    <Text>
      <Text color="cyan">{frames[frame]}</Text>
      {message ? <Text> {message}</Text> : null}
    </Text>
  );
}

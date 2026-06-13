import React from "react";
import { Text, Box } from "ink";
import { getTheme } from "./Theme";
import { StreamingText } from "./StreamingText";
import type { Theme, Message } from "../shared/types";
import { Role } from "../shared/types";

interface ChatProps {
  /** Conversation messages */
  messages: Message[];
  /** Currently streaming message (partial) */
  streamingMessage?: string;
  /** Theme */
  theme?: Theme;
}

const ROLE_COLORS: Record<Role, string> = {
  [Role.User]: "cyan",
  [Role.Assistant]: "green",
  [Role.System]: "yellow",
};

const ROLE_LABELS: Record<Role, string> = {
  [Role.User]: "You",
  [Role.Assistant]: "Nexus",
  [Role.System]: "System",
};

export function Chat({ messages, streamingMessage, theme }: ChatProps) {
  const activeTheme = theme || getTheme("nexus-dark");

  return (
    <Box flexDirection="column" width="100%">
      {/* Message history */}
      {messages.map((msg, index) => (
        <Box key={index} flexDirection="column" marginBottom={1}>
          <Text>
            <Text bold color={ROLE_COLORS[msg.role]}>
              {ROLE_LABELS[msg.role]}:
            </Text>
          </Text>
          <Box marginLeft={2}>
            <Text color={ROLE_COLORS[msg.role]}>
              {msg.content}
            </Text>
          </Box>
        </Box>
      ))}

      {/* Streaming message */}
      {streamingMessage ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text>
            <Text bold color="green">
              Nexus:
            </Text>
          </Text>
          <Box marginLeft={2}>
            <StreamingText
              text={streamingMessage}
              color="green"
              speed={2}
            />
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}

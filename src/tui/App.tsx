import React, { useState, useCallback } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { Chat } from "./Chat";
import { StatusBar } from "./StatusBar";
import { Spinner } from "./Spinner";
import { getTheme } from "./Theme";
import type { Message } from "../shared/types";
import { Role } from "../shared/types";
import type { Theme } from "../shared/types";

interface AppProps {
  /** Provider name */
  provider?: string;
  /** Model name */
  model?: string;
  /** Working directory */
  workingDir?: string;
  /** Initial system message */
  systemMessage?: string;
  /** Theme name */
  themeName?: string;
  /** Git branch */
  branch?: string | null;
}

export function App({
  provider = "deepseek",
  model = "deepseek-v4-flash-free",
  workingDir = ".",
  systemMessage = "Nexus CLI Ultra — AI Engineering Agent",
  themeName = "nexus-dark",
  branch,
}: AppProps) {
  const [messages, setMessages] = useState<Message[]>(
    systemMessage ? [{ role: Role.System, content: systemMessage }] : [],
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string | undefined>();
  const activeTheme = getTheme(themeName);

  const handleSubmit = useCallback(
    (value: string) => {
      if (!value.trim()) return;

      const userMsg: Message = { role: Role.User, content: value.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      // Simulate a response (will be replaced by actual LLM call later)
      setTimeout(() => {
        const response: Message = {
          role: Role.Assistant,
          content: `[Nexus] Processing: "${value.trim()}"\n\nThis is a placeholder response. The provider layer (Phase 2) will connect this to actual LLM models.`,
        };
        setMessages((prev) => [...prev, response]);
        setIsLoading(false);
        setStreamingMessage(undefined);
      }, 1000);

      setStreamingMessage(`Processing your request...`);
    },
    [],
  );

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="round" borderColor={activeTheme.primary} paddingX={1}>
        <Text bold color={activeTheme.primary}>
          ⚡ Nexus CLI Ultra
        </Text>
        <Text> </Text>
        <Text color={activeTheme.muted}>— AI Engineering Agent</Text>
      </Box>

      {/* Chat area */}
      <Box flexGrow={1} flexDirection="column" paddingX={1} paddingY={1}>
        <Chat messages={messages} streamingMessage={streamingMessage} theme={activeTheme} />

        {isLoading && !streamingMessage ? (
          <Box marginTop={1}>
            <Spinner message="Thinking..." type="dots" />
          </Box>
        ) : null}
      </Box>

      {/* Input area */}
      <Box borderStyle="round" borderColor={activeTheme.muted} paddingX={1}>
        <Text color="cyan">❯ </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={(value) => handleSubmit(value)}
          placeholder="Ask Nexus to code, plan, review, debug..."
        />
      </Box>

      {/* Status bar */}
      <StatusBar
        provider={provider}
        model={model}
        workingDir={workingDir}
        theme={activeTheme}
        branch={branch}
      />
    </Box>
  );
}

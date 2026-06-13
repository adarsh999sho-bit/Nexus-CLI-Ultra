import React from "react";
import { Text, Box } from "ink";
import { getTheme } from "./Theme";
import type { Theme } from "../shared/types";

interface StatusBarProps {
  /** Current provider name */
  provider: string;
  /** Current model name */
  model: string;
  /** Working directory */
  workingDir: string;
  /** Theme */
  theme?: Theme;
  /** Git branch (if in a repo) */
  branch?: string | null;
}

export function StatusBar({
  provider,
  model,
  workingDir,
  theme: activeTheme,
  branch,
}: StatusBarProps) {
  const theme = activeTheme || getTheme("nexus-dark");

  return (
    <Box
      borderStyle="round"
      borderColor={theme.muted}
      paddingX={1}
      width="100%"
    >
      <Text>
        <Text color={theme.primary}>⚡</Text>
        <Text> </Text>
        <Text color={theme.info}>{provider}</Text>
        <Text color={theme.muted}> / </Text>
        <Text color={theme.secondary}>{model}</Text>
        {branch ? (
          <>
            <Text> </Text>
            <Text color={theme.success}>⎇ {branch}</Text>
          </>
        ) : null}
        <Text> </Text>
        <Text dimColor>{workingDir}</Text>
      </Text>
    </Box>
  );
}

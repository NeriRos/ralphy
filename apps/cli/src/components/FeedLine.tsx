import { Box, Text } from "ink";
import type { FeedEvent } from "@ralphy/engine/feed-events";

function SessionLine({ event }: { event: Extract<FeedEvent, { type: "session" }> }) {
  return (
    <Box>
      <Text color="gray">── </Text>
      <Text bold>{event.model}</Text>
      <Text color="gray"> ({event.sessionId}…)</Text>
    </Box>
  );
}

function SessionUnknown({ event }: { event: Extract<FeedEvent, { type: "session-unknown" }> }) {
  return (
    <Box>
      <Text color="red">✗ </Text>
      <Text bold>UNKNOWN</Text>
      <Text dimColor> ({event.sessionId}…) - see --log</Text>
    </Box>
  );
}

function ThinkingLine({ event }: { event: Extract<FeedEvent, { type: "thinking" }> }) {
  if (event.preview) {
    return (
      <Box>
        <Text color="gray">  💭 </Text>
        <Text dimColor>{event.preview.split("\n")[0]}</Text>
      </Box>
    );
  }
  return <Text color="gray">  💭</Text>;
}

function TextLine({ event }: { event: Extract<FeedEvent, { type: "text" }> }) {
  return <Text bold>{event.text}</Text>;
}

function ToolStartLine({ event }: { event: Extract<FeedEvent, { type: "tool-start" }> }) {
  return (
    <Box>
      <Text>  </Text>
      <Text color="cyan">▶ {event.name}</Text>
      {event.summary ? <Text dimColor> {event.summary}</Text> : null}
    </Box>
  );
}

function ToolEndLine({ event }: { event: Extract<FeedEvent, { type: "tool-end" }> }) {
  return (
    <Box>
      <Text color="green"> ✓</Text>
      {event.name ? <Text dimColor> {event.name}</Text> : null}
      {event.summary ? <Text dimColor> → {event.summary}</Text> : null}
    </Box>
  );
}

function TurnStartLine() {
  return <Text bold>{"\n"}▶ turn started</Text>;
}

function TurnDoneLine({ event }: { event: Extract<FeedEvent, { type: "turn-done" }> }) {
  if (event.inputTokens !== undefined) {
    return (
      <Box>
        <Text color="green">✓ done</Text>
        <Text dimColor>  in={event.inputTokens}  out={event.outputTokens ?? 0}</Text>
      </Box>
    );
  }
  return <Text color="green">✓ done</Text>;
}

function formatCost(usd: number): string {
  return (Math.round(usd * 100) / 100).toFixed(2);
}

function ResultLine({ event }: { event: Extract<FeedEvent, { type: "result" }> }) {
  const info = [
    `cost=$${formatCost(event.cost)}`,
    `time=${Math.round((event.timeMs / 1000) * 10) / 10}s`,
    `turns=${event.turns}`,
    `in=${event.inputTokens}`,
    `out=${event.outputTokens}`,
    `cached=${event.cached}`,
  ].join("  ");

  return (
    <Box>
      <Text color="green">✓ done</Text>
      <Text dimColor>  {info}</Text>
    </Box>
  );
}

function ResultErrorLine({ event }: { event: Extract<FeedEvent, { type: "result-error" }> }) {
  return (
    <Box>
      <Text color="red" bold>✗ Error</Text>
      <Text color="red"> {event.message}</Text>
    </Box>
  );
}

function ErrorLine({ event }: { event: Extract<FeedEvent, { type: "error" }> }) {
  return (
    <Box>
      <Text color="red">error: </Text>
      <Text>{event.message}</Text>
    </Box>
  );
}

function RateLimitLine({ event }: { event: Extract<FeedEvent, { type: "rate-limit" }> }) {
  return (
    <Box>
      <Text color="red" bold>✗ Rate limit reached</Text>
      <Text color="red"> {event.message}</Text>
    </Box>
  );
}

function InterruptedLine({ event }: { event: Extract<FeedEvent, { type: "interrupted" }> }) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="red" bold>✗ Stream interrupted</Text>
        <Text dimColor>  (no result received)</Text>
      </Box>
      <Text dimColor>  turns={event.turns}  tools={event.tools}</Text>
    </Box>
  );
}

function AgentLine({ event }: { event: Extract<FeedEvent, { type: "agent" }> }) {
  return <Text dimColor>  ⊳ agent: {event.description}</Text>;
}

export function FeedLine({ event }: { event: FeedEvent }) {
  switch (event.type) {
    case "session":
      return <SessionLine event={event} />;
    case "session-unknown":
      return <SessionUnknown event={event} />;
    case "agent":
      return <AgentLine event={event} />;
    case "thinking":
      return <ThinkingLine event={event} />;
    case "text":
      return <TextLine event={event} />;
    case "tool-start":
      return <ToolStartLine event={event} />;
    case "tool-end":
      return <ToolEndLine event={event} />;
    case "tool-result-preview":
      return (
        <Box flexDirection="column">
          {event.lines.map((line, i) => (
            <Text key={i} dimColor>    {line}</Text>
          ))}
          {event.truncated ? <Text dimColor>    … ({event.truncated} more lines)</Text> : null}
        </Box>
      );
    case "turn-start":
      return <TurnStartLine />;
    case "turn-done":
      return <TurnDoneLine event={event} />;
    case "result":
      return <ResultLine event={event} />;
    case "result-error":
      return <ResultErrorLine event={event} />;
    case "error":
      return <ErrorLine event={event} />;
    case "rate-limit":
      return <RateLimitLine event={event} />;
    case "interrupted":
      return <InterruptedLine event={event} />;
    case "raw":
      return <Text dimColor>{event.text}</Text>;
  }
}

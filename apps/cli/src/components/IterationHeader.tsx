import { Text } from "ink";

export interface IterationHeaderProps {
  iteration: number;
  time: string;
}

export function IterationHeader({ iteration, time }: IterationHeaderProps) {
  return <Text>{"\n"}======== ITERATION {iteration} {time} ========{"\n"}</Text>;
}

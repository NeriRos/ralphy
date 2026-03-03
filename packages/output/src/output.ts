import chalk from "chalk";

export type Style =
  | "bold"
  | "dim"
  | "gray"
  | "error"
  | "fail"
  | "warn"
  | "header"
  | "success"
  | "successBold"
  | "cyan";

export interface StyledText {
  text: string;
  style: Style;
}

const formatters: Record<Style, (text: string) => string> = {
  bold: (text) => chalk.bold(text),
  dim: (text) => chalk.dim(text),
  gray: (text) => chalk.gray(text),
  error: (text) => chalk.red(text),
  fail: (text) => chalk.red.bold(text),
  warn: (text) => chalk.yellow.bold(text),
  header: (text) => chalk.bold.cyan(text),
  success: (text) => chalk.green(text),
  successBold: (text) => chalk.green.bold(text),
  cyan: (text) => chalk.cyan(text),
};

function format(msg: StyledText): string {
  return formatters[msg.style](msg.text);
}

export function styled(text: string, style: Style): string {
  return format({ text, style });
}

export function log(msg: string | StyledText): void {
  console.log(typeof msg === "string" ? msg : format(msg));
}

export function error(msg: string | StyledText): void {
  console.error(typeof msg === "string" ? msg : format(msg));
}

export function blank(): void {
  console.log("");
}

export function separator(width = 44): void {
  console.log(chalk.gray("\u2501".repeat(width)));
}

export function kv(label: string, value: string, pad = 12): void {
  console.log(` ${chalk.bold((label + ":").padEnd(pad))} ${value}`);
}

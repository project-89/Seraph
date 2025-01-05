import chalk from "chalk";
import boxen, { Options as BoxenOptions } from "boxen";

export const styles = {
  system: chalk.blue,
  user: chalk.yellow,
  assistant: chalk.green,
  error: chalk.red,
  info: chalk.cyan,
  dim: chalk.gray,
  highlight: chalk.magenta,
  success: chalk.greenBright,
  warning: chalk.yellow,
};

export const boxes = {
  system: {
    padding: 1,
    margin: 1,
    borderStyle: "round",
    borderColor: "blue",
  } as BoxenOptions,

  assistant: {
    padding: 1,
    margin: 1,
    borderStyle: "double",
    borderColor: "green",
    title: "Seraph",
    dimBorder: true,
  } as BoxenOptions,

  error: {
    padding: 1,
    margin: 1,
    borderStyle: "single",
    borderColor: "red",
    title: "Error",
  } as BoxenOptions,

  info: {
    padding: 1,
    borderStyle: "single",
    borderColor: "cyan",
    dimBorder: true,
  } as BoxenOptions,

  function: {
    padding: 1,
    borderStyle: "classic",
    borderColor: "magenta",
    dimBorder: true,
  } as BoxenOptions,
};

export const formatResponse = (
  text: string,
  type: keyof typeof boxes = "assistant"
): string => {
  return boxen(text, boxes[type]);
};

export const formatSystemMessage = (text: string): string => {
  return styles.system(`[System] ${text}`);
};

export const formatUserInput = (text: string): string => {
  return styles.user(`[User] ${text}`);
};

export const formatError = (text: string): string => {
  return boxen(styles.error(text), boxes.error);
};

export const formatInfo = (
  text: string,
  data?: Record<string, unknown>
): string => {
  const message = data
    ? `${text}\n${styles.dim(JSON.stringify(data, null, 2))}`
    : text;
  return boxen(message, boxes.info);
};

export const formatFunction = (name: string, result: string): string => {
  return boxen(
    `${styles.highlight(name)}\n${styles.dim("Result:")}\n${result}`,
    boxes.function
  );
};

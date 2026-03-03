export default {
  "*.{ts,js,mts,mjs}": ["oxlint --fix", "oxfmt --write"],
  "*": ["secretlint"],
  "*.{json,md,yaml,yml}": ["oxfmt --write"],
};

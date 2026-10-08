module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@ffmpeg/*', '*ffmpeg*'],
            message:
              'ffmpeg.wasm deve restare IRRAGGIUNGIBILE dal grafo di import eager: solo dynamic import nel futuro modulo video dedicato (decisione architetturale PLAN.md T0.2).',
          },
        ],
      },
    ],
  },
}

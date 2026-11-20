import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'src/**/*', 'uploads/**/*', '*.ts', '*.tsx', '*.js']
  },
  firebaseRulesPlugin.configs['flat/recommended']
];

import { defineConfig, globalIgnores } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';
export default defineConfig([globalIgnores(['dist/*', 'public/kitchen/sql-wasm.js']), expoConfig]);

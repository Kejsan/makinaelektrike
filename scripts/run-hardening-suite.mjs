import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SUITES = {
  rules: 'vitest run --config vitest.hardening.config.ts tests/rules',
  backend: 'vitest run --config vitest.hardening.config.ts tests/backend',
  hardening: 'vitest run --config vitest.hardening.config.ts tests/rules tests/backend',
};

const suiteName = process.argv[2] ?? 'hardening';
const vitestCommand = SUITES[suiteName];

if (!vitestCommand) {
  console.error(
    `Unknown hardening suite "${suiteName}". Expected one of: ${Object.keys(SUITES).join(', ')}.`,
  );
  process.exit(1);
}

const workspaceRoot = process.cwd();
const firebaseHome = path.join(workspaceRoot, '.firebase-home');
const firebaseConfigHome = path.join(workspaceRoot, '.firebase-config');
const firebaseEmulatorCache = path.join(workspaceRoot, '.firebase-cache', 'emulators');

mkdirSync(firebaseHome, { recursive: true });
mkdirSync(firebaseConfigHome, { recursive: true });
mkdirSync(firebaseEmulatorCache, { recursive: true });

const findJavaHome = () => {
  const javaHomeFromEnv = process.env.JAVA_HOME;
  if (javaHomeFromEnv) {
    const javaExecutable = path.join(
      javaHomeFromEnv,
      'bin',
      process.platform === 'win32' ? 'java.exe' : 'java',
    );
    if (existsSync(javaExecutable)) {
      return javaHomeFromEnv;
    }
  }

  if (process.platform !== 'win32') {
    return null;
  }

  const roots = [
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Eclipse Adoptium'),
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Java'),
  ];

  for (const root of roots) {
    if (!existsSync(root)) {
      continue;
    }

    const subdirectories = readdirSync(root)
      .map(name => path.join(root, name))
      .filter(entry => {
        try {
          return statSync(entry).isDirectory();
        } catch {
          return false;
        }
      })
      .sort((left, right) => right.localeCompare(left));

    for (const subdirectory of subdirectories) {
      const javaExecutable = path.join(subdirectory, 'bin', 'java.exe');
      if (existsSync(javaExecutable)) {
        return subdirectory;
      }
    }
  }

  return null;
};

const javaHome = findJavaHome();
process.env.HOME = firebaseHome;
process.env.XDG_CONFIG_HOME = firebaseConfigHome;
process.env.FIREBASE_EMULATORS_PATH = firebaseEmulatorCache;

if (javaHome) {
  const javaBin = path.join(javaHome, 'bin');
  process.env.JAVA_HOME = javaHome;
  process.env.PATH = `${javaBin}${path.delimiter}${process.env.PATH ?? ''}`;
}

try {
  const firebaseToolsModule = await import('firebase-tools');
  const firebaseTools = firebaseToolsModule.default ?? firebaseToolsModule;
  await firebaseTools.emulators.exec(vitestCommand, {
    project: 'demo-makina-elektrike',
    only: 'auth,firestore,storage',
    config: path.join(workspaceRoot, 'firebase.json'),
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}

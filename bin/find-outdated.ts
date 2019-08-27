import { promisify } from 'util';
import { exec } from 'child_process';
import { join } from 'path';
import { readFile, writeFile, unlink, access } from 'fs';

type TLernaListItem = {
  name: string;
  version: string;
  private: boolean;
  location: string;
};

type TLernaListResult = TLernaListItem[];

type TPkgJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

const execP = promisify(exec);
const readFileP = promisify(readFile);
const writeFileP = promisify(writeFile);
const unlinkP = promisify(unlink);
const info = console.info;

let exiting = false;

const parseLernaListResult = (raw: string): TLernaListResult => {
  return JSON.parse(raw) as TLernaListResult;
};

const getMonorepoPackages = async () => {
  const { stdout } = await execP('lerna la --json');

  return parseLernaListResult(stdout);
};

const getPkgJsonPaths = (pkg: TLernaListItem) => {
  const path = join(pkg.location, 'package.json');
  const lockPath = join(pkg.location, 'package-lock.json');
  const bakPath = `package.json.purge.bak`;

  return { path, lockPath, bakPath };
};

const readPkgJson = async (path: string) => JSON.parse((await readFileP(path)).toString()) as TPkgJson;

const writePkgJson = async (path: string, pkgJson: TPkgJson) =>
  await writeFileP(path, `${JSON.stringify(pkgJson, null, 2)}\n`);

const purgeMonorepoDeps = (deps: Record<string, string>, internalPackageNames: string[]) => {
  for (const k of internalPackageNames) {
    delete deps[k];
  }
};

const exciseInternal = async (path: string, bakPath: string, internalPackageNames: string[]) => {
  const pkjJson = await readPkgJson(path);

  await writePkgJson(bakPath, pkjJson);

  if (pkjJson.dependencies) {
    purgeMonorepoDeps(pkjJson.dependencies, internalPackageNames);
  }

  if (pkjJson.devDependencies) {
    purgeMonorepoDeps(pkjJson.devDependencies, internalPackageNames);
  }

  if (pkjJson.optionalDependencies) {
    purgeMonorepoDeps(pkjJson.optionalDependencies, internalPackageNames);
  }

  await writePkgJson(path, pkjJson);
};

const restorePkgJson = async (path: string, bakPath: string) => {
  const pkjJson = await readPkgJson(bakPath);

  await writePkgJson(path, pkjJson);
  await unlinkP(bakPath);
};

const npmOutdated = async (pkg: TLernaListItem, internalPackageNames: string[]) => {
  const pos = internalPackageNames.indexOf(pkg.name) + 1;
  const { path, bakPath } = getPkgJsonPaths(pkg);

  info(`running npm outdated on lerna package: ${pkg.name}@${pkg.version} [${pos}/${internalPackageNames.length}]`);

  await exciseInternal(path, bakPath, internalPackageNames);

  const npmOutP = new Promise<string>((resolve, reject) => {
    exec(`npm outdated`, { maxBuffer: 1024 * 1024 * 50, cwd: pkg.location }, (err, stdout, stderr) => {
      if (!stdout && !err) {
        resolve('');
      } else if (stdout) {
        resolve(stdout);
      } else {
        reject(err || stderr || new Error('missing stdout in npm result'));
      }
    });
  });

  try {
    const npmOut = await npmOutP;
    await restorePkgJson(path, bakPath);

    return npmOut;
  } catch (e) {
    try {
      await restorePkgJson(path, bakPath);
    } catch {}

    throw e;
  }
};

const npmOutdatedAll = async () => {
  const pkgs = await getMonorepoPackages();
  const internalPackageNames = pkgs.map((p) => p.name);

  for (const pkg of pkgs) {
    if (!exiting) {
      const npmOut = await npmOutdated(pkg, internalPackageNames);
      if (npmOut) {
        info(npmOut);
      }
    }
  }

  if (exiting) {
    throw new Error('forced to exit');
  }
};

process.on('SIGTERM', () => {
  console.info('SIGTERM signal received.');
  exiting = true;
});

process.on('SIGINT', () => {
  console.info('SIGTERM signal received.');
  exiting = true;
});

npmOutdatedAll()
  .then(() => {
    info('finished');
  })
  .catch((err) => {
    console.error('oh dear!', err);
  });

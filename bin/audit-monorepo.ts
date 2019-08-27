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

type TNpmAuditResult = {
  metadata: {
    vulnerabilities: { info: number; low: number; moderate: number; high: number; critical: number };
    dependencies: number;
    devDependencies: number;
    optionalDependencies: number;
    totalDependencies: number;
  };
};

const execP = promisify(exec);
const readFileP = promisify(readFile);
const writeFileP = promisify(writeFile);
const unlinkP = promisify(unlink);
const accessP = promisify(access);

const noop = (...args: any[]) => undefined;

const verboseMode = process.argv.indexOf('--verbose') !== -1;
const quietMode = !verboseMode && process.argv.indexOf('--quiet') !== -1;

const info = quietMode ? noop : console.info;
const debug = verboseMode ? console.debug : noop;

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

const auditInternalPackage = async (pkg: TLernaListItem, internalPackageNames: string[]) => {
  const pos = internalPackageNames.indexOf(pkg.name) + 1;
  const { path, bakPath, lockPath } = getPkgJsonPaths(pkg);

  try {
    await accessP(lockPath);
    info(`auditing lerna package: ${pkg.name}@${pkg.version} [${pos}/${internalPackageNames.length}]`);
  } catch {
    info(`SKIPPING lerna package: ${pkg.name}@${pkg.version} (no lock file) [${pos}/${internalPackageNames.length}]`);
    return;
  }

  await exciseInternal(path, bakPath, internalPackageNames);

  const auditStdOutP = new Promise<TNpmAuditResult>((resolve, reject) => {
    exec(`npm audit --json`, { maxBuffer: 1024 * 1024 * 50, cwd: pkg.location }, (err, stdout, stderr) => {
      try {
        const parsed: TNpmAuditResult = JSON.parse(stdout);
        // if can be parsed it's *probably* a good result even if process is non-zero because of vulns
        if (parsed.metadata) {
          resolve(JSON.parse(stdout));
        } else {
          reject(err || stderr || new Error('missing metadata in audit result'));
        }
      } catch (e) {
        reject(err || stderr || e);
      }
    });
  });

  try {
    const auditResult = await auditStdOutP;
    await restorePkgJson(path, bakPath);

    return auditResult;
  } catch (e) {
    try {
      await restorePkgJson(path, bakPath);
    } catch {}

    throw e;
  }
};

const hasVulns = (md: TNpmAuditResult['metadata']): boolean => {
  return (
    md.vulnerabilities.low + md.vulnerabilities.moderate + md.vulnerabilities.high + md.vulnerabilities.critical !== 0
  );
};

const sumMetadata = (a: TNpmAuditResult['metadata'], b: TNpmAuditResult['metadata']): TNpmAuditResult['metadata'] => {
  return {
    dependencies: a.dependencies + b.dependencies,
    devDependencies: a.devDependencies + b.devDependencies,
    optionalDependencies: a.optionalDependencies + b.optionalDependencies,
    totalDependencies: a.totalDependencies + b.totalDependencies,
    vulnerabilities: {
      info: a.vulnerabilities.info + b.vulnerabilities.info,
      low: a.vulnerabilities.low + b.vulnerabilities.low,
      moderate: a.vulnerabilities.moderate + b.vulnerabilities.moderate,
      high: a.vulnerabilities.high + b.vulnerabilities.high,
      critical: a.vulnerabilities.critical + b.vulnerabilities.critical,
    },
  };
};

const auditInternalPackages = async () => {
  const pkgs = await getMonorepoPackages();
  const internalPackageNames = pkgs.map((p) => p.name);

  let combinedMetadata: TNpmAuditResult['metadata'] = {
    dependencies: 0,
    devDependencies: 0,
    optionalDependencies: 0,
    totalDependencies: 0,
    vulnerabilities: {
      info: 0,
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
    },
  };

  const metaDataLookup: Record<string, TNpmAuditResult['metadata']['vulnerabilities']> = {};

  for (const pkg of pkgs) {
    if (!exiting) {
      const auditResult = await auditInternalPackage(pkg, internalPackageNames);
      if (auditResult) {
        debug(JSON.stringify(auditResult, null, 2));
        if (hasVulns(auditResult.metadata)) {
          metaDataLookup[pkg.name] = auditResult.metadata.vulnerabilities;
        }
        combinedMetadata = sumMetadata(combinedMetadata, auditResult.metadata);
      }
    }
  }

  if (exiting) {
    throw new Error('forced to exit');
  }

  info(`final results: `);
  console.log(JSON.stringify({ totals: combinedMetadata, packages: metaDataLookup }, null, 2));
};

process.on('SIGTERM', () => {
  console.info('SIGTERM signal received.');
  exiting = true;
});

process.on('SIGINT', () => {
  console.info('SIGTERM signal received.');
  exiting = true;
});

info('auditing monorepo');
auditInternalPackages()
  .then(() => {
    info('finished auditing');
  })
  .catch((err) => {
    console.error('oh dear!', err);
  });

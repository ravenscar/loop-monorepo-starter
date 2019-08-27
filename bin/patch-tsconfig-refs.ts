import { promisify } from 'util';
import { exec } from 'child_process';
import { relative, join } from 'path';
import { readFile, writeFile, existsSync } from 'fs';

type TListResult = {
  name: string;
  version: string;
  private: boolean;
  location: string;
}[];

type TReferences = {
  path: string;
}[];

type TTsConfig = {
  references: TReferences;
};

const execP = promisify(exec);
const readFileP = promisify(readFile);
const writeFileP = promisify(writeFile);

const parseListResult = (raw: string): TListResult => {
  return JSON.parse(raw) as TListResult;
};

const isTsProject = (project: TListResult[number]) => {
  const tsConfig = join(project.location, 'tsconfig.json');
  return existsSync(tsConfig);
};

const getProjects = async () => {
  const { stdout } = await execP('lerna la --json');

  return parseListResult(stdout).filter(isTsProject);
};

const getRelativeRefs = (name: string, listResult: TListResult) => {
  const thisModule = listResult.find((r) => r.name === name);

  if (!thisModule) {
    throw new Error(`can't find module ${name} in listResult ${listResult}`);
  }

  const relativeReferences = listResult
    .filter((r) => r.name !== name)
    .map((r) => {
      const path = relative(thisModule.location, r.location);

      return { path };
    });

  return { relativeReferences, packageRoot: thisModule.location };
};

const getRefsForProject = async (name: string) => {
  const { stdout } = await execP(`lerna la --scope=${name} --include-filtered-dependencies --json`);

  const listResult = parseListResult(stdout).filter(isTsProject);

  return getRelativeRefs(name, listResult);
};

const loadTsConfig = async (path: string) => {
  return JSON.parse((await readFileP(path)).toString()) as TTsConfig;
};

const mergePaths = (tsConfig: TTsConfig, references: TReferences) => {
  const oldRefsSorted = (tsConfig.references || [])
    .map((r) => r.path)
    .sort()
    .join('$$$');
  const currentRefsSorted = references
    .map((r) => r.path)
    .sort()
    .join('$$$');

  if (currentRefsSorted !== oldRefsSorted) {
    return { ...tsConfig, references };
  }

  return null;
};

const applyNewRefs = async (refs: ReturnType<typeof getRelativeRefs>) => {
  const path = join(refs.packageRoot, 'tsconfig.json');
  let tsConfig: TTsConfig;

  try {
    tsConfig = await loadTsConfig(path);
  } catch {
    return;
  }

  const update = mergePaths(tsConfig, refs.relativeReferences);

  if (update) {
    console.log(`${path} requires reference updates`);
    await writeFileP(path, JSON.stringify(update, null, 2));
  }
};

const updateConfigForProject = async (name: string) => {
  const refs = await getRefsForProject(name);
  return applyNewRefs(refs);
};

const updateProjects = async () => {
  const mainProject = process.env.npm_package_name;

  if (!mainProject) {
    throw new Error('no process.env.npm_package_name, this is expected to be invoked from npm then lerna');
  }

  const blacklist = ['@loop/tsconfig-base'];

  const projects = (await getProjects()).filter((r) => blacklist.indexOf(r.name) === -1);

  const names = projects.map((info) => info.name).filter((n) => n !== mainProject);

  await Promise.all(names.map(updateConfigForProject));

  const mainRefs = getRelativeRefs(mainProject, projects);

  await applyNewRefs(mainRefs);
};

console.log('searching for tsconfig.json files with out of date references');
updateProjects()
  .then(() => {
    console.log('finished searching');
  })
  .catch((err) => {
    console.error('oh dear!', err);
  });

import {
  addProjectConfiguration,
  getProjects,
  NxJsonConfiguration,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import * as enquirer from 'enquirer';

import { Linter } from '@nrwl/linter';
import { libraryGenerator } from '@nrwl/js';
import { TsConfig } from '../../utils/utilities';
import { storybook7Version } from '../../utils/versions';
import configurationGenerator from './configuration';
import * as variousProjects from './test-configs/various-projects.json';

// nested code imports graph from the repo, which might have innacurate graph version
jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual<any>('nx/src/project-graph/project-graph'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => ({ nodes: {}, dependencies: {} })),
}));
jest.mock('enquirer');
// @ts-ignore
enquirer.prompt = jest.fn();

describe('@nrwl/storybook:configuration for Storybook v7', () => {
  describe('basic functionalities', () => {
    let tree: Tree;

    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.namedInputs = {
          production: ['default'],
        };
        return json;
      });
      await libraryGenerator(tree, {
        name: 'test-ui-lib',
        bundler: 'none',
      });
      writeJson(tree, 'package.json', {
        devDependencies: {
          '@storybook/addon-essentials': storybook7Version,
          '@storybook/react': storybook7Version,
          '@storybook/core-server': storybook7Version,
        },
      });

      jest.resetModules();
      jest.doMock('@storybook/core-server/package.json', () => ({
        version: '7.0.2',
      }));
    });

    it('should generate TypeScript Configuration files', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        standaloneConfig: false,
        tsConfiguration: true,
        storybook7UiFramework: '@storybook/angular',
      });
      const project = readProjectConfiguration(tree, 'test-ui-lib');
      expect(project).toMatchSnapshot();

      expect(tree.read('.storybook/main.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('libs/test-ui-lib/.storybook/tsconfig.json', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('libs/test-ui-lib/.storybook/main.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.exists('libs/test-ui-lib/.storybook/preview.ts')
      ).toBeTruthy();
    });

    it('should update `tsconfig.lib.json` file', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        standaloneConfig: false,
        storybook7UiFramework: '@storybook/react-webpack5',
      });
      const tsconfigJson = readJson<TsConfig>(
        tree,
        'libs/test-ui-lib/tsconfig.lib.json'
      ) as Required<TsConfig>;

      expect(tsconfigJson.exclude).toContain('**/*.stories.ts');
      expect(tsconfigJson.exclude).toContain('**/*.stories.js');
      expect(tsconfigJson.exclude).toContain('**/*.stories.jsx');
      expect(tsconfigJson.exclude).toContain('**/*.stories.tsx');
    });

    it('should update `tsconfig.json` file', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        standaloneConfig: false,

        storybook7UiFramework: '@storybook/react-webpack5',
      });
      const tsconfigJson = readJson<TsConfig>(
        tree,
        'libs/test-ui-lib/tsconfig.json'
      );

      expect(tsconfigJson.references).toMatchInlineSnapshot(`
      Array [
        Object {
          "path": "./tsconfig.lib.json",
        },
        Object {
          "path": "./tsconfig.spec.json",
        },
        Object {
          "path": "./.storybook/tsconfig.json",
        },
      ]
    `);
    });

    it("should update the project's .eslintrc.json if config exists", async () => {
      await libraryGenerator(tree, {
        name: 'test-ui-lib2',
        linter: Linter.EsLint,
      });

      updateJson(tree, 'libs/test-ui-lib2/.eslintrc.json', (json) => {
        json.parserOptions = {
          project: [],
        };
        return json;
      });

      await configurationGenerator(tree, {
        name: 'test-ui-lib2',
        standaloneConfig: false,
        storybook7UiFramework: '@storybook/react-webpack5',
      });

      expect(readJson(tree, 'libs/test-ui-lib2/.eslintrc.json').parserOptions)
        .toMatchInlineSnapshot(`
      Object {
        "project": Array [
          "libs/test-ui-lib2/.storybook/tsconfig.json",
        ],
      }
    `);
    });

    it('should have the proper typings', async () => {
      await libraryGenerator(tree, {
        name: 'test-ui-lib2',
        linter: Linter.EsLint,
      });

      await configurationGenerator(tree, {
        name: 'test-ui-lib2',
        standaloneConfig: false,
        storybook7UiFramework: '@storybook/react-webpack5',
      });

      expect(
        tree.read('libs/test-ui-lib2/.storybook/tsconfig.json', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should generate TS config for project if tsConfiguration true', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        standaloneConfig: false,
        tsConfiguration: true,
        storybook7UiFramework: '@storybook/angular',
      });

      expect(
        tree.read('libs/test-ui-lib/.storybook/main.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.exists('libs/test-ui-lib/.storybook/preview.ts')
      ).toBeTruthy();
      expect(tree.exists('libs/test-ui-lib/.storybook/main.js')).toBeFalsy();
      expect(tree.exists('libs/test-ui-lib/.storybook/preview.js')).toBeFalsy();
    });

    it('should add test-storybook target', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        configureTestRunner: true,
        storybook7UiFramework: '@storybook/react-webpack5',
      });

      expect(
        readJson(tree, 'package.json').devDependencies['@storybook/test-runner']
      ).toBeTruthy();

      const project = readProjectConfiguration(tree, 'test-ui-lib');
      expect(project.targets['test-storybook']).toEqual({
        executor: 'nx:run-commands',
        options: {
          command:
            'test-storybook -c libs/test-ui-lib/.storybook --url=http://localhost:4400',
        },
      });
    });
  });

  describe('generate Storybook configuration for all types of projects', () => {
    let tree: Tree;
    let testCases: string[][] = [];

    for (const [name, project] of Object.entries(variousProjects)) {
      testCases.push([
        `${
          project.projectType === 'application' ? 'apps' : 'libs'
        }/${name}/.storybook/`,
      ]);
    }

    beforeAll(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      for (const [name, project] of Object.entries(variousProjects)) {
        addProjectConfiguration(tree, name, project as ProjectConfiguration);
        writeJson(
          tree,
          `${
            project.projectType === 'application' ? 'apps' : 'libs'
          }/${name}/tsconfig.json`,
          {}
        );
      }

      tree.write('libs/react-vite/vite.config.ts', 'export default {}');
      tree.write('apps/main-vite/vite.config.ts', 'export default {}');
      tree.write(
        'apps/main-vite-ts/vite.config.custom.ts',
        'export default {}'
      );
      tree.write('apps/reapp/vite.config.ts', 'export default {}');
      tree.write('apps/wv1/vite.config.custom.ts', 'export default {}');

      await configurationGenerator(tree, {
        name: 'reapp',
        tsConfiguration: false,
        storybook7UiFramework: '@storybook/react-vite',
      });
      await configurationGenerator(tree, {
        name: 'main-vite',
        tsConfiguration: false,
        storybook7UiFramework: '@storybook/react-vite',
      });
      await configurationGenerator(tree, {
        name: 'main-vite-ts',
        tsConfiguration: true,
        storybook7UiFramework: '@storybook/react-vite',
      });
      await configurationGenerator(tree, {
        name: 'main-webpack',
        storybook7UiFramework: '@storybook/react-webpack5',
      });
      await configurationGenerator(tree, {
        name: 'reappw',
        storybook7UiFramework: '@storybook/react-webpack5',
      });
      await configurationGenerator(tree, {
        name: 'react-rollup',
        storybook7UiFramework: '@storybook/react-webpack5',
      });

      await configurationGenerator(tree, {
        name: 'react-vite',
        storybook7UiFramework: '@storybook/react-vite',
      });

      await configurationGenerator(tree, {
        name: 'nextapp',
        storybook7UiFramework: '@storybook/nextjs',
      });

      await configurationGenerator(tree, {
        name: 'react-swc',
        storybook7UiFramework: '@storybook/react-webpack5',
      });

      await configurationGenerator(tree, {
        name: 'wv1',
        storybook7UiFramework: '@storybook/web-components-vite',
      });

      await configurationGenerator(tree, {
        name: 'ww1',
        storybook7UiFramework: '@storybook/web-components-webpack5',
      });
    });

    it('should have updated all their target configurations correctly', async () => {
      const projects = getProjects(tree);
      expect(projects).toMatchSnapshot();
    });

    test.each(testCases)(
      'should contain the correct configuration in %p',
      (storybookConfigPath) => {
        if (tree.exists(storybookConfigPath)) {
          if (tree.exists(`${storybookConfigPath}main.ts`)) {
            expect(
              tree.read(`${storybookConfigPath}main.ts`, 'utf-8')
            ).toMatchSnapshot();
          }
          if (tree.exists(`${storybookConfigPath}main.js`)) {
            expect(
              tree.read(`${storybookConfigPath}main.js`, 'utf-8')
            ).toMatchSnapshot();
          }
          expect(
            tree.read(`${storybookConfigPath}tsconfig.json`, 'utf-8')
          ).toMatchSnapshot();
        }
      }
    );
  });
});

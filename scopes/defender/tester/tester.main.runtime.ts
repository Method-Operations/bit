import fs from 'fs-extra';
import { CLIAspect, CLIMain, MainRuntime } from '@teambit/cli';
import { Component, IComponent } from '@teambit/component';
import compact from 'lodash.compact';
import { EnvsAspect, EnvsExecutionResult, EnvsMain } from '@teambit/envs';
import { LoggerAspect, LoggerMain } from '@teambit/logger';
import { Workspace, WorkspaceAspect } from '@teambit/workspace';
import { GraphqlAspect, GraphqlMain } from '@teambit/graphql';
import { BuilderAspect, BuilderMain } from '@teambit/builder';
import { UiMain, UIAspect } from '@teambit/ui';
import { merge } from 'lodash';
import DevFilesAspect, { DevFilesMain } from '@teambit/dev-files';
import { TestsResult } from '@teambit/tests-results';
import { ComponentsResults, CallbackFn, Tests } from './tester';
import { TestCmd } from './test.cmd';
import { TesterAspect } from './tester.aspect';
import { TesterService } from './tester.service';
import { TesterTask } from './tester.task';
import { detectTestFiles } from './utils';
import { testerSchema } from './tester.graphql';
import { testsResultsToJUnitFormat } from './utils/junit-generator';

export type TesterExtensionConfig = {
  /**
   * regex of the text environment.
   */
  testRegex: string;

  /**
   * determine whether to watch on start.
   */
  watchOnStart: boolean;
  patterns: string[];
};

export type TesterOptions = {
  /**
   * start the tester in watch mode.
   */
  watch: boolean;

  /**
   * start the tester in debug mode.
   */
  debug: boolean;

  /**
   * start the tester in debug mode.
   */
  ui?: boolean;

  /**
   * initiate the tester on given env.
   */
  env?: string;

  /**
   * generate JUnit files on the specified dir
   */
  junit?: string;

  /**
   * show code coverage
   */
  coverage?: boolean;

  callback?: CallbackFn;
};

export class TesterMain {
  static runtime = MainRuntime;
  static dependencies = [
    CLIAspect,
    EnvsAspect,
    WorkspaceAspect,
    LoggerAspect,
    GraphqlAspect,
    UIAspect,
    DevFilesAspect,
    BuilderAspect,
  ];

  constructor(
    private patterns: string[],
    /**
     * graphql extension.
     */
    private graphql: GraphqlMain,

    /**
     * envs extension.
     */
    private envs: EnvsMain,

    /**
     * workspace extension.
     */
    private workspace: Workspace,

    /**
     * tester service.
     */
    readonly service: TesterService,

    /**
     * build task.
     */
    readonly task: TesterTask,

    private devFiles: DevFilesMain,

    private builder: BuilderMain
  ) {}

  _testsResults: { [componentId: string]: ComponentsResults } | undefined[] = [];

  async test(components: Component[], opts?: TesterOptions): Promise<EnvsExecutionResult<Tests>> {
    const options = this.getOptions(opts);
    const envsRuntime = await this.envs.createEnvironment(components);
    if (opts?.env) {
      return envsRuntime.runEnv(opts.env, this.service, options);
    }
    const results = await envsRuntime.run(this.service, options);
    if (opts?.junit) {
      await this.generateJUnit(opts?.junit, results);
    }
    return results;
  }

  private async generateJUnit(filePath: string, testsResults: EnvsExecutionResult<Tests>) {
    const components = testsResults.results.map((envResult) => envResult.data?.components).flat();
    const jUnit = testsResultsToJUnitFormat(compact(components));
    await fs.outputFile(filePath, jUnit);
  }

  /**
   * watch all components for changes and test upon each.
   */
  async watch(components: Component[], opts?: TesterOptions) {
    const options = this.getOptions(opts);
    const envsRuntime = await this.envs.createEnvironment(components);
    if (opts?.env) {
      return envsRuntime.runEnv(opts.env, this.service, options);
    }

    this.service.onTestRunComplete((results) => {
      results.components.forEach((component) => {
        this._testsResults[component.componentId.toString()] = component;
      });
    });
    return envsRuntime.run(this.service, options);
  }

  async uiWatch() {
    const components = await this.workspace.list();
    return this.watch(components, { watch: true, debug: false, ui: true });
  }

  async getTestsResults(
    component: IComponent,
    idHasVersion = true
  ): Promise<{ testsResults?: TestsResult; loading: boolean } | undefined> {
    const entry = component.get(TesterAspect.id);
    const isModified = !idHasVersion && (await component.isModified());
    const data = this.builder.getDataByAspect(component, TesterAspect.id) as { tests: TestsResult };
    if ((entry || data) && !isModified) {
      return { testsResults: data?.tests || entry?.data.tests, loading: false };
    }
    return this.getTestsResultsFromState(component);
  }

  private getTestsResultsFromState(component: IComponent) {
    const tests = this._testsResults[component.id.toString()];
    return { testsResults: tests?.results, loading: tests?.loading || false };
  }

  /**
   * Get the tests patterns from the config. (used as default patterns in case the env does not provide them via getTestsDevPatterns)
   * @returns
   */
  getPatterns() {
    return this.patterns;
  }

  getComponentDevPatterns(component: Component) {
    const env = this.envs.calculateEnv(component).env;
    const componentPatterns: string[] = env.getTestsDevPatterns
      ? env.getTestsDevPatterns(component)
      : this.getPatterns();
    return { name: 'tests', pattern: componentPatterns };
  }

  getDevPatternToRegister() {
    return this.getComponentDevPatterns.bind(this);
  }

  /**
   * get all test files of a component.
   */
  getTestFiles(component: Component) {
    return detectTestFiles(component, this.devFiles);
  }

  private getOptions(options?: TesterOptions): TesterOptions {
    const defaults = {
      watch: false,
      debug: false,
    };

    return merge(defaults, options);
  }

  static defaultConfig = {
    /**
     * default test regex for which files tester to apply on.
     */
    patterns: ['**/*.spec.+(js|ts|jsx|tsx)', '**/*.test.+(js|ts|jsx|tsx)'],

    /**
     * determine whether to watch on start.
     */
    watchOnStart: false,
  };

  static async provider(
    [cli, envs, workspace, loggerAspect, graphql, ui, devFiles, builder]: [
      CLIMain,
      EnvsMain,
      Workspace,
      LoggerMain,
      GraphqlMain,
      UiMain,
      DevFilesMain,
      BuilderMain
    ],
    config: TesterExtensionConfig
  ) {
    const logger = loggerAspect.createLogger(TesterAspect.id);
    const testerService = new TesterService(workspace, logger, graphql.pubsub, devFiles);
    envs.registerService(testerService);
    const tester = new TesterMain(
      config.patterns,
      graphql,
      envs,
      workspace,
      testerService,
      new TesterTask(TesterAspect.id, devFiles),
      devFiles,
      builder
    );
    devFiles.registerDevPattern(tester.getDevPatternToRegister());

    if (workspace) {
      ui.registerOnStart(async () => {
        if (!config.watchOnStart) return undefined;
        await tester.uiWatch();
        return undefined;
      });
    }
    cli.register(new TestCmd(tester, workspace, logger));

    graphql.register(testerSchema(tester, graphql));

    return tester;
  }
}

TesterAspect.addRuntime(TesterMain);

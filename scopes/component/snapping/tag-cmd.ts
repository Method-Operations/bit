import chalk from 'chalk';
import { Command, CommandOptions } from '@teambit/cli';
import { TagResults, NOTHING_TO_TAG_MSG, AUTO_TAGGED_MSG } from '@teambit/legacy/dist/api/consumer/lib/tag';
import { DEFAULT_BIT_RELEASE_TYPE } from '@teambit/legacy/dist/constants';
import { IssuesClasses } from '@teambit/component-issues';
import { ReleaseType } from 'semver';
import { BitError } from '@teambit/bit-error';
import { Logger } from '@teambit/logger';
import { SnappingMain } from './snapping.main.runtime';
import { BasicTagParams } from './tag-model-component';

const RELEASE_TYPES = ['major', 'premajor', 'minor', 'preminor', 'patch', 'prepatch', 'prerelease'];

export class TagCmd implements Command {
  name = 'tag [component-patterns...]';
  group = 'development';
  description = 'create an immutable and exportable component snapshot, tagged with a release version.';
  extendedDescription = `if no patterns are provided, it will tag all new and modified components.
if patterns are entered, you can specify a version per pattern using "@" sign, e.g. bit tag foo@1.0.0 bar@minor baz@major`;
  arguments = [
    {
      name: 'component-patterns...',
      description:
        'a list of component names, IDs or patterns (separated by space). run "bit pattern --help" to get more data about patterns. By default, all modified are tagged.',
    },
  ];
  helpUrl = 'components/tags';
  alias = 't';
  loader = true;
  options = [
    ['m', 'message <message>', 'a log message describing latest changes'],
    ['', 'unmodified', 'include unmodified components (by default, only new and modified components are tagged)'],
    [
      '',
      'editor [editor]',
      'EXPERIMENTAL. open an editor to write a tag message for each component. optionally, specify the editor-name (defaults to vim).',
    ],
    ['v', 'ver <version>', 'tag with the given version'],
    ['l', 'increment <level>', `options are: [${RELEASE_TYPES.join(', ')}], default to patch`],
    ['', 'prerelease-id <id>', 'prerelease identifier (e.g. "dev" to get "1.0.0-dev.1")'],
    ['p', 'patch', 'syntactic sugar for "--increment patch"'],
    ['', 'minor', 'syntactic sugar for "--increment minor"'],
    ['', 'major', 'syntactic sugar for "--increment major"'],
    ['', 'pre-release [identifier]', 'syntactic sugar for "--increment prerelease" and `--prerelease-id <identifier>`'],
    ['', 'snapped', 'EXPERIMENTAL. tag components that their head is a snap (not a tag)'],
    ['', 'unmerged', 'EXPERIMENTAL. complete a merge process by tagging the unmerged components'],
    ['', 'skip-tests', 'skip running component tests during tag process'],
    ['', 'skip-auto-tag', 'skip auto tagging dependents'],
    ['', 'soft', 'do not persist. only keep note of the changes to be made'],
    ['', 'persist', 'persist the changes generated by --soft tag'],
    ['', 'disable-tag-pipeline', 'skip the tag pipeline to avoid publishing the components'],
    ['', 'force-deploy', 'run the tag pipeline although the build failed'],
    [
      '',
      'increment-by <number>',
      '(default to 1) increment semver flag (patch/minor/major) by. e.g. incrementing patch by 2: 0.0.1 -> 0.0.3.',
    ],
    [
      'i',
      'ignore-issues [issues]',
      `ignore component issues (shown in "bit status" as "issues found"), issues to ignore:
[${Object.keys(IssuesClasses).join(', ')}]
to ignore multiple issues, separate them by a comma and wrap with quotes. to ignore all issues, specify "*".`,
    ],
    ['I', 'ignore-newest-version', 'ignore existing of newer versions (default = false)'],
    ['b', 'build', 'EXPERIMENTAL. not needed for now. run the pipeline build and complete the tag'],
    [
      'a',
      'all [version]',
      'DEPRECATED (not needed anymore, it is the default now). tag all new and modified components',
    ],
    ['s', 'scope [version]', 'DEPRECATED (use "--unmodified" instead). tag all components of the current scope'],
    [
      'f',
      'force',
      'DEPRECATED (use "--skip-tests" or "--unmodified" instead). force-tag even if tests are failing and even when component has not changed',
    ],
    ['', 'disable-deploy-pipeline', 'DEPRECATED. use --disable-tag-pipeline instead'],
  ] as CommandOptions;
  migration = true;
  remoteOp = true; // In case a compiler / tester is not installed
  examples = [{ cmd: 'tag --ver 1.0.0', description: 'tag all components to version 1.0.0' }];

  constructor(private snapping: SnappingMain, private logger: Logger) {}

  // eslint-disable-next-line complexity
  async report(
    [patterns = []]: [string[]],
    {
      message = '',
      ver,
      all = false,
      editor = '',
      snapped = false,
      unmerged = false,
      patch,
      minor,
      major,
      preRelease,
      increment,
      prereleaseId,
      force = false,
      ignoreUnresolvedDependencies,
      ignoreIssues,
      ignoreNewestVersion = false,
      skipTests = false,
      skipAutoTag = false,
      scope,
      unmodified = false,
      build,
      soft = false,
      persist = false,
      disableDeployPipeline = false,
      disableTagPipeline = false,
      forceDeploy = false,
      incrementBy = 1,
    }: {
      all?: boolean | string;
      snapped?: boolean;
      unmerged?: boolean;
      ver?: string;
      force?: boolean;
      patch?: boolean;
      minor?: boolean;
      major?: boolean;
      increment?: ReleaseType;
      preRelease?: string;
      prereleaseId?: string;
      ignoreUnresolvedDependencies?: boolean;
      ignoreIssues?: string;
      scope?: string | boolean;
      incrementBy?: number;
      disableDeployPipeline?: boolean;
      disableTagPipeline?: boolean;
    } & Partial<BasicTagParams>
  ): Promise<string> {
    if (typeof ignoreUnresolvedDependencies === 'boolean') {
      throw new BitError(`--ignore-unresolved-dependencies has been removed, please use --ignore-issues instead`);
    }
    if (ignoreIssues && typeof ignoreIssues === 'boolean') {
      throw new BitError(`--ignore-issues expects issues to be ignored, please run "bit tag -h" for the issues list`);
    }
    if (disableDeployPipeline) {
      this.logger.consoleWarning(`--disable-deploy-pipeline is deprecated, please use --disable-tag-pipeline instead`);
    }
    if (!message && !persist) {
      this.logger.consoleWarning(
        `--message will be mandatory in the next few releases. make sure to add a message with your tag`
      );
    }
    if (all) {
      this.logger.consoleWarning(
        `--all is deprecated, please omit it. "bit tag" by default will tag all new and modified components. to specify a version, use --ver flag`
      );
      if (typeof all === 'string') {
        ver = all;
      }
    }
    if (scope) {
      this.logger.consoleWarning(`--scope is deprecated, use --unmodified instead`);
      unmodified = true;
      if (typeof scope === 'string') {
        ver = scope;
      }
    }
    if (force) {
      this.logger.consoleWarning(
        `--force is deprecated, use either --skip-tests or --unmodified depending on the use case`
      );
      if (patterns.length) unmodified = true;
    }
    if (prereleaseId && (!increment || increment === 'major' || increment === 'minor' || increment === 'patch')) {
      throw new BitError(
        `--prerelease-id should be entered along with --increment flag, while --increment must be one of the following: [prepatch, prerelease, preminor, premajor]`
      );
    }

    const releaseFlags = [patch, minor, major, preRelease].filter((x) => x);
    if (releaseFlags.length > 1) {
      throw new BitError('you can use only one of the following - patch, minor, major, pre-release');
    }

    const getReleaseType = (): ReleaseType => {
      if (increment) {
        if (!RELEASE_TYPES.includes(increment)) {
          throw new BitError(`invalid increment-level "${increment}".
  semver allows the following options only: ${RELEASE_TYPES.join(', ')}`);
        }
        return increment;
      }
      if (major) return 'major';
      if (minor) return 'minor';
      if (patch) return 'patch';
      if (preRelease) return 'prerelease';
      return DEFAULT_BIT_RELEASE_TYPE;
    };
    const getPreReleaseId = (): string | undefined => {
      if (prereleaseId) {
        return prereleaseId;
      }
      if (preRelease && typeof preRelease === 'string') {
        return preRelease;
      }
      return undefined;
    };

    const disableTagAndSnapPipelines = disableTagPipeline || disableDeployPipeline;

    const params = {
      ids: patterns,
      snapped,
      unmerged,
      editor,
      message,
      releaseType: getReleaseType(),
      preReleaseId: getPreReleaseId(),
      ignoreIssues,
      ignoreNewestVersion,
      skipTests,
      skipAutoTag,
      build,
      soft,
      persist,
      unmodified,
      disableTagAndSnapPipelines,
      forceDeploy,
      incrementBy,
      version: ver,
    };

    const results = await this.snapping.tag(params);
    if (!results) return chalk.yellow(NOTHING_TO_TAG_MSG);
    const { taggedComponents, autoTaggedResults, warnings, newComponents }: TagResults = results;
    const changedComponents = taggedComponents.filter((component) => !newComponents.searchWithoutVersion(component.id));
    const addedComponents = taggedComponents.filter((component) => newComponents.searchWithoutVersion(component.id));
    const autoTaggedCount = autoTaggedResults ? autoTaggedResults.length : 0;

    const warningsOutput = warnings && warnings.length ? `${chalk.yellow(warnings.join('\n'))}\n\n` : '';
    const tagExplanationPersist = `\n(use "bit export [collection]" to push these components to a remote")
(use "bit reset" to unstage versions)\n`;
    const tagExplanationSoft = `\n(use "bit tag --persist" to persist the changes")
(use "bit reset --soft" to remove the soft-tags)\n`;

    const tagExplanation = results.isSoftTag ? tagExplanationSoft : tagExplanationPersist;

    const outputComponents = (comps) => {
      return comps
        .map((component) => {
          let componentOutput = `     > ${component.id.toString()}`;
          const autoTag = autoTaggedResults.filter((result) =>
            result.triggeredBy.searchWithoutScopeAndVersion(component.id)
          );
          if (autoTag.length) {
            const autoTagComp = autoTag.map((a) => a.component.id.toString());
            componentOutput += `\n       ${AUTO_TAGGED_MSG}:
            ${autoTagComp.join('\n            ')}`;
          }
          return componentOutput;
        })
        .join('\n');
    };

    const publishOutput = () => {
      const { publishedPackages } = results;
      if (!publishedPackages || !publishedPackages.length) return '';
      const successTitle = `\n\n${chalk.green(
        `published the following ${publishedPackages.length} component(s) successfully\n`
      )}`;
      const successCompsStr = publishedPackages.join('\n');
      const successOutput = successCompsStr ? successTitle + successCompsStr : '';
      return successOutput;
    };

    const softTagPrefix = results.isSoftTag ? 'soft-tagged ' : '';
    const outputIfExists = (label, explanation, components) => {
      if (!components.length) return '';
      return `\n${chalk.underline(softTagPrefix + label)}\n(${explanation})\n${outputComponents(components)}\n`;
    };

    const newDesc = results.isSoftTag
      ? 'set to be tagged first version for components'
      : 'first version for components';
    const changedDesc = results.isSoftTag
      ? 'components that set to get a version bump'
      : 'components that got a version bump';
    const softTagClarification = results.isSoftTag
      ? chalk.bold(
          'keep in mind that this is a soft-tag (changes recorded to be tagged), to persist the changes use --persist flag'
        )
      : '';
    return (
      warningsOutput +
      chalk.green(
        `${taggedComponents.length + autoTaggedCount} component(s) ${results.isSoftTag ? 'soft-' : ''}tagged`
      ) +
      tagExplanation +
      outputIfExists('new components', newDesc, addedComponents) +
      outputIfExists('changed components', changedDesc, changedComponents) +
      publishOutput() +
      softTagClarification
    );
  }
}

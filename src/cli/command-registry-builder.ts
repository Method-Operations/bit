import { BIT_DESCRIPTION, BIT_USAGE, BIT_VERSION } from '../constants';
import CommandRegistry from './command-registry';
import Delete from './commands/private-cmds/_delete-cmd';
import _Fetch from './commands/private-cmds/_fetch-cmd';
import Action from './commands/private-cmds/_action-cmd';
import ScopeGraph from './commands/private-cmds/_graph-cmd';
import ScopeLanesList from './commands/private-cmds/_lanes-cmd';
import Latest from './commands/private-cmds/_latest-cmd';
import ScopeList from './commands/private-cmds/_list-cmd';
import ScopeLog from './commands/private-cmds/_log-cmd';
import Put from './commands/private-cmds/_put-cmd';
import DescribeScope from './commands/private-cmds/_scope-cmd';
import ScopeShow from './commands/private-cmds/_show-cmd';
import CatComponent from './commands/private-cmds/cat-component-cmd';
import { CatVersionHistoryCmd } from './commands/private-cmds/cat-version-history-cmd';
import CatLane from './commands/private-cmds/cat-lane-cmd';
import CatObject from './commands/private-cmds/cat-object-cmd';
import CatScope from './commands/private-cmds/cat-scope-cmd';
import DependencyStatus from './commands/private-cmds/dependency-status-cmd';
import Migrate from './commands/private-cmds/migrate-cmd';
import Config from './commands/public-cmds/config-cmd';
import Diff from './commands/public-cmds/diff-cmd';
import Doctor from './commands/public-cmds/doctor-cmd';
import Init from './commands/public-cmds/init-cmd';
import Dependents from './commands/public-cmds/dependents-cmd';
import Login from './commands/public-cmds/login-cmd';
import Logout from './commands/public-cmds/logout-cmd';
import Remote from './commands/public-cmds/remote-cmd';
import ScopeConfig from './commands/public-cmds/scope-config-cmd';
import Untag from './commands/public-cmds/untag-cmd';
import RunAction from './commands/private-cmds/run-action.cmd';

export default function registerCommands(): CommandRegistry {
  return new CommandRegistry(BIT_USAGE, BIT_DESCRIPTION, BIT_VERSION, [
    // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
    new Init(),
    new Config(),
    // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
    new Remote(),
    // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
    new CatObject(),
    // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
    new CatComponent(),
    new CatLane(),
    new Dependents(),
    new ScopeLog(),
    new Put(),
    new ScopeList(),
    new ScopeShow(),
    new ScopeGraph(),
    // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
    new _Fetch(),
    new Action(),
    new DescribeScope(),
    // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
    new CatScope(),
    new CatVersionHistoryCmd(),
    new ScopeConfig(),
    new DependencyStatus(),
    // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
    new Untag(),
    new Delete(),
    new Latest(),
    // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
    new Diff(),
    // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
    new Login(),
    new Logout(),
    // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
    new Migrate(),
    // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
    new Doctor(),
    new RunAction(),
    // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
    new ScopeLanesList(),
  ]);
}

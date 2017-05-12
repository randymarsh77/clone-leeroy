import argparse from 'argparse';

export default class Cli {
  function addOptionsFromCommandLineArguments(options) {
    const parser = new argparse.ArgumentParser({
      version,
      addHelp: true,
      description: 'Clones git repositories from a Leeroy configuration.'
    });

    const subparsers = parser.addSubparsers({
      title: 'subcommands',
      dest: 'command'
    });

    const commands = createCommands();
    commands.map(x => { x.initializeParsers(parser, subparsers); });

    const args = parser.parseArgs();
    commands.map(x => {
      if (x.name !== args.command) return;
      if (x.validateArgs) x.validateArgs(args);
      x.addOptions(args, options);
    });
  }

  function createCommands()
  {
    return [
      {
        name: 'clone',
        initializeParsers: (parser, subparsers) => {
          const cloneParser = subparsers.addParser('clone', {
            addHelp: true,
            help: `Clones a configuration. The configuration name will be saved to the local ${configFileName} file.  If the file exists, it will be overwritten.`
          });
          cloneParser.addArgument(['config'], {
            help: 'The Leeroy configuration name.'
          });
        },
        addOptions: (args, options) => {
          options.configName = args.config;
          options.save = true;
        }
      },
      {
        name: 'rollback',
        initializeParsers: (parser, subparsers) => {
          const rollbackParser = subparsers.addParser('rollback', {
            addHelp: true,
            help: 'Rollback all repositories in the configuration to a given tag, date, or revision.'
          });
          rollbackParser.addArgument(['-t', '--tag'], {
            help: 'For each repository in the configuration, checkout at the provided tag.  If the tag is missing, do nothing.'
          });
          rollbackParser.addArgument(['-d', '--date'], {
            help: 'For each repository in the configuration, checkout at the most recent revision before the given date.'
          });
          rollbackParser.addArgument(['-r', '--revision'], {
            help: 'Checkout the repository the revision is associated with to the revision. Checkout all other repositories to the date the commit was pushed.'
          });
          rollbackParser.addArgument(['--save-credentials'], {
            action: 'storeTrue',
            help: `Save credentials to the local ${configFileName} file.`
          });
        },
        validateArgs: args => {
          if (!args.tag && !args.date && !args.revision) throw new Error('Must provide one of --tag, --date, or --revision.');
          if (args.tag && args.date) throw new Error(`Can't provide both --tag and --date.`);
          if (args.tag && args.revision) throw new Error(`Can't provide both --tag and --revision.`);
          if (args.date && args.revision) throw new Error(`Can't provide both --date and --revision.`);
        },
        addOptions: (args, options) => {
          options.save = args.save_credentials;
          options.useTree = true;
          options.tag = args.tag;
          if (args.date)
          {
            const parseResult = Date.parse(args.date);
            if (!parseResult) throw new Error(`Invalid date specified: ${args.date}`);
            options.date = new Date(parseResult);
          }
          if (args.revision) options.revisionData = { revision: args.revision };
        }
      }
    ];
  }
}

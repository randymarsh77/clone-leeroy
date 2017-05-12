#!/usr/bin/env node
import http from 'q-io/http';
import fs from 'q-io/fs';
import { exec } from 'child_process';
import os from 'os';
import AppSettings from './appsettings';
import AuthUtility from './authutility';
import GitApi from './gitapi';
import Submodule from './submodule';
import Workspace from './workspace';

const configFileName = '.clonejs';

Promise.resolve(process.argv)
  .then(() => {
      return AppSettings.read();
  })
  .then(appSettings => {
    const context = AppContext.createWithAppSettings(appSettings);
    if (process.argv.length > 2 || !context.configName) context.parseCommandLineArgs(process.argv);

    console.log(`Getting remote configuration for '${context.configName}'`);
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    return fetchRemoteConfiguration(context.configName).then(config => {
      return [config, context];
    });
  })
  .then(([config, context]) => {
    return context.strategy.requiresAuth ?
      AuthUtility.promptForAuthentication()
        .then(auth => {
          context.auth = auth;
          return options;
      }) :
      options;
  })
  .then(options => {
    return options.save ?
      options.appSettings.save().then(() => { return options; }) :
      options;
  })
  .then(([config, auth, paradigm]) => {
    const repoName = config.repoUrl.match(/.*\/(.*)\.git/)[1];
    var gitApi = new GitApi('Build', repoName, auth);
    return options.useTree ?
      getTree(options).then(tree => { return options; }) :
      options;
  })
  .then(([config, gitApi, tree]) => {
    return Workspace.initialze().then(() => {
      return tree ?
        getSubmodulesFromTree(tree, gitApi).then(submodules => Promise.all(submodules.map(submodule => processSubmodule(submodule, options)))) :
        Promise.all(Object.keys(config.submodules).map(name => processSubmodule(createSubmoduleWithConfig(name, config), options)));
    });
  })
  .catch(error => {
    console.error('\x1b[31m' + (error.message || `Error: ${error}`) + '\x1b[0m');
    process.exitCode = 1;
  });

function fetchRemoteConfiguration(configName) {
  return http.read(`https://git/raw/Build/Configuration/master/${configName}.json`)
    .catch(() => {
      throw new Error(`Couldn't download Leeroy config file: ${configName}`);
    })
    .then(data => {
      const config = JSON.parse(data);
      if (!config.submodules) throw new Error(`Leeroy config file is missing 'submodules' configuration.`);
      return config;
    });
}

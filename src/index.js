#!/usr/bin/env node
import http from 'q-io/http';
import fs from 'fs';
import { exec } from 'child_process';

const gitPath = process.platform === 'darwin' ? 'git' : '"C:\\Program Files (x86)\\Git\\bin\\git.exe"';
const home = process.platform === 'darwin' ? process.env.HOME : process.env.HOMEDRIVE + process.env.HOMEPATH;

const configFileName = '.clonejs';

let [, , project, flag] = process.argv;

if (!project) {
  if (fs.existsSync(configFileName)) {
    const settings = JSON.parse(fs.readFileSync(configFileName, { encoding: 'utf-8' }).toString());
    project = settings.leeroyConfig;
  }
} else if (flag === '--save') {
  const settings = { leeroyConfig: project };
  fs.writeFileSync(configFileName, JSON.stringify(settings));
}

if (!project) {
  console.error('Usage: clone-leeroy CONFIGNAME [--save]');
  process.exit(1);
}

console.log('Getting ' + project);
http.request(`http://git/raw/Build/Configuration/master/${project}.json`)
  .then(res => {
    if (res.status !== 200) throw new Error(`Couldn't download Leeroy config file: ${project}`);
    return res.body.read();
  })
  .then(data => {
    const config = JSON.parse(data);
    if (!config.submodules) throw new Error(`Leeroy config file is missing 'submodules' configuration.`);
    return config;
  })
  .then(config => {
    createSolutionInfos();

    let promise = Promise.resolve();
    for (const next of Object.keys(config.submodules)) {
      promise = promise.then(() => {
        const branch = config.submodules[next];
        console.log(`Processing ${next}`);

        const [owner, repo] = next.split('/');
        const submodule = {
          owner,
          repo,
          branch,
          remoteUrl: `git@git:${owner}/${repo}.git`
        };

        if (!fs.existsSync(submodule.repo)) {
          return clone(submodule);
        } else {
          return checkRemote(submodule)
            .then(() => fetchOrigin(submodule))
            .then(() => checkBranch(submodule))
            .then(() => pull(submodule));
        }
      });
    }
    return promise;
  })
  .catch(error => {
    console.error(error.message || `Error: ${error}`);
    process.exit(1);
  });

function createSolutionInfos() {
  const solutionInfos = [{
    name: 'SolutionInfo.cs',
    data: `using System.Reflection;

[assembly: AssemblyVersion("9.99.0.0")]
[assembly: AssemblyCompany("Faithlife")]
[assembly: AssemblyCopyright("Copyright 2015 Faithlife")]
[assembly: AssemblyDescription("Local Build")]
`
  },
  {
    name: 'SolutionInfo.h',
    data: `#pragma once

#define ASSEMBLY_VERSION_MAJOR 9
#define ASSEMBLY_VERSION_MINOR 99
#define ASSEMBLY_VERSION_BUILD 0
#define ASSEMBLY_VERSION_MAJOR_MINOR_BUILD 1337
#define ASSEMBLY_VERSION_REVISION 0
#define ASSEMBLY_VERSION_STRING "9.99.0.0"

#define ASSEMBLY_COMPANY "Faithlife"
#define ASSEMBLY_COPYRIGHT "Copyright 2015 Faithlife"
`
  }];

  for (const info of solutionInfos) {
    if (!fs.existsSync(info.name)) {
      fs.writeFileSync(info.name, info.data);
    }
  }
}

function clone(submodule) {
  console.log(`  Directory ${submodule.repo} does not exist; cloning it.`);
  return exec_git(`clone --recursive --branch ${submodule.branch} ${submodule.remoteUrl}`, {});
}

function checkRemote(submodule) {
  return exec_git('config --get remote.origin.url', { cwd: submodule.repo })
    .then(currentRemoteUrl => {
      if (currentRemoteUrl !== submodule.remoteUrl) {
        console.log(`  Changing origin URL from ${currentRemoteUrl} to ${submodule.remoteUrl}`);
        return changeRemoteUrl(submodule);
      }
    });
}

function changeRemoteUrl(submodule) {
  return exec_git('remote rm origin', { cwd: submodule.repo })
    .then(() => exec_git(`remote add origin ${submodule.remoteUrl}`, { cwd: submodule.repo }));
}

function fetchOrigin(submodule) {
  console.log('  Fetching commits from origin...');
  return exec_git('fetch origin', { cwd: submodule.repo });
}

function checkBranch(submodule) {
  return exec_git('symbolic-ref --short -q HEAD', { cwd: submodule.repo })
    .then(currentBranch => {
      if (currentBranch !== submodule.branch) {
        console.log(`  Switching branches from ${currentBranch} to ${submodule.branch}`);
        return exec_git(`branch --list -q --no-color ${submodule.branch}`, { cwd: submodule.repo })
          .then(existingTargetBranch => {
            if (existingTargetBranch !== submodule.branch) {
              return exec_git(`checkout -B ${submodule.branch} --track origin/${submodule.branch}`, { cwd: submodule.repo });
            } else {
              return exec_git(`checkout ${submodule.branch}`, { cwd: submodule.repo });
            }
          });
        }
      });
}

function pull(submodule) {
  return exec_git(`pull --rebase origin ${submodule.branch}`, { cwd: submodule.repo })
    .then(pullOutput => Promise.all([pullOutput, exec_git('submodule update --init --recursive', { cwd: submodule.repo })]))
    .then(([pullOutput]) => {
        console.log(`  ${pullOutput}`);
      });
}

function exec_git(args, options) {
  options.env = options.env || {};
  options.env.HOME = home;

  // Might be necessary on Mac OS X to set SSH_AUTH_SOCK if user
  // has configured SSH Agent Forwarding
  // See https://help.github.com/articles/using-ssh-agent-forwarding
  options.env.SSH_AUTH_SOCK = process.env.SSH_AUTH_SOCK;
  return new Promise((resolve, reject) => {
    exec(`${gitPath} ${args}`, options, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.toString().trim());
      }
    });
  });
}

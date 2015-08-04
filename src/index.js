#!/usr/bin/env node
import http from 'http';
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
http.get(`http://git/raw/Build/Configuration/master/${project}.json`, res => {
  if (res.statusCode !== 200) {
    console.error(`Couldn't download Leeroy config file: ${project}`);
    process.exit(1);
  }

  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const config = JSON.parse(data);
    if (!config.submodules) {
      console.error(`Leeroy config file is missing 'submodules' configuration.`);
      process.exit(1);
    }

    createSolutionInfos();
    processNext(config.submodules);
  });
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

function processNext(submodules) {
  const [next] = Object.keys(submodules);
  if (!next) {
    process.exit(0);
  }

  const branch = submodules[next];
  delete submodules[next];
  console.log(`Processing ${next}`);

  const [owner, repo] = next.split('/');
  const submodule = {
    owner,
    repo,
    branch,
    remoteUrl: `git@git:${owner}/${repo}.git`
  };

  if (!fs.existsSync(submodule.repo)) {
    clone(submodules, submodule);
  } else {
    checkRemote(submodules, submodule);
  }
}

function clone(submodules, submodule) {
  console.log(`  Directory ${submodule.repo} does not exist; cloning it.`);
  exec_git(`clone --recursive --branch ${submodule.branch} ${submodule.remoteUrl}`, {}, () => {
    processNext(submodules);
  });
}

function checkRemote(submodules, submodule) {
  exec_git('config --get remote.origin.url', { cwd: submodule.repo }, stdout => {
    const currentRemoteUrl = stdout.toString().trim();
    if (currentRemoteUrl !== submodule.remoteUrl) {
      console.log(`  Changing origin URL from ${currentRemoteUrl} to ${submodule.remoteUrl}`);
      changeRemoteUrl(submodules, submodule);
    } else {
      fetchOrigin(submodules, submodule);
    }
  });
}

function changeRemoteUrl(submodules, submodule) {
  exec_git('remote rm origin', { cwd: submodule.repo }, () => {
    exec_git(`remote add origin ${submodule.remoteUrl}`, { cwd: submodule.repo }, () => {
      fetchOrigin(submodules, submodule);
    });
  });
}

function fetchOrigin(submodules, submodule) {
  console.log('  Fetching commits from origin...');
  exec_git('fetch origin', { cwd: submodule.repo }, () => {
    checkBranch(submodules, submodule);
  });
}

function checkBranch(submodules, submodule) {
  exec_git('symbolic-ref --short -q HEAD', { cwd: submodule.repo }, stdout => {
    const currentBranch = stdout.toString().trim();
    if (currentBranch !== submodule.branch) {
      console.log(`  Switching branches from ${currentBranch} to ${submodule.branch}`);
      exec_git(`branch --list -q --no-color ${submodule.branch}`, { cwd: submodule.repo }, stdout => {
        const existingTargetBranch = stdout.toString().trim();
        if (existingTargetBranch !== submodule.branch) {
          exec_git(`checkout -B ${submodule.branch} --track origin/${submodule.branch}`, { cwd: submodule.repo }, () => {
            pull(submodules, submodule);
          });
        } else {
          exec_git(`checkout ${submodule.branch}`, { cwd: submodule.repo }, () => {
            pull(submodules, submodule);
          });
        }
      });
    } else {
      pull(submodules, submodule);
    }
  });
}

function pull(submodules, submodule) {
  exec_git(`pull --rebase origin ${submodule.branch}`, { cwd: submodule.repo }, stdout => {
    const pullOutput = stdout.toString().trim();
    exec_git('submodule update --init --recursive', { cwd: submodule.repo }, () => {
      console.log(`  ${pullOutput}`);
      processNext(submodules);
    });
  });
}

function exec_git(args, options, callback) {
  options.env = options.env || {};
  options.env.HOME = home;

  // Might be necessary on Mac OS X to set SSH_AUTH_SOCK if user
  // has configured SSH Agent Forwarding
  // See https://help.github.com/articles/using-ssh-agent-forwarding
  options.env.SSH_AUTH_SOCK = process.env.SSH_AUTH_SOCK;

  exec(`${gitPath} ${args}`, options, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing "git ${args}": ${error}`);
      process.exit(1);
    } else {
      callback(stdout, stderr);
    }
  });
}

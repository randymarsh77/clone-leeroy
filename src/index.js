#!/usr/bin/env node
var http = require('http');
var fs = require('fs');
var child_process = require("child_process");
var exec = child_process.exec;

var gitPath = process.platform == 'darwin' ? 'git' : '"C:\\Program Files (x86)\\Git\\bin\\git.exe"';
var home = process.platform == 'darwin' ? process.env.HOME : process.env.HOMEDRIVE + process.env.HOMEPATH;
var configFileName = '.clonejs';

var args = process.argv.slice(2);
var project = args[0];
if (!project) {
    if (fs.existsSync(configFileName)) {
        var settings = JSON.parse(fs.readFileSync(configFileName, { encoding: 'utf-8' }).toString());
        project = settings.leeroyConfig;
    }
} else if (args[1] === '--save') {
    createConfigFile(project);
}

if (!project) {
    console.error('Usage: clone-leeroy CONFIGNAME [--save]');
    process.exit(1);
}

console.log('Getting ' + project);
http.get('http://git/raw/Build/Configuration/master/' + project + '.json', function (res) {
    if (res.statusCode != 200) {
        console.error("Couldn't download Leeroy config file:" + project);
        process.exit(1);
    }

    var data = '';
    res.on('data', function (chunk) {
        return data += chunk;
    });
    res.on('end', function () {
        var config = JSON.parse(data);
        var submodules = config.submodules;
        if (!submodules) {
            console.error("Leeroy config file is missing 'submodules' configuration.");
            process.exit(1);
        }
        createSolutionInfos();
        processNext(submodules);
    });
});

function createSolutionInfos() {
    var solutionInfos = [
        {
            name: 'SolutionInfo.cs',
            data: 'using System.Reflection;\n' + '\n' + '[assembly: AssemblyVersion("9.99.0.0")]\n' + '[assembly: AssemblyCompany("Faithlife")]\n' + '[assembly: AssemblyCopyright("Copyright 2015 Faithlife")]\n' + '[assembly: AssemblyDescription("Local Build")]\n'
        },
        {
            name: 'SolutionInfo.h',
            data: '#pragma once\n' + '\n' + '#define ASSEMBLY_VERSION_MAJOR 9\n' + '#define ASSEMBLY_VERSION_MINOR 99\n' + '#define ASSEMBLY_VERSION_BUILD 0\n' + '#define ASSEMBLY_VERSION_MAJOR_MINOR_BUILD 1337\n' + '#define ASSEMBLY_VERSION_REVISION 0\n' + '#define ASSEMBLY_VERSION_STRING "9.99.0.0"\n' + '\n' + '#define ASSEMBLY_COMPANY "Logos Bible Software"\n' + '#define ASSEMBLY_COPYRIGHT "Copyright 2014 Logos Bible Software"\n'
        }
    ];

    solutionInfos.forEach(function (info) {
        if (!fs.existsSync(info.name))
            fs.writeFileSync(info.name, info.data);
    });
}

function createConfigFile(project) {
    var settings = { leeroyConfig: project };
    fs.writeFileSync(configFileName, JSON.stringify(settings));
}

function processNext(submodules) {
    var submoduleName = getFirstKey(submodules);
    if (!submoduleName)
        process.exit(0);

    var branch = submodules[submoduleName];
    delete submodules[submoduleName];
    console.log('Processing ' + submoduleName);

    var parts = submoduleName.split('/');
    var submodule = {
        owner: parts[0],
        repo: parts[1],
        branch: branch,
        remoteUrl: ''
    };
    submodule.remoteUrl = 'git@git:' + submodule.owner + '/' + submodule.repo + '.git';

    if (!fs.existsSync(submodule.repo)) {
        clone(submodules, submodule);
    } else {
        checkRemote(submodules, submodule);
    }
}

function clone(submodules, submodule) {
    console.log('  Directory ' + submodule.repo + ' does not exist; cloning it.');
    exec_git('clone --recursive --branch ' + submodule.branch + ' ' + submodule.remoteUrl, {}, function (stdout, stderr) {
        processNext(submodules);
    });
}

function checkRemote(submodules, submodule) {
    exec_git('config --get remote.origin.url', { cwd: submodule.repo }, function (stdout, stderr) {
        var currentRemoteUrl = stdout.toString().trim();
        if (currentRemoteUrl != submodule.remoteUrl) {
            console.log('  Changing origin URL from ' + currentRemoteUrl + ' to ' + submodule.remoteUrl);
            changeRemoteUrl(submodules, submodule);
        } else {
            fetchOrigin(submodules, submodule);
        }
    });
}

function changeRemoteUrl(submodules, submodule) {
    exec_git('remote rm origin', { cwd: submodule.repo }, function (stdout, stderr) {
        exec_git('remote add origin ' + submodule.remoteUrl, { cwd: submodule.repo }, function (stdout, stderr) {
            fetchOrigin(submodules, submodule);
        });
    });
}

function fetchOrigin(submodules, submodule) {
    console.log('  Fetching commits from origin...');
    exec_git('fetch origin', { cwd: submodule.repo }, function (stdout, stderr) {
        checkBranch(submodules, submodule);
    });
}

function checkBranch(submodules, submodule) {
    exec_git('symbolic-ref --short -q HEAD', { cwd: submodule.repo }, function (stdout, stderr) {
        var currentBranch = stdout.toString().trim();
        if (currentBranch != submodule.branch) {
            console.log('  Switching branches from ' + currentBranch + ' to ' + submodule.branch);
            exec_git('branch --list -q --no-color ' + submodule.branch, { cwd: submodule.repo }, function (stdout, stderr) {
                var existingTargetBranch = stdout.toString().trim();
                if (existingTargetBranch != submodule.branch) {
                    exec_git('checkout -B ' + submodule.branch + ' --track origin/' + submodule.branch, { cwd: submodule.repo }, function (stdout, stderr) {
                        pull(submodules, submodule);
                    });
                } else {
                    exec_git('checkout ' + submodule.branch, { cwd: submodule.repo }, function (stdout, stderr) {
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
    exec_git('pull --rebase origin ' + submodule.branch, { cwd: submodule.repo }, function (stdout, stderr) {
        var pullOutput = stdout.toString().trim();
        exec_git('submodule update --init --recursive', { cwd: submodule.repo }, function (stdout, stderr) {
            console.log('  ' + pullOutput);
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

    exec(gitPath + ' ' + args, options, function (error, stdout, stderr) {
        if (error !== null) {
            console.error('Error executing "git ' + args + '": ' + error);
            process.exit(1);
        } else {
            callback(stdout, stderr);
        }
    });
}

function getFirstKey(data) {
    for (var prop in data)
        return prop;
}

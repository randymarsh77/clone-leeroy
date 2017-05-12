

export default class SubmoduleUtility {
  function createSubmoduleWithConfig(name, config) {
    const branch = config.submodules[name];
    const [owner, repo] = name.split('/');
    const submodule = new Submodule(owner, repo, `git@git:${owner}/${repo}.git`);
    submodule.branch = branch;
    return submodule;
  }

  function createSubmoduleWithTree(submoduleData, tree) {
    const [treeData] = tree.filter(x => x.path === submoduleData.name);
    const [owner, repo] = submoduleData.remoteUrl.slice("git@git:".length, submoduleData.remoteUrl.length - 4).split('/');
    const submodule = new Submodule(owner, repo, submoduleData.remoteUrl);
    submodule.revision = treeData.sha;
    return submodule;
  }

  function processSubmodule(submodule, options) {
    submodule.log(`Processing ${submodule.owner}/${submodule.repo}`);
    return fs.exists(submodule.repo)
      .then(exists =>
        (!exists ?
          clone(submodule) :
          checkRemote(submodule)
            .then(() => fetchOrigin(submodule))
            .then(() => { if (submodule.branch) checkBranch(submodule); }))
        .then(() => pull(submodule, options))
      )
      .then(wasProcessed => {
        if (wasProcessed) console.log(submodule.output());
        return !wasProcessed ? submodule : null;
      }).catch(error => {
          submodule.log(error.message || error, 2);
          return Promise.reject(submodule.output());
      });
  }

  function clone(submodule) {
    submodule.log(`Directory ${submodule.repo} does not exist; cloning it.`, 2);
    return exec_git(`clone --recursive --branch ${submodule.branch} ${submodule.remoteUrl}`, {});
  }

  function checkRemote(submodule) {
    return exec_git('config --get remote.origin.url', { cwd: submodule.repo })
      .then(currentRemoteUrl => {
        if (currentRemoteUrl !== submodule.remoteUrl) {
          submodule.log(`Changing origin URL from ${currentRemoteUrl} to ${submodule.remoteUrl}`, 2);
          return changeRemoteUrl(submodule);
        }
      });
  }

  function changeRemoteUrl(submodule) {
    return exec_git('remote rm origin', { cwd: submodule.repo })
      .then(() => exec_git(`remote add origin ${submodule.remoteUrl}`, { cwd: submodule.repo }));
  }

  function fetchOrigin(submodule) {
    submodule.log('Fetching commits from origin...', 2);
    return exec_git('fetch origin', { cwd: submodule.repo });
  }

  function checkBranch(submodule) {
    return exec_git('status', { cwd: submodule.repo })
      .then(statusOutput => {
        const detachedHead = statusOutput.length > 13 && statusOutput.substring(0, 13) === "HEAD detached";
        return detachedHead ?
          Promise.resolve('Detached HEAD') :
          exec_git('symbolic-ref --short -q HEAD', { cwd: submodule.repo });
        })
      .then(currentBranch => {
        if (currentBranch !== submodule.branch) {
          submodule.log(`Switching branches from ${currentBranch} to ${submodule.branch}`, 2);
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

  function pull(submodule, options) {
    const pullAction = submodule.revision ? pullExactRevision(submodule, submodule.revision) :
      options.revisionData && !options.revisionData.date ? pullByRevision(submodule, options) :
      options.date ? pullByDate(submodule, options.date) :
      options.tag ? pullByTag(submodule, options.tag) :
      exec_git(`pull --rebase origin ${submodule.branch}`, { cwd: submodule.repo }).then(output => { return { output, success: true }; });
    return pullAction
      .then(result => {
        return result.success ?
          Promise.all([result, exec_git('submodule update --init --recursive', { cwd: submodule.repo })]) :
          [result];
      })
      .then(([result]) => {
        submodule.log(`${result.output}`, 2);
        return result.success;
      });
  }

  function pullExactRevision(submodule, revision) {
    return Promise.all([`Checked out ${revision}`, exec_git(`checkout ${revision}`, { cwd: submodule.repo })])
      .then(output => { return { output, success: true }; });
  }

  function pullByTag(submodule, tag) {
    return exec_git('tag -l', { cwd: submodule.repo })
      .then(tagOutput => {
        const hasTag = tag && tagOutput.split(/\r?\n/).indexOf(tag) >= 0;
        if (hasTag) {
          return exec_git(`checkout ${tag}`, { cwd: submodule.repo })
            .then(() => `Checked out ${tag}.`);
        } else {
          submodule.log(`Tag (${tag}) does not exist. Falling back to pull --rebase.`, 2);
          return exec_git(`pull --rebase origin ${submodule.branch}`, { cwd: submodule.repo });
        }
      })
      .then(output => { return { output, success: true }; });
  }

  function pullByDate(submodule, date) {
    const dateString = date.toISOString();
    return exec_git(`rev-list -n 1 --before="${dateString}" origin/${submodule.branch}`, { cwd: submodule.repo })
      .then(revision => {
        if (!revision) throw new Error(`Invalid date: ${dateString} for ${submodule.rep}/${submodule.branch}`);
        return Promise.all([`Checked out ${revision} [by date].`, exec_git(`checkout ${revision}`, { cwd: submodule.repo })]);
      })
      .then(([output]) => { return { output, success: true }; });
  }

  function pullByRevision(submodule, options) {
    const revision = options.revisionData.revision;
    return exec_git(`show ${revision} --no-patch --pretty=format:%cd`, { cwd: submodule.repo })
      .then(date => {
          options.date = new Date(date);
          options.revisionData.date = options.date;
          return Promise.all([`Checked out ${revision}. Keying off of ${date}.`, exec_git(`checkout ${revision}`, { cwd: submodule.repo })])
            .then(output => { return { output, success: true }; });
      })
      .catch(() => { return { output: `Failed to find ${options.revisionData.revision}`, success: false }; });
  }
}

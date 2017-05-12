import Git from './git';
import GitApi from './gitapi';
import Submodule from './submodule';

function getTreeShaWithTag(gitApi, tag) {
  return gitApi.getTag(tag)
    .then(tagResult => tagResult.object.sha);
}

export default class GitApiUtility {

  static getTree(options) {
    return getTreeSha(options)
      .then(sha => options.gitApi.getTree(sha))
      .then(treeResult => {
        options.tree = treeResult.tree;
        return options;
      });
  }

  private static getTreeShaWithDate(gitApi, date) {
    return findNearbyCommits(gitApi, date)
      .then(commits => {
        let bestMatch = null;
        let bestDelta = Number.MAX_VALUE;
        for (let i = 0; i < commits.length; i++) {
          const delta = Date.parse(commits[i].commit.committer.date) - date;
          if (Math.abs(delta) < Math.abs(bestDelta) && delta <= 0) {
            bestMatch = commits[i].commit.tree.sha;
            bestDelta = delta;
          }
        }
        console.log(`Best date found is ${new Date(date - Math.abs(bestDelta)).toUTCString()}`);
        return bestMatch;
      });
  }

  private static getTreeShaWithRevision(gitApi, submodules, revision) {
    return gitApi.getTree(revision)
      .then(() => {
        console.log(`Found tree with revision ${revision}`);
        return revision;
      })
      .catch(() => {
        return gitApi.getCommit(revision)
          .then(commit => {
            console.log(`Found commit with revision ${revision}`);
            return commit.commit.tree.sha;
          })
          .catch(() => {
            Promise.all(submodules.map(x => findRevision(x, revision)))
              .then(results => {
                if (results && results.length === 1) {
                  console.log(`Found revision in ${results[0].submodule.repo}`);
                  return getTreeShaWithDateAndRevision(gitApi, results[0].date, results[0].submodule.repo, revision);
                } else {
                  throw new Error(`Couldn't find revision ${revision}`);
                }
              });
          });
      });
  }

  private static findNearbyCommits(gitApi, date, deltaIndex=0) {
    const deltas = [
      { delta: 1000 * 60, label: '1 minute' },
      { delta: 1000 * 60 * 60, label: '1 hour' },
      { delta: 1000 * 60 * 60 * 24, label: '1 day' },
      { delta: 1000 * 60 * 60 * 24 * 7, label: '1 week' }
    ];
    if (deltaIndex < 0 || deltaIndex >= deltas.length) return Promise.resolve([]);
    const delta = deltas[deltaIndex];
    console.log(`Searching for commits near ${date} using a delta of ${delta.label}`);
    return gitApi.getCommitsWithDateRange(new Date(date - delta.delta), new Date(date + delta.delta))
      .then(commits => {
        return commits && commits.length > 0 ?
          commits :
          findNearbyCommits(gitApi, date, deltaIndex + 1);
      });
  }

  private static findRevision(submodule, revision) {
    return Git.exec(`show ${revision} --no-patch --pretty=format:%cd`, { cwd: submodule.repo })
      .then(dateString => new Date(dateString))
      .catch(() => {});
  }

  function getTreeShaWithDateAndRevision(gitApi, date, repo, revision) {
    return findNearbyCommits(gitApi, date)
      .then(commits => {
        return revision !== null ? commits[0].commit.tree.sha : null;
      });
  }

  private static getSubmodulesFromTree(tree, gitApi) {
    const [gitModules] = tree.filter(x => x.path ==='.gitmodules');
    return gitApi.getBlob(gitModules.sha)
      .then(result => {
        const content = new Buffer(result.content, result.encoding).toString('ascii');
        return parseGitModules(content).map(submoduleData => createSubmoduleWithTree(submoduleData, tree));
      });
  }

  private static parseGitModules(content)
  {
    const submodules = [];
    const re = /\[submodule "([^"]+)"\][^\[]+url = ([^\[\s]+)/g;
    let match = re.exec(content);
    while (match) {
      submodules.push({
        name: match[1],
        remoteUrl: match[2]
      });
      match = re.exec(content);
    }
    return submodules;
  }
}

import fs from 'q-io/fs';

const gitPath = process.platform === 'darwin' ? Promise.resolve('git') :
  fs.exists('C:\\Program Files\\Git\\bin\\git.exe')
    .then(x => x ? '"C:\\Program Files\\Git\\bin\\git.exe"' : '"C:\\Program Files (x86)\\Git\\bin\\git.exe"');
const home = process.platform === 'darwin' ? process.env.HOME : process.env.HOMEDRIVE + process.env.HOMEPATH;

export default class Git {
  static exec(args, options) {
    options.env = options.env || {};
    options.env.HOME = home;

    // Might be necessary on Mac OSX to set SSH_AUTH_SOCK if user
    // has configured SSH Agent Forwarding
    // See https://help.github.com/articles/using-ssh-agent-forwarding
    options.env.SSH_AUTH_SOCK = process.env.SSH_AUTH_SOCK;
    return gitPath.then(path =>
      new Promise((resolve, reject) => {
        exec(`${path} ${args}`, options, (error, stdout) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout.toString().trim());
          }
        });
    }));
  }
}

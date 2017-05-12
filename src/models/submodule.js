export default class Submodule {
  constructor(owner, repo, remoteUrl) {
    this._logs = [];
    this.owner = owner;
    this.repo = repo;
    this.remoteUrl = remoteUrl;
  }

  log(message, indent=0) {
    this._logs = this._logs.concat(message.split(/\r?\n/).map((line) => { return Array(indent + 1).join(' ') + line; }));
  }

  output() {
    return this._logs.join(os.EOL);
  }
}

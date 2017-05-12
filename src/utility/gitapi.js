import http from 'q-io/http';

export default class GitApi {
  constructor(owner, repo, auth) {
    this.baseUri = `https://git/api/v3/repos/${owner}/${repo}`;
    this.auth = auth;
  }

  getTag(tag) {
    return this.getRequest(`/git/refs/tags/${tag}`, `Couldn't retrieve tag: ${tag}`);
  }

  getTree(sha) {
    return this.getRequest(`/git/trees/${sha}`, `Couldn't retrieve tree: ${sha}`);
  }

  getBlob(sha) {
    return this.getRequest(`/git/blobs/${sha}`, `Couldn't retrieve blob: ${sha}`);
  }

  getCommitsWithDateRange(since, until) {
    return this.getRequest(`/commits?since=${encodeURIComponent(since.toISOString())}&until=${encodeURIComponent(until.toISOString())}`, `Couldn't retrieve commits in range [${since} - ${until}]`);
  }

  getRequest(uri, onErrorMessage) {
    const url = `${this.baseUri}${uri}`;
    return http.read({
      url,
      headers: { 'Authorization': `Basic ${this.auth}` }
    })
    .then(data => {
      return JSON.parse(data);
    })
    .catch((error) => {
      throw new Error(`${onErrorMessage}${os.EOL}  Failed to retrieve: ${url}${os.EOL}  Reason: ${error}`);
    });
  }
}

import readline from 'readline';

export default class AuthUtility {
  static promptForAuthentication() {
    const rl = readline.createInterface(process.stdin, process.stdout);

    const hideInput = (query, callback) => {
      const stdin = process.openStdin();
      process.stdin.on("data", c => {
        const char = c + "";
        switch (char) {
            case "\n":
            case "\r":
            case "\u0004":
                stdin.pause();
                break;
            default:
                process.stdout.write(`\u001B[2K\u001B[200D${query}${Array(rl.line.length+1).join("*")}`);
                break;
        }
      });
      rl.question(query, value => {
          rl.history = rl.history.slice(1);
          callback(value);
      });
    };

    return new Promise((resolve, reject) => {
      console.log(`Operation requires Git authentication...`);
      rl.question('Username> ', username => {
        if (!username || username.length === 0) reject('Must enter a username.');
        hideInput('Password> ', password => {
          if (!password || password.length === 0) reject('Must enter a password.');
          resolve(new Buffer(`${username}:${password}`).toString('base64'));
        });
      });
    });
  }
}

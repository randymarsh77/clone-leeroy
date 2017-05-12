import fs from 'q-io/fs';

export default class AppSettings {
  static read() {
    return fs.read(configFileName)
      .then(content => {
        const settings = JSON.parse(content);
        const configName = settings.leeroyConfig;
        const auth = settings.authorization;
        return new AppSettings(configName, auth);
      })
      .catch(() => { return {}; });
  }

  constructor(leeroyConfigName, authorization) {
    this.configName = leeroyConfigName;
    this.auth = authorization;
  }

  save() {
    const settings = { leeroyConfig: this.configName };
    if (options.auth) settings.authorization = this.auth;
    return fs.write(configFileName, JSON.stringify(settings));
  }
}

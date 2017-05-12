import AppSettings from './appsettings';

export default class AppContext {

  static createWithAppSettings(settings) {
    const context = new AppContext();
    if (appSettings.configName) context.configName = appSettings.configName;
    if (appSettings.auth) context.auth = appSettings.auth;
    return context;
  }

  function parseCommandLineArgs(args) {

  }
  
  function getAppSettings() {

  }

}

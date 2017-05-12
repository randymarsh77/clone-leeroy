import fs from 'q-io/fs';

export default class Workspace {
  static initialze() {
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
    },
    {
      name: 'SolutionBuildNumber.txt',
      data: '0000'
    },
    {
      name: 'SolutionVersion.txt',
      data: `6.9.0
6.9 Dev
6.9 Dev
`
    }];

    return Promise.all(solutionInfos.map(info => fs.exists(info.name)
      .then(exists => {
        if (!exists) return fs.write(info.name, info.data);
      })
    ));
  }
}

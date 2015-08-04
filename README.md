# clone-leeroy

Clones repositories specified in a [Leeroy](https://github.com/LogosBible/Leeroy) configuration file.

[![npm package](https://img.shields.io/npm/v/clone-leeroy.svg?style=flat-square)](https://www.npmjs.org/package/clone-leeroy)

## Install

Run `npm install -g clone-leeroy`.

## Use

In the parent folder for the repositories, run `clone-leeroy CONFIG-NAME`.

To remember the Leeroy configuration for this folder, create a
`.clonejs` file with the following contents:

```
{
  "leeroyConfig": "CONFIG-NAME"
}
```

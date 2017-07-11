# Contributing Guide
The instructions below will help you set up your development environment to contribute to this project.

## Ways to Contribute
Interested in contributing to the vsts-device-flow-auth project? There are plenty of ways to contribute, all of which help make the project better.
* Submit a [bug report](https://github.com/Microsoft/vsts-device-flow-auth/issues/new) or [feature request](https://github.com/Microsoft/vsts-device-flow-auth/issues/new) through the Issue Tracker
* Review the [source code changes](https://github.com/Microsoft/vsts-device-flow-auth/pulls)
* Submit a code fix for a bug (see `Submitting Pull Requests` below)
* Participate in [discussions](https://github.com/Microsoft/vsts-device-flow-auth/issues)

## Set up Node, npm and gulp

### Node and npm
**Windows and Mac OSX**: Download and install node from [nodejs.org](http://nodejs.org/)

**Linux**: Install [using package manager](https://nodejs.org/en/download/package-manager/)

### Gulp
Install gulp
```bash
[sudo] npm install gulp -g
```
From the root of the repo, install all of the project dependencies:
```bash
[sudo] npm install
```

## Build
To build the project, simply run the following from the root of the repo:

```bash
gulp
```
This command will create the `out\src` and `out\test-integration` folders at the root of the repository. 

## Test
There is a single integration test built to `out\test-integration` you can run to ensure your changes still allow the library to authenticate and create
the personal access token on the user's behalf.  You will, of course, need to update the test source code to provide your own Team Services account (both AAD-backed
and MSA-backed).

The test should run in Visual Studio Code using the `Launch Test Application` debug profile. Once that profile is active, press `F5`.

### Test with your own client app
To test the built package with your own client app, you will need to run two npm commands. The first is to create the local npm package via a symlink. The second is in your client app to point your npm module reference (in your test client) to that symlink'd package.  Following this process allows you to use the built vsts-device-flow-auth package before it is ultimately published to npmjs.com.

#### First command (to be run from the root folder of **this** repository):
```
npm link
```

#### Second command (to be run from the root folder of **your test client** repository):
```
npm link vsts-device-flow-auth
```

Make sure that you have added the reference to the npm package in your client app's package.json file.

Now that the locally built npm package is available, you can test it with your own client app. For more information on `npm link` see the [npm documentation](https://docs.npmjs.com/cli/link). 


# Contributing
This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.microsoft.com.

When you submit a pull request, a CLA-bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., label, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Submitting Pull Requests
We welcome pull requests! Fork this repo and send us your contributions.  Go [here](https://help.github.com/articles/using-pull-requests/) to get familiar with GitHub pull requests.

# Visual Studio Team Services Device Flow Authentication for Node.js

**vsts-device-flow-auth** is a small library that helps your Node.js application's users interactively authenticate to Visual Studio Team Services. It
supports both Azure Active Directory-backed (AAD) and Microsoft Account-backed (MSA) Team Services accounts. When the authentication is complete,
the Node.js application receives a personal access token to use on the Team Services user's behalf.

Install
------------
```
$ npm install --save vsts-device-flow-auth
```

Usage
------------

Create a `DeviceFlowAuthenticator` with the URI of the user's Team Services account. You will also need to provide your application's client id and redirect Uri. For
information on how to register an application with Azure, see [How to register an app with the v2.0 endpoint](https://docs.microsoft.com/en-us/azure/active-directory/develop/active-directory-v2-app-registration)
for details.
```ts
const authOptions: IDeviceFlowAuthenticationOptions = {
    clientId: '00000000-0000-0000-0000-000000000000',
    redirectUri: 'https://some-url.com'
};
const dfa: DeviceFlowAuthenticator = new DeviceFlowAuthenticator("https://my-corporate-account.visualstudio.com", authOptions);
```

Call `GetDeviceFlowDetails()` to acquire the device_code, verification_url and optional message for the user to authenticate with Team Services.
```ts
const obj: DeviceFlowDetails = await dfa.GetDeviceFlowDetails();
```

Call `WaitForPersonalAccessToken()` to get the token to use on the user's behalf.
```ts
const pat: string = await dfa.WaitForPersonalAccessToken();
```

Below is a short TypeScript example of how to use the package. A [complete example](https://www.github.com/Microsoft/vsts-device-flow-auth/blob/master/test-integration/testapp.ts) can be found in the GitHub repository.


```ts
import { DeviceFlowAuthenticator, DeviceFlowDetails, IDeviceFlowAuthenticationOptions, IDeviceFlowTokenOptions } from 'vsts-device-flow-auth';

async function run() {
    const resourceUri: string = `https://my-corporate-account.visualstudio.com`;
    //const resourceUri: string = `https://my-personal-account.visualstudio.com`;

    const authOptions: IDeviceFlowAuthenticationOptions = {
        clientId: '00000000-0000-0000-0000-000000000000',
        redirectUri: 'https://some-url.com'
    };
    const tokenOptions: IDeviceFlowTokenOptions = {
        tokenDescription: `vsts-device-flow-auth test app: ${resourceUri} on ${os.hostname()}`,
    };
    const dfa: DeviceFlowAuthenticator = new DeviceFlowAuthenticator(resourceUri, authOptions, tokenOptions);

    const obj: DeviceFlowDetails = await dfa.GetDeviceFlowDetails();
    console.log(`message: ${obj.Message}`);
    console.log(`user code: ${obj.UserCode}`);
    console.log(`verify url: ${obj.VerificationUrl}`);

    console.log(`Go do the Device Flow authentication...`);
    console.log(``);

    const pat: string = await dfa.WaitForPersonalAccessToken();
    console.log(pat);
}

run();
```

## Support
Support for this project is provided on our [GitHub Issue Tracker](https://github.com/Microsoft/vsts-device-flow-auth/issues). You
can submit a [bug report](https://github.com/Microsoft/vsts-device-flow-auth/issues/new), a [feature request](https://github.com/Microsoft/vsts-device-flow-auth/issues/new) or participate in [discussions](https://github.com/Microsoft/vsts-device-flow-auth/issues).

## Contributing
To contribute to this project, see the [Contributing Guide](CONTRIBUTING.md).

## Code of Conduct
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Privacy Statement
The [Microsoft Visual Studio Product Family Privacy Statement](http://go.microsoft.com/fwlink/?LinkId=528096&clcid=0x409)
describes the privacy statement of this software.

## License
This extension is [licensed under the MIT License](LICENSE.txt). Please see the [third-party notices](ThirdPartyNotices.txt)
file for additional copyright notices and license terms applicable to portions of the software.

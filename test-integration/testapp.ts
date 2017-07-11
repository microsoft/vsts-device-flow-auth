/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
"use strict";

import * as os from 'os';

import { DeviceFlowAuthenticator, DeviceFlowDetails, IDeviceFlowAuthenticationOptions, IDeviceFlowTokenOptions } from '../src/deviceflow';

async function run() {
    const resourceUri: string = `https://my-corporate-account.visualstudio.com`; //AAD-backed account
    //const resourceUri: string = `https://my-personal-account.visualstudio.com`; //MSA-backed account

    try {
        const authOptions: IDeviceFlowAuthenticationOptions = {
            //authorityHost: 'https://management.core.windows.net/',
            clientId: '00000000-0000-0000-0000-000000000000',
            redirectUri: 'https://some-url.com',
            //userAgent: ''
        };
        const tokenOptions: IDeviceFlowTokenOptions = {
            //grantType: 'device_code',
            //tokenScope: '',
            tokenDescription: `vsts-device-flow-auth test app: ${resourceUri} on ${os.hostname()}`,
        };
        const dfa: DeviceFlowAuthenticator = new DeviceFlowAuthenticator(resourceUri, authOptions, tokenOptions);

        const obj: DeviceFlowDetails = await dfa.GetDeviceFlowDetails();
        console.log(`message: ${obj.Message}`);
        console.log(`user code: ${obj.UserCode}`);
        console.log(`verify url: ${obj.VerificationUrl}`);
        console.log(``);

        //Set breakpoint on line below in order to go and do the authentication
        console.log(`Go do the Device Flow authentication...`);
        console.log(``);

        // The following simulates a timeout call from the client
        // setTimeout(() => {
        //     dfa.Cancel(true);
        // }, 8000);

        const pat: string = await dfa.WaitForPersonalAccessToken();
        console.log(`Personal Access Token is: ${pat}`);
    } catch (err) {
        const statusCode: string = err.statusCode || '';
        const message: string = err.message || '';
        let method: string = '';
        let optionsUrl: string = '';
        if (err.options && err.options.method) {
            method = err.options.method;
        }
        if (err.options && err.options.url) {
            optionsUrl = err.options.url;
        }

        console.log(`Unable to get personal access token for ${resourceUri}. [statusCode: '${statusCode}' method: '${method}' message: '${message}' optionsUrl: '${optionsUrl}']`);
    }
}

run();

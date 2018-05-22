/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
"use strict";

import * as request from "request-promise-native";
import * as os from "os";

//Internal class used to keep track of the status of the device_code verification process
class DeviceCodeStatus {
    static PENDING: string = "PENDING";
    static BACKOFF: string = "BACKOFF";
    static BADCODE: string = "BADCODE";
    static EXPIRED: string = "EXPIRED";
}

//Represents the information provided back to the client to prompt the user to authenticate via their web browser
export class DeviceFlowDetails {
    private verifyUrl: string;
    private userCode: string;
    private message: string;

    constructor(message: string, userCode: string, verifyUrl: string) {
        this.message = message;
        this.userCode = userCode;
        this.verifyUrl = verifyUrl;
    }

    public get Message(): string {
        return this.message;
    }
    public get UserCode(): string {
        return this.userCode;
    }
    public get VerificationUrl(): string {
        return this.verifyUrl;
    }
}

//Options the client can provide to affect the behavior of the authentication process
//Example of authOptions:
// {
//     authorityHost: 'https://some-authority-host.net/',
//     clientId: '00000000-0000-0000-0000-000000000000',
//     redirectUri: 'https://www.some-url.com',
//     userAgent: 'my custom user agent'
// }
export interface IDeviceFlowAuthenticationOptions {
    authorityHost?: string;
    clientId: string; //required
    redirectUri: string; //required
    userAgent?: string;
}

//Options the client can provide to affect the personal access token taht is created
//https://www.visualstudio.com/en-us/docs/integrate/get-started/auth/oauth#scopes
//Example of tokenOptions:
// {
//     grantType: 'device_code',
//     tokenScope: '',
//     tokenDescription: 'my token description',
// }
export interface IDeviceFlowTokenOptions {
    grantType?: string;
    tokenScope?: string;
    tokenDescription?: string;
}

//Class used to acquire the details needed for user to verify their device
//code and to create a personal access token on their behalf.
export class DeviceFlowAuthenticator {
    /* tslint:disable:variable-name */
    private static readonly DefaultAuthorityHost: string = `https://management.core.windows.net/`;
    private static readonly DefaultGrantType: string = `device_code`;
    /* tslint:enable:variable-name */

    //Authentication options
    private readonly authorityHost: string = ``;
    private readonly clientId: string = ``;
    private readonly redirectUri: string = ``;
    private readonly userAgent: string = ``;

    //Token options
    private readonly grantType: string = ``;
    private readonly tokenScope: string = ``;
    private readonly tokenDescription: string = ``;

    private tenantId: string;
    private resourceUri: string;
    private deviceCode: string;
    private interval: number = 5 * 1000; //This will be in milliseconds
    private expiresIn: number = 900 * 1000; //This will be in milliseconds

    //FUTURE: Allow caller to specify how long they want the VSTS personal access token to be valid?
    constructor(resourceUri: string, authOptions: IDeviceFlowAuthenticationOptions, tokenOptions?: IDeviceFlowTokenOptions) {
        if (!resourceUri) {
            throw new Error(`resourceUri must have a value`);
        }
        this.resourceUri = this.addTrailingSeparator(resourceUri, "/");

        if (!authOptions.clientId) {
            throw new Error(`authOptions.clientId must have a value`);
        }
        if (!authOptions.redirectUri) {
            throw new Error(`authOptions.redirectUri must have a value`);
        }
        this.authorityHost = authOptions.authorityHost || DeviceFlowAuthenticator.DefaultAuthorityHost;
        this.clientId = authOptions.clientId;
        this.grantType = tokenOptions.grantType || DeviceFlowAuthenticator.DefaultGrantType;
        this.redirectUri = authOptions.redirectUri;
        this.tokenScope = tokenOptions.tokenScope || ``; //empty is all_scopes
        this.tokenDescription = tokenOptions.tokenDescription || "vsts-device-flow-auth Personal Access Token";
        this.userAgent = authOptions.userAgent || this.getDefaultUserAgent();
    }

    private getDefaultUserAgent(): string {
        return `vsts-device-flow-auth (${os.type()} ${os.release()}; Node ${process.versions["node"]})`;
    }

    //If the path doesn't have a trailing separator, add it
    private addTrailingSeparator(path: string, separator: string): string {
        if (path[path.length - 1] !== separator) {
            return path += separator;
        }
        return path;
    }

    //Returns the authorization headers needed for the calls to Team Services
    private getAuthorizationHeaders(accessToken): any {
        return {
            "Authorization": "Basic " + new Buffer("PAT:" + accessToken).toString("base64"),
            "X-TFS-FedAuthRedirect": "Suppress",
            "User-Agent": `${this.userAgent}`
        };
    }

    private getUserAgentHeaders(): any {
        return {
            "User-Agent": `${this.userAgent}`
        };
    }

    //Calls the connectionData endpoint to get the authenticatedUser information (the id is what we need)
    private async getAuthenticatedUserId(accessToken: string): Promise<string> {
        const getUrl: string = `${this.resourceUri}_apis/connectionData`;
        const getOptions: any = {
            url: getUrl,
            headers: this.getAuthorizationHeaders(accessToken)
        };

        return request.get(getOptions).then((body) => {
                //Example of the returned JSON:
                // {
                //    "authenticatedUser":{
                //       "id":"826a066b-dce1-42ab-b253-e4a52af0647e",
                //       "descriptor":"Microsoft.IdentityModel.Claims.ClaimsIdentity;72f988bf-86f1-41af-91ab-2d7cd011db47\\jeyou@microsoft.com",
                //       "providerDisplayName":"Jeff Young (TFS)",
                //       "customDisplayName":"Jeff Young",
                //       "isActive":true,
                //       "members":[
                //       ],
                //    ...
                // }
                const json: any = JSON.parse(body);
                //Make sure we get an authenticatedUser back (authenticatedUser is defined, authenticatedUser.id is defined)
                if (json.authenticatedUser && json.authenticatedUser.id) {
                    const id: string = json.authenticatedUser.id;
                    return id;
                } else {
                    throw new Error(`Did not receive an authenticatedUser or authenticatedUser.id for ${getUrl}. Body: ${body}`);
                }
            });
    }

    //https://github.com/Microsoft/Git-Credential-Manager-for-Mac-and-Linux/blob/e633ec8630e34d7d9511f297636d49a7cf8f6882/src/main/java/com/microsoft/alm/authentication/VsoAzureAuthority.java
    //Calls the LocationService (via hard-coded URL) to get the IdentityService URL mapped to the resourceUri (the user's account)
    private async getIdentityServiceUrl(accessToken: string): Promise<string> {
        const getUrl: string = `${this.resourceUri}_apis/ServiceDefinitions/LocationService2/951917AC-A960-4999-8464-E3F0AA25B381?api-version=1.0`;
        const getOptions: any = {
            url: getUrl,
            headers: this.getAuthorizationHeaders(accessToken)
        };

        return request.get(getOptions).then((body) => {
                //Example of the returned JSON:
                // {
                //    "serviceType":"LocationService2",
                //    "identifier":"951917ac-a960-4999-8464-e3f0aa25b381",
                //    "displayName":"SPS Location Service",
                //    "relativeToSetting":"fullyQualified",
                //    "serviceOwner":"00000000-0000-0000-0000-000000000000",
                //    "locationMappings":[
                //       {
                //          "accessMappingMoniker":"HostGuidAccessMapping",
                //          "location":"https://wcus0.app.vssps.visualstudio.com/A0efb4611-d565-4cd1-9a64-7d6cb6d7d5f0/"
                //       }
                //    ],
                //    "toolId":"Framework",
                //    "parentServiceType":"LocationService2",
                //    "parentIdentifier":"850a26fd-8300-ce32-bb6e-28e032a3a0fd",
                //    "properties":{
                //    }
                // }
                const json: any = JSON.parse(body);
                if (json.locationMappings && json.locationMappings.length >= 0 && json.locationMappings[0].location) {
                    const location: string = json.locationMappings[0].location;
                    return location;
                } else {
                    throw new Error(`Did not receive locationMappings or location from ${getUrl}. Body: ${body}`);
                }
            });
    }

    //This function first gets the identity service URL needed in order to create a personal access token.
    //It then makes the request to create the personal access token on the user's behalf.
    private async getScopedCompactAccessToken(accessToken: string, userId: string): Promise<any> {
        //Call LocationService to get the Identity URL (wcus0.app.vssps.visualstudio.com/A0efb4611-d565-4cd1-9a64-7d6cb6d7d5f0)
        const identityUrl: string = await this.getIdentityServiceUrl(accessToken);
        const postUrl: string = `${identityUrl}_apis/token/sessiontokens?api-version=1.0&tokentype=compact`;
        const postOptions: any = {
            url: postUrl,
            body: { scope: `${this.tokenScope}`, targetAccounts: `["${userId}"]`, displayName: `${this.tokenDescription}` },
            json: true,
            headers: this.getAuthorizationHeaders(accessToken)
        };

        return request.post(postOptions).then((body) => {
                //body is already a JSON object (since json:true is specified in postOptions)
                const pat: string = body.token;
                return pat;
            });
    }

    //Get the tenantId via a HEAD request to the resourceUri. We don't care about the statusCode so we
    //handle the response in both accepted and rejected cases then throw if x-vss-resourcetenant is null
    //For an MSA backed account, tenantId is an empty guid
    private async getTenantId(): Promise<string> {
        const headOptions: any = {
            url: this.resourceUri,
            headers: this.getUserAgentHeaders
        };

        let resourceTenant: string;
        let tenantId: string;

        try {
            const body: any = await request.head(headOptions);
            resourceTenant = body.response['x-vss-resourcetenant'];
        } catch (error) {
            resourceTenant = error.response['x-vss-resourcetenant'];
        }

        if (resourceTenant) {
            const tenantIds: string[] = resourceTenant.split(',');
            if (tenantIds.length > 1) {
                for (const id of tenantIds) {
                    if (id !== "00000000-0000-0000-0000-000000000000") {
                        tenantId = id;
                        break;
                    }
                }
            } else {
                tenantId = tenantIds[0];
            }
        } else {
            throw new  Error(`Did not receive tenant id from ${this.resourceUri}`);
        }

        return tenantId.trim();
    }

    //Returns a Promise that is resolved after ms milliseconds
    private sleep(ms: number): Promise<{}> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    //Waits on the authentication to occur and returns the access_code needed to continue
    private async waitOnResponseAccessToken(deviceCode: string): Promise<string> {
        let postUrl: string = `https://login.microsoft.com/${this.tenantId}/oauth2/token`;
        //MSA-backed accounts...
        if (!this.tenantId || this.tenantId === "00000000-0000-0000-0000-000000000000") {
            postUrl = `https://login.microsoftonline.com/live.com/oauth2/token`;
        }
        const postOptions: any = {
            url: postUrl,
            headers: this.getUserAgentHeaders(),
            form: {
                client_id: `${this.clientId}`,
                code: `${deviceCode}`,
                grant_type: `${this.grantType}`
            }
        };

        //https://github.com/Microsoft/Git-Credential-Manager-for-Mac-and-Linux/blob/e8e1be7df952f7772ceadadc86e1f2a5b2e360c6/src/main/java/com/microsoft/alm/authentication/DeviceFlowImpl.java
        return request.post(postOptions).then((body) => {
                //Example of the returned JSON:
                // {
                //     "token_type":"Bearer",
                //     "scope":"user_impersonation",
                //     "expires_in":"3599",
                //     "ext_expires_in":"0",
                //     "expires_on":"1498157504",
                //     "not_before":"1498153604",
                //     "resource":"https://management.core.windows.net/",
                //     "access_token":"eyJ0eXAiOiJKV1QiLC...24bjME-D7Yt9FTI6g",
                //     "refresh_token":"AQABAAAAAABnfiG-m...-CmCd6fPIAA",
                //     "id_token":"eyJ0eXAiOiJKV1Qi...dmVyIjoiMS4wIn0."
                // }
                const json: any = JSON.parse(body);
                if (json.access_token) {
                    const accessToken: string = json.access_token;
                    return accessToken;
                } else {
                    throw new Error(`Did not receive an access token from ${postUrl}. Body: ${body}`);
                }
            }).catch((err) => {
                //We need to look for HTTP_BAD_REQUEST (400) as an indicator that the process isn't complete yet
                if (err.statusCode === 400 && err.error) {
                    //Example of the returned JSON:
                    // {
                    //     "error":"authorization_pending",
                    //     "error_description":"AADSTS70016: Pending end-user authorization.\r\nTrace ID: 701d3...19:37:26Z",
                    //     "error_codes":[
                    //         70016
                    //     ],
                    //     "timestamp":"2017-06-22 19:37:26Z",
                    //     "trace_id":"701d3b24-cd30-411c-a9bc-49e28fb20400",
                    //     "correlation_id":"7fa2427b-f93c-41d6-826a-773e23b055c2"
                    //     }
                    const result: any = JSON.parse(err.error);
                    if (result.error === "authorization_pending") {
                        return DeviceCodeStatus.PENDING;
                    } else if (result.error === "slow_down") {
                        return DeviceCodeStatus.BACKOFF;
                    } else if (result.error === "bad_verification_code") {
                        return DeviceCodeStatus.BADCODE;
                    } else if (result.error === "code_expired") {
                        return DeviceCodeStatus.EXPIRED;
                    }
                }
                throw err;
            });
    }

    //Initial call the client should make to retrieve the device_code and verification_url the user needs
    //to authenticate. The device_code, message and verification_url are returned in DeviceFlowDetails.
    public async GetDeviceFlowDetails(): Promise<DeviceFlowDetails> {
        this.tenantId = await this.getTenantId();
        let postUrl: string = `https://login.microsoft.com/${this.tenantId}/oauth2/devicecode`;
        //MSA-backed accounts...
        if (!this.tenantId || this.tenantId === "00000000-0000-0000-0000-000000000000") {
            postUrl = `https://login.microsoftonline.com/live.com/oauth2/devicecode`;
        }

        const postOptions: any = {
            url: postUrl,
            headers: this.getUserAgentHeaders(),
            form: {
                client_id: `${this.clientId}`,
                resource: `${this.authorityHost}`,
                redirect_uri: `${this.redirectUri}`
            }
        };
        return request.post(postOptions).then((body) => {
                //Example of the returned JSON:
                // {
                //    "user_code":"BWYPRWXU8",
                //    "device_code":"BAQABAAEAAABnfiG-mA6NTae...XQjhvlI4BsnK3xj7cF0VMzsZNSAA",
                //    "verification_url":"https://aka.ms/devicelogin",
                //    "expires_in":"900",
                //    "interval":"5",
                //    "message":"To sign in, use a web browser to open the page https://aka.ms/devicelogin and enter the code BWYPRWXU8 to authenticate."
                // }
                 const json: any = JSON.parse(body);
                 //Save off the internal values we need for later
                 this.deviceCode = json.device_code;
                 this.interval = Number.parseInt(json.interval) * 1000;
                 this.expiresIn = Number.parseInt(json.expires_in) * 1000;
                 //Return the values the client needs for the user to complete the authentication
                 return new DeviceFlowDetails(json.message,
                                              json.user_code,
                                              json.verification_url);
            });
    }

    //Allow the client to cancel the in-process request. Also gives the option to throw
    //an exception when canceled. Otherwise, an empty token is returned.
    private cancelFlag: boolean = false;
    private throwExceptionOnCancel: boolean = false;
    public Cancel(throwExceptionOnCancel?: boolean): void {
        this.cancelFlag = true;
        this.throwExceptionOnCancel = throwExceptionOnCancel;
    }

    //Called by client once the device flow details are retrieved. It waits until the device_code is entered and
    //authentication is completed, the request is canceled by the caller or the device_code expires. If authentication
    //is completed, the accessToken is used to get the userId (the user who was authenticated) so that a personal
    //access token can be created on their behalf. This function will throw in case of errors such as general communication
    //errors, an expired device code, etc.
    public async WaitForPersonalAccessToken(): Promise<string> {
        //Check for this.deviceCode since this method could be (incorrectly) called before GetDeviceFlowDetails()
        if (!this.deviceCode) {
            throw new Error(`Valid device code not found for ${this.resourceUri}. Ensure that a device code was requested.`);
        }
        // https://github.com/Microsoft/Git-Credential-Manager-for-Mac-and-Linux/blob/e8e1be7df952f7772ceadadc86e1f2a5b2e360c6/src/main/java/com/microsoft/alm/authentication/DeviceFlowImpl.java
        let sleepInterval: number = this.interval;
        let accessToken: string = await this.waitOnResponseAccessToken(this.deviceCode);
        //While the client hasn't canceled, the user_code hasn't expired, and we are waiting (PENDING) or need to BACKOFF
        while (!this.cancelFlag && accessToken !== DeviceCodeStatus.EXPIRED &&
                (accessToken === DeviceCodeStatus.PENDING || accessToken === DeviceCodeStatus.BACKOFF)) {
            if (accessToken === DeviceCodeStatus.PENDING) {
                await this.sleep(sleepInterval);
                accessToken = await this.waitOnResponseAccessToken(this.deviceCode);
            } else if (accessToken === DeviceCodeStatus.BACKOFF) {
                sleepInterval *= 2;
                await this.sleep(sleepInterval);
                accessToken = await this.waitOnResponseAccessToken(this.deviceCode);
            }
        }
        if (accessToken === DeviceCodeStatus.EXPIRED) {
            throw new Error(`Verification code expired for ${this.resourceUri}. Could not get an access token.`);
        }
        if (accessToken === DeviceCodeStatus.BADCODE) {
            throw new Error(`Incorrect verification code entered for ${this.resourceUri}. Could not get an access token.`);
        }
        if (this.cancelFlag) {
            if (this.throwExceptionOnCancel) {
                throw new Error(`Request canceled by user.`);
            }
            return undefined;
        }
        const userId: string = await this.getAuthenticatedUserId(accessToken);
        const token: string = await this.getScopedCompactAccessToken(accessToken, userId);
        return token;
    }
}

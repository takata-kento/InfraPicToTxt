import * as aws from "@pulumi/aws";
import * as apigateway from "@pulumi/aws-apigateway";

export interface Route {
    method: apigateway.Method;
    apiPath: string;
    lambda_handler: aws.lambda.Function;
    lambda_auth_handler?: aws.lambda.Function;
}

export class APIGateway {
    apiName: string;
    routes: Route[];
    stageName: string;
    tags: aws.Tags;

    /**
     * API Gatewayを作成するための各種パラメータを設定します。
     * リソースタグは本クラスで作成されるすべてのリソースに付けられます。
     * @param _apiName 
     * @param _routes
     * @param _stageName 
     * @param _tags 
     */
    constructor(_apiName: string, _routes: Route[], _stageName: string, _tags: aws.Tags){
        this.apiName = _apiName;
        this.routes = _routes;
        this.stageName = _stageName;
        this.tags = _tags;
    }

    /**
     * API Gatewayを作成します。
     * @param _provider?
     * @returns API Gatewayリソース
     */
    public createAPIGateway(_provider?: aws.Provider): apigateway.RestAPI {
        let apiGatewayResource: apigateway.RestAPI;
        let routeArgs: apigateway.types.input.RouteArgs[] = [];

        let paths = new Set<string>();
        this.routes.forEach(route => {
            if(paths.has(route.apiPath)){
                throw new Error(`route path is duplicated: ${route.apiPath}`);
            }
            paths.add(route.apiPath);
        });

        this.routes.forEach(
            route => {
                routeArgs.push({
                    path: route.apiPath,
                    eventHandler: route.lambda_handler,
                    method: route.method,
                    authorizers: [{
                        parameterName: "Bearer",
                        handler: route.lambda_auth_handler
                    }]
                });
            }
        );

        apiGatewayResource = new apigateway.RestAPI(
            this.apiName,
            {
                routes: routeArgs,
                stageName: this.stageName,
                tags: this.tags
            },
            {provider: _provider}
        );

        return apiGatewayResource;
    }
}

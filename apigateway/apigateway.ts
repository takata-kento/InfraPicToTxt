import * as aws from "@pulumi/aws";
import * as apigateway from "@pulumi/aws-apigateway";

export interface route {
    method: apigateway.Method;
    apiPath: string;
    lambda_hundler: aws.lambda.Function;
    lambda_auth_hundler: aws.lambda.Function;
}

export class APIGateway {
    apiName: string;
    routes: route[];
    stageName: string;
    tags: aws.Tags;

    stageResource: any;

    /**
     * API Gatewayを作成するための各種パラメータを設定します。
     * リソースタグは本クラスで作成されるすべてのリソースに付けられます。
     * @param _apiName 
     * @param _routes
     * @param _stageName 
     * @param _tags 
     */
    constructor(_apiName: string, _routes: route[], _stageName: string, _tags: aws.Tags){
        this.apiName = _apiName;
        this.routes = _routes;
        this.stageName = _stageName;
        this.tags = _tags;
    }

    /**
     * API Gatewayを作成します。
     * @param _provider 
     * @returns API Gatewayリソース
     */
    public createAPIGateway(_provider: aws.Provider): apigateway.RestAPI {
        let apiGatewayResource: apigateway.RestAPI;
        let routeArgs: apigateway.types.input.RouteArgs[] = [];

        this.routes.forEach(expectedRoute => {
            if(this.routes.filter(route => route.apiPath === expectedRoute.apiPath).length > 1){
                throw new Error('route path is duplicated');
            }
        });

        this.routes.forEach(
            route => {
                routeArgs.push({
                    path: route.apiPath,
                    eventHandler: route.lambda_hundler,
                    method: route.method,
                    authorizers: [{
                        parameterName: "Bearer",
                        handler: route.lambda_auth_hundler
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
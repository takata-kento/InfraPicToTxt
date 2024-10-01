import * as IamRole from "./iam/iam";
import * as Lambda from "./lambda/lambda";
import * as Apigateway from "./apigateway/apigateway";

const role = new IamRole.IAMRole(
    "roleLambdaPicToTxt",
    "policyLambdaPicToTxt",
    "./iam/policies/lambda_app_policy.json",
    "./iam/policies/lambda_app_assume_policy.json",
    {
         "App": "PicToTxt"
    }
);

export const roleResource = role.createIAMRole();

const lambda = new Lambda.ResourceLambda(
    "roleLambdaPicToTxt",
    "FunctionLambdaPicToTxt",
    "./lambda/srcLambdaFunc/lambda_function.py",
    {
        "App": "PicToTxt"
    }
);

export const lambdaResource = lambda.create(undefined, "./lambda/srcLambdaFunc/packages.zip");

const apigateway = new Apigateway.APIGateway(
    "ApiPicToTxt",
    [
        {
            method: "POST",
            apiPath: "/picToTxt",
            lambda_handler: lambdaResource,
            lambda_auth_handler: undefined
        }
    ],
    "dev",
    {
        "App": "PicToTxt"
    }
);

export const apiGatewayResource = apigateway.createAPIGateway();

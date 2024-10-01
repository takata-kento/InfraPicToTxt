import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as apigateway from "@pulumi/aws-apigateway";
import * as sinon from "sinon";
import "mocha";
import { APIGateway, Route } from "../apigateway/apigateway";
import { expect } from "chai";
import { describe } from "mocha";

// pulumiランタイムのモックを作成
pulumi.runtime.setMocks(
    {
        newResource: function(args: pulumi.runtime.MockResourceArgs): {id: string, state: any} {
            return {
                id: args.inputs.name + "_id",
                state: args.inputs
            };
        },
        call: function(args: pulumi.runtime.MockCallArgs) {
            return args.inputs;
        }
    },
    "project",
    "stack",
    false
);

describe(
    "# API Gatewayテスト",
    function() {
        let provider: aws.Provider;

        describe(
            "## APIGatewayクラスユニットテスト",
            function() {
                before(
                    () => {
                        provider = new aws.Provider(
                            "privileged",
                            {
                                assumeRole: {
                                    roleArn: "arn:aws:iam::123456789012:role/RoleCicdInfraLlmPoc",
                                    sessionName: "PulumiSession",
                                    externalId: "PulumiApplication",
                                },
                            }
                        );
                    }
                )

                afterEach(
                    () => {
                        sinon.restore();
                    }
                )

                it(
                    "### createAPIGatewayメソッドでroutesに同じパスかつ同じメソッドが存在する場合にエラーを投げることを確認します。",
                    () => {
                        // Given
                        const tags :aws.Tags = {App: "PicToTxt"};
                        const routes: Route[] = [
                            {
                                method: apigateway.Method.GET,
                                apiPath: "/",
                                lambda_handler: new aws.lambda.Function("testLambda1", {role: ""}, {provider: provider}),
                                lambda_auth_handler: new aws.lambda.Function("testAuthLambda", {role: ""}, {provider: provider})
                            },
                            {
                                method: apigateway.Method.GET,
                                apiPath: "/",
                                lambda_handler: new aws.lambda.Function("testLambda2", {role: ""}, {provider: provider}),
                                lambda_auth_handler: new aws.lambda.Function("testAuthLambda", {role: ""}, {provider: provider})
                            }
                        ]
                        const stage = "testStage";
                        const apiGateway = new APIGateway("testAPIGateway", routes, stage, tags);

                        // When
                        // Then
                        expect(() => apiGateway.createAPIGateway(provider)).to.throw();
                    }
                )

                it(
                    "### createAPIGatewayメソッドでAPI Gatewayリソースが正常に作成されることを確認します。",
                    (done) => {
                        // Given
                        const expectedTags :aws.Tags = {App: "PicToTxt"};
                        const mockLambdaFunction = new aws.lambda.Function("mockFunction", {
                            runtime: aws.lambda.NodeJS12dXRuntime,
                            code: new pulumi.asset.AssetArchive({
                                ".": new pulumi.asset.FileArchive("./app"),
                            }),
                            handler: "index.handler",
                            role: "mockRoleArn",
                        });
                        const routes: Route[] = [
                            {
                                method: apigateway.Method.GET,
                                apiPath: "/",
                                lambda_handler: mockLambdaFunction,
                                lambda_auth_handler: mockLambdaFunction
                            }
                        ]
                        const expectedStage = "testStage";
                        const apiGateway = new APIGateway("testAPIGateway", routes, expectedStage, expectedTags);

                        // When
                        // @pulumi/aws-apigatewayのRestAPIクラスにtagsプロパティが存在しないため、any型でキャストする。
                        let apiGatewayResource: any = apiGateway.createAPIGateway(provider);

                        // Then
                        pulumi
                            .all([apiGatewayResource?.urn, apiGatewayResource?.tags])
                            .apply(
                                ([urn, tags]) => {
                                    if (!tags || !tags["App"]){
                                        done(new Error(`Missing a App tag on Api Gateway ${urn} , ${tags}`));
                                    } else {
                                        done();
                                    }
                                }
                            )
                    }
                )
            }
        )
    }
)

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as sinon from "sinon";
import "mocha";
import { ResourceLambda } from "../lambda/lambda";
import { describe } from "mocha";
import * as unzipper from "unzipper";
import { dirname } from "path";

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
    true
);

describe(
    "# Lambdaテスト",
    function() {
        let provider: aws.Provider;
        let jsonParseSpy: sinon.SinonSpy;

        describe(
            "## Lambdaクラスユニットテスト",
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

                it(
                    "### cloudwatchのログフォーマットがTextになっていることとログレベルがシステムログレベルであることを確認します。",
                    (done) => {
                        // Given
                        const tags :aws.Tags = {App: "PicToTxt"};
                        const lambda = new ResourceLambda(
                            "arn:aws:iam::123456789012:role/RoleCicdInfraLlmPoc",
                            "function_logformat_test",
                            "../lambda/srcLambdaFunc/lambda_function.py",
                            tags
                        );

                        // When
                        const lambda_resource = lambda.create(provider);

                        // Then
                        pulumi.all([lambda_resource.urn, lambda_resource.loggingConfig])
                              .apply(
                                ([urn, loggingConfig]) => {
                                    if (!(loggingConfig?.logFormat === "Text")){
                                        done(new Error(`ログフォーマットがTextになっていません。urn -> ${urn}`));
                                    }else if (!(loggingConfig?.systemLogLevel === undefined)){
                                        done(new Error(`システムログレベルが設定されてしまっています。ログフォーマット"Text"では指定できません。urn -> ${urn}`));
                                    }else {
                                        done();
                                    }
                                }
                              );
                    }
                );

                it(
                    "### createメソッドでリソースに[App]タグが付けられていることを確認します。",
                    (done) => {
                        // Given
                        const expectedTags :aws.Tags = {App: "PicToTxt"};
                        const lambda = new ResourceLambda(
                            "arn:aws:iam::123456789012:role/RoleCicdInfraLlmPoc",
                            "function_tag_test",
                            "../lambda/srcLambdaFunc/lambda_function.py",
                            expectedTags
                        );

                        // When
                        const lambda_resource = lambda.create(provider);

                        // Then
                        pulumi.all([lambda_resource.urn, lambda_resource.tags])
                              .apply(
                                ([urn, tags]) => {
                                    if (!tags || !tags["App"]){
                                        done(new Error(`Appタグが設定されていません。urn -> ${urn}`));
                                    }else {
                                        done();
                                    }
                                }
                              );
                    }
                );

                it(
                    "### createメソッドにpythonのライブラリを指定した場合にリソースが正常に作成されることを確認します。",
                    (done) => {
                        // Given
                        const tags :aws.Tags = {App: "PicToTxt"};
                        const lambda = new ResourceLambda(
                            "arn:aws:iam::123456789012:role/RoleCicdInfraLlmPoc",
                            "function_lib_test",
                            "../lambda/srcLambdaFunc/lambda_function.py",
                            tags
                        );

                        // When
                        const lambda_resource = lambda.create(provider, "../lambda/srcLambdaFunc/packages.zip");

                        // Then
                        pulumi.all([lambda_resource.urn, lambda_resource.handler])
                              .apply(
                                ([urn, handler]) => {
                                    if (!handler){
                                        done(new Error(`関数が作成されませんでした。urn -> ${urn}`));
                                    }else {
                                        done();
                                    }
                                }
                              );
                    }
                );
            }
        );
    }
);

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as apigateway from "@pulumi/aws-apigateway";
import * as fs from "fs";
import * as sinon from "sinon";
import proxyquire from "proxyquire";
import "mocha";
import { IAMRole } from "../iam/iam";
import { APIGateway, route } from "../apigateway/apigateway";
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
    "# IAMロールテスト",
    function() {
        let provider: aws.Provider;
        let jsonParseSpy: sinon.SinonSpy;

        describe(
            "## IAMRoleクラスユニットテスト",
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
                    "### readPolicyJsonメソッドでポリシーファイルから正しくJSONオブジェクトを読み込み、返すことを確認します。",
                    () => {
                        // Given
                        const expectedJson = { key: "value" };
                        const readFileSyncStub = sinon.stub().returns(JSON.stringify(expectedJson));

                        // 非設定可能(non-configurable)かつ非書き込み可能(non-writable)なプロパティであるため、sinonではスタブ化できない。
                        // そのためproxyquireを使用して[`fs.readFileSync`]の振る舞いをスタブ化する。
                        const IAMRole = proxyquire('../iam/iam.ts', {
                            'fs': { readFileSync: readFileSyncStub }
                        }).IAMRole;

                        const iamRole = new IAMRole("testRole", "testPolicy", "../iam/policy/test.json", {App: "PicToTxt"});

                        // When
                        const result = iamRole["readPolicyJson"]("lambda_app_policy", new Map());

                        // アサート
                        expect(result).to.deep.equal(expectedJson);
                    }
                );

                it("### readPolicyJsonメソッドで提供された値でポリシーファイル内の変数を正しく置換することを確認します。",
                    () => {
                        // Given
                        const policyContent = "{\"key\": \"${variable}\"}";
                        const expectedJson = { key: "replacedValue" };
                        const readFileSyncStub = sinon.stub().returns(policyContent);

                        const IAMRole = proxyquire('../iam/iam.ts', {
                            'fs': { readFileSync: readFileSyncStub }
                        }).IAMRole;

                        const iamRole = new IAMRole("testRole", "testPolicy", "../iam/policy/test.json", {App: "PicToTxt"});

                        // When
                        const result = iamRole["readPolicyJson"]("testPolicy", new Map([["variable", "replacedValue"]]));

                        // Then
                        expect(result).to.deep.equal(expectedJson);
                    }
                );

                it(
                    "### readPolicyJsonメソッドでポリシーファイルが存在しない場合にエラーを投げることを確認します。",
                    () => {
                        // Given
                        const readFileSyncStub = sinon.stub().throws(new Error("File not found"));

                        const IAMRole = proxyquire('../iam/iam.ts', {
                            'fs': { readFileSync: readFileSyncStub }
                        }).IAMRole;

                        const iamRole = new IAMRole("testRole", "testPolicy", "../iam/policy/test.json", {App: "PicToTxt"});

                        // When
                        // Then
                        expect(() => iamRole["readPolicyJson"]("nonexistentPolicy", new Map())).to.throw("File not found");
                    }
                );

                it(
                    "### readPolicyJsonメソッドでポリシーファイルが無効なJSONを含む場合にエラーを投げることを確認します。",
                    () => {
                        // Given
                        const readFileSyncStub = sinon.stub().returns("invalid JSON");

                        const IAMRole = proxyquire('../iam/iam.ts', {
                            'fs': { readFileSync: readFileSyncStub }
                        }).IAMRole;

                        const iamRole = new IAMRole("testRole", "testPolicy", "../iam/policy/test.json", {App: "PicToTxt"});

                        jsonParseSpy = sinon.spy(JSON, "parse");

                        // When
                        // Then
                        expect(() => iamRole["readPolicyJson"]("invalidJsonPolicy", new Map())).to.throw();
                        expect(jsonParseSpy.threw()).to.be.true;
                    }
                );

                it(
                    "### readPolicyJsonメソッドで複数の変数に値が埋め込まれていることを確認します。",
                    () => {
                        // Given
                        const policyContent = 
                            {
                                "Version": "2012-10-17",
                                "Statement": [
                                    {
                                        "Sid": "cloudWatchLogs",
                                        "Effect": "Allow",
                                        "Action": [
                                            "logs:CreateLogStream",
                                            "logs:CreateLogGroup",
                                            "logs:PutLogEvents"
                                        ],
                                        "Resource": [
                                            "arn:aws:logs:ap-northeast-1:\${aws_account_id}:log-group:/aws/lambda/\${lambda_func_name}:*",
                                            "arn:aws:logs:ap-northeast-1:\${aws_account_id}:log-group:/aws/lambda/\${lambda_func_name}:log-stream:*"
                                        ]
                                    },
                                    {
                                        "Sid": "bedrock",
                                        "Effect": "Allow",
                                        "Action": "bedrock:InvokeModelWithResponseStream",
                                        "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-opus-20240229-v1:0"
                                    }
                                ]
                            }

                        const expectedJson = 
                            {
                                "Version": "2012-10-17",
                                "Statement": [
                                    {
                                        "Sid": "cloudWatchLogs",
                                        "Effect": "Allow",
                                        "Action": [
                                            "logs:CreateLogStream",
                                            "logs:CreateLogGroup",
                                            "logs:PutLogEvents"
                                        ],
                                        "Resource": [
                                            "arn:aws:logs:ap-northeast-1:123456789012:log-group:/aws/lambda/lambda_test_func:*",
                                            "arn:aws:logs:ap-northeast-1:123456789012:log-group:/aws/lambda/lambda_test_func:log-stream:*"
                                        ]
                                    },
                                    {
                                        "Sid": "bedrock",
                                        "Effect": "Allow",
                                        "Action": "bedrock:InvokeModelWithResponseStream",
                                        "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-opus-20240229-v1:0"
                                    }
                                ]
                            };
                        const readFileSyncStub = sinon.stub().returns(JSON.stringify(policyContent));

                        const IAMRole = proxyquire('../iam/iam.ts', {
                            'fs': { readFileSync: readFileSyncStub }
                        }).IAMRole;

                        const iamRole = new IAMRole("testRole", "testPolicy", "../iam/policy/test.json", {App: "PicToTxt"});

                        // When
                        const result = iamRole["readPolicyJson"](
                            "../iam/policy/test.json",
                            new Map(
                                [
                                    ["aws_account_id", "123456789012"],
                                    ["lambda_func_name", "lambda_test_func"]
                                ]
                            )
                        );

                        // Then
                        expect(result).to.deep.equal(expectedJson);
                    }
                )

                it(
                    "### createPolicyメソッドでリソースに[App]タグが付けられていることとroleポリシーの正常性を確認します。",
                    (done) => {
                        // Given
                        const expectedJson = 
                            {
                                "Version": "2012-10-17",
                                "Statement": [
                                    {
                                        "Sid": "cloudWatchLogs",
                                        "Effect": "Allow",
                                        "Action": [
                                            "logs:CreateLogStream",
                                            "logs:CreateLogGroup",
                                            "logs:PutLogEvents"
                                        ],
                                        "Resource": [
                                            "arn:aws:logs:ap-northeast-1:123456789012:log-group:/aws/lambda/lambda_test_func:*",
                                            "arn:aws:logs:ap-northeast-1:123456789012:log-group:/aws/lambda/lambda_test_func:log-stream:*"
                                        ]
                                    },
                                    {
                                        "Sid": "bedrock",
                                        "Effect": "Allow",
                                        "Action": "bedrock:InvokeModelWithResponseStream",
                                        "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-opus-20240229-v1:0"
                                    }
                                ]
                            };

                        const expectedTags :aws.Tags = {App: "PicToTxt"};

                        const iamRole = new IAMRole("testRole", "testPolicy", "../iam/policy/test.json", "../iam/policy/test.json", expectedTags);

                        // readPolicyJsonはprivateメソッドのためiamRoleの型チェックを回避する。
                        const readPolicyJsonStub = sinon.stub(iamRole as any, "readPolicyJson");

                        readPolicyJsonStub.returns(expectedJson);

                        // When
                        let iamPolicyResource = iamRole["createPolicy"](provider);

                        // Then
                        pulumi
                            .all([iamPolicyResource?.urn, iamPolicyResource?.tags, iamPolicyResource?.policy])
                            .apply(
                                ([urn, tags, policy]) => {
                                    if (!tags || !tags["App"]){
                                        done(new Error(`Missing a App tag on IAM Role ${urn} , ${tags}`));
                                    } else if (policy !== JSON.stringify(expectedJson)) {
                                        done(new Error(`Policy is not equal to expected value. ${urn} , ${policy}`));
                                    } else {
                                        done();
                                    }
                                }
                            )
                    }
                )

                it(
                    "### createRoleメソッドでリソースに[App]タグが付けられていることとassume roleポリシーの正常性を確認します。",
                    (done) => {
                        // Given
                        const expectedJson = 
                            {
                                "Version": "2012-10-17",
                                "Statement": [
                                    {
                                        "Effect": "Allow",
                                        "Principal": {
                                            "Service": "lambda.amazonaws.com"
                                        },
                                        "Action": "sts:AssumeRole"
                                    }
                                ]
                            };

                        const expectedTags :aws.Tags = {App: "PicToTxt"};

                        const iamRole = new IAMRole("testRole", "testPolicy", "../iam/policy/test.json", "../iam/policy/test.json", expectedTags);

                        // readPolicyJsonはprivateメソッドのためiamRoleの型チェックを回避する。
                        const readPolicyJsonStub = sinon.stub(iamRole as any, "readPolicyJson");

                        readPolicyJsonStub.returns(expectedJson);

                        // When
                        let iamRoleEmptyResource = iamRole["createRole"](provider);

                        // Then
                        pulumi
                            .all([iamRoleEmptyResource?.urn, iamRoleEmptyResource?.tags, iamRoleEmptyResource?.assumeRolePolicy])
                            .apply(
                                ([urn, tags, assumeRolePolicy]) => {
                                    if (!tags || !tags["App"]){
                                        done(new Error(`Missing a App tag on IAM Role ${urn} , ${tags}`));
                                    } else if (assumeRolePolicy !== JSON.stringify(expectedJson)) {
                                        done(new Error(`Policy is not equal to expected value. ${urn} , ${assumeRolePolicy}`));
                                    } else {
                                        done();
                                    }
                                }
                            )
                    }
                )

                it(
                    "### createIAMRoleメソッドでロールにポリシーがアタッチされることを確認します。",
                    () => {
                        // Given
                        const iamRole = new IAMRole("testRole", "testPolicy", "../iam/policy/testPolicy.json", "../iam/policy/testPolicyAssume.json", {App: "PicToTxt"});

                        const policyAssumeJson = 
                            {
                                "Version": "2012-10-17",
                                "Statement": [
                                    {
                                        "Effect": "Allow",
                                        "Principal": {
                                            "Service": "lambda.amazonaws.com"
                                        },
                                        "Action": "sts:AssumeRole"
                                    }
                                ]
                            };

                        const policyJson = 
                            {
                                "Version": "2012-10-17",
                                "Statement": [
                                    {
                                        "Sid": "cloudWatchLogs",
                                        "Effect": "Allow",
                                        "Action": [
                                            "logs:CreateLogStream",
                                            "logs:CreateLogGroup",
                                            "logs:PutLogEvents"
                                        ],
                                        "Resource": [
                                            "arn:aws:logs:ap-northeast-1:123456789012:log-group:/aws/lambda/lambda_test_func:*",
                                            "arn:aws:logs:ap-northeast-1:123456789012:log-group:/aws/lambda/lambda_test_func:log-stream:*"
                                        ]
                                    },
                                    {
                                        "Sid": "bedrock",
                                        "Effect": "Allow",
                                        "Action": "bedrock:InvokeModelWithResponseStream",
                                        "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-opus-20240229-v1:0"
                                    }
                                ]
                            };

                        const readPolicyJsonStub = sinon.stub(iamRole as any, "readPolicyJson");
                        readPolicyJsonStub.withArgs("../iam/policy/testPolicy.json").returns(policyJson);
                        readPolicyJsonStub.withArgs("../iam/policy/testPolicyAssume.json").returns(policyAssumeJson);

                        // When
                        // Then
                        expect(() => iamRole.createIAMRole(provider)).to.not.throw();
                    }
                )
            }
        )

        describe(
            "## IAMRoleクラス用コンフィグファイルテスト",
            function() {
                it(
                    "### JSONファイルに構文エラーがないか確認します。",
                    () => {
                        // Given
                        let jsonFiles: string[] = fs.readdirSync("/pulumi/projects/InfraPicToTxt/iam/policies/");
                        for(let i = 0; i < jsonFiles.length; i++){
                            jsonFiles[i] = "/pulumi/projects/InfraPicToTxt/iam/policies/" + jsonFiles[i];
                        }

                        // When
                        // Then
                        expect(
                            () => {
                                jsonFiles.forEach((s) => {
                                    let jsonString: string = fs.readFileSync(s, "utf-8");
                                    JSON.parse(jsonString || "null");
                                })
                            })
                            .to.not.throw();
                    }
                )
            }
        )
    }
)

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
                        const routes: route[] = [
                            {
                                method: apigateway.Method.GET,
                                apiPath: "/",
                                lambda_hundler: new aws.lambda.Function("testLambda1", {role: ""}, {provider: provider}),
                                lambda_auth_hundler: new aws.lambda.Function("testAuthLambda", {role: ""}, {provider: provider})
                            },
                            {
                                method: apigateway.Method.GET,
                                apiPath: "/",
                                lambda_hundler: new aws.lambda.Function("testLambda2", {role: ""}, {provider: provider}),
                                lambda_auth_hundler: new aws.lambda.Function("testAuthLambda", {role: ""}, {provider: provider})
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
                        const routes: route[] = [
                            {
                                method: apigateway.Method.GET,
                                apiPath: "/",
                                lambda_hundler: mockLambdaFunction,
                                lambda_auth_hundler: mockLambdaFunction
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

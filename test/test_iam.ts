import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs";
import * as sinon from "sinon";
import proxyquire from "proxyquire";
import assert from "assert";
import "mocha";
import { IAMRole } from "../iam/iam";
import { expect } from "chai";

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
                        // 字下げも実ファイル同等に再現したいのでインデントはソースコードに揃えずに記載する
                        const policyContent: string = 
`{
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
}`
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
                        const readFileSyncStub = sinon.stub().returns(policyContent);

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
                    "### createPolicyメソッドでリソースに[App]タグが付けられているか確認します。",
                    function(done) {
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

                        const readPolicyJsonStub = sinon.stub().returns(JSON.parse(expectedJson.toString()));
                        const IAMRole = proxyquire('../iam/iam.ts', {
                            'fs': { readFileSync: readPolicyJsonStub }
                        }).IAMRole;

                        const iamRole = new IAMRole("testRole", "testPolicy", "../iam/policy/test.json", {App: "PicToTxt"});

                        // When
                        let iamRolePolicyResource = iamRole["createIAMRole"](provider);

                        // Then
                        pulumi
                            .all([iamRolePolicyResource?.urn, iamRolePolicyResource?.tags])
                            .apply(
                                ([urn, tags]) => {
                                    if (!tags || !tags["App"]){
                                        done(new Error(`Missing a App tag on IAM Role ${urn}`));
                                    }else {
                                        done();
                                    }
                                }
                            )
                    }
                )

                it(
                    "### createIAMRoleメソッドでリソースに[App]タグが付けられているか確認します。",
                    function(done) {
                        // Given
                        const createPolicyStub = sinon.stub().returns("");
                        const IAMRole = proxyquire('../iam/iam.ts', {
                            'fs': { readFileSync: createPolicyStub }
                        }).IAMRole;

                        const iamRole = new IAMRole("testRole", "testPolicy", "../iam/policy/test.json", {App: "PicToTxt"});

                        // When
                        let iamRoleResource = iamRole.createIAMRole(provider);

                        // Then
                        pulumi
                            .all([iamRoleResource?.urn, iamRoleResource?.tags])
                            .apply(
                                ([urn, tags]) => {
                                    if (!tags || !tags["App"]){
                                        done(new Error(`Missing a App tag on IAM Role ${urn}`));
                                    }else {
                                        done();
                                    }
                                }
                            )
                    }
                )
            }
        )

        describe(
            "## IAMRoleクラス用コンフィグファイルテスト",
            function() {
                it(
                    "### JSONファイルに構文エラーがないか確認します。",
                    function(done) {
                        // Given
                        let jsonFiles: string[] = fs.readdirSync("/pulumi/projects/InfraPicToTxt/iam/policies/");
                        for(let i = 0; i < jsonFiles.length; i++){
                            jsonFiles[i] = "/pulumi/projects/InfraPicToTxt/iam/policies/" + jsonFiles[i];
                        }

                        // When
                        // Then
                        assert.doesNotThrow(() =>
                            jsonFiles.forEach((s) => {
                                let jsonString: string = fs.readFileSync(s, "utf-8");
                                JSON.parse(jsonString || "null");
                            })
                        )
                        done();
                    }
                )
            }
        )
    }
)

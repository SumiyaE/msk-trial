import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import * as msk from '@aws-cdk/aws-msk-alpha';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { ManagedKafkaEventSource } from "aws-cdk-lib/aws-lambda-event-sources";

export class MskTrialStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    let topicName: string;
    topicName = "transactions";

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2
    });

    const cluster = new msk.Cluster(this, "Cluster", {
      clusterName: 'myclusterviasimplecdk',
      kafkaVersion: msk.KafkaVersion.V2_8_1,
      // デフォルトではkafka.m5.largeで作成されるため、最小のインスタンスサイズを指定
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      // brokerにはec2インスタンスを使用するため、mskはvpc内に作成する
      vpc: vpc,
      ebsStorageInfo: {
        volumeSize: 50,
      },
    })


    let transactionHandler = new NodejsFunction(this, "TransactionHandler", {
      runtime: Runtime.NODEJS_20_X,
      entry: 'lambda/transaction-handler.ts',
      handler: 'handler',
      vpc: vpc,
      functionName: 'TransactionHandler',
      timeout: Duration.minutes(1),
    });

    // lambdaにmskへの権限を付与
    transactionHandler.role?.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaMSKExecutionRole',
      ),
    );

    transactionHandler.addEventSource(new ManagedKafkaEventSource({
      clusterArn: cluster.clusterArn,
      topic: topicName,
      batchSize: 100, // default
      // lambdaがmskのイベントをどこから処理するかを決める値
      startingPosition: lambda.StartingPosition.LATEST
    }));

    // 全てのportからのトラフィックを許可
    cluster.connections.allowFromAnyIpv4(ec2.Port.allTraffic(), "allow all from anywhere");
  }
}

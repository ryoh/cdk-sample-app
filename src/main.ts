import { App, CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    /**
     * VPC
     */
    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.100/16'),
      maxAzs: 2,
      flowLogs: {},
      subnetConfiguration: [
        {
          name: 'Public',
          cidrMask: 24,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'Private',
          cidrMask: 22,
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          name: 'Protected',
          cidrMask: 22,
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    /**
     * EC2 Instance Connect Endpoint
     */
    // Security Group
    const eiceSecurityGroup = new ec2.SecurityGroup(this, 'EiceSecurityGroup', {
      vpc,
      allowAllOutbound: false,
      securityGroupName: 'EiceSecurityGroup',
    });

    // EC2 Instance Connect Endpoint
    const instanceConnectEndpoint = new ec2.CfnInstanceConnectEndpoint(
      this,
      'InstanceConnectEndpoint',
      {
        subnetId: vpc.privateSubnets[0].subnetId,
        securityGroupIds: [eiceSecurityGroup.securityGroupId],
      },
    );

    /**
     * EC2 Instance
     */
    // Security Group
    const instanceSecurityGroup = new ec2.SecurityGroup(
      this,
      'InstanceSecurityGroup',
      {
        vpc,
        allowAllOutbound: true,
      },
    );

    // EC2
    const instance = new ec2.Instance(this, 'Instance', {
      vpc,
      instanceType: new ec2.InstanceType('t3.micro'),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      securityGroup: instanceSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Security Group of EC2 Instance Connect
    instanceSecurityGroup.addIngressRule(eiceSecurityGroup, ec2.Port.SSH);
    eiceSecurityGroup.addEgressRule(instanceSecurityGroup, ec2.Port.SSH);

    instance.node.addDependency(instanceConnectEndpoint);

    new CfnOutput(this, 'InstanceId', { value: instance.instanceId });
    new CfnOutput(this, 'EIC Command', { value: `aws ec2-instance-connect ssh --instance-id ${instance.instanceId} --connect-tyep eice`});
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new MyStack(app, 'cdk-sample-app-dev', { env: devEnv });
// new MyStack(app, 'cdk-sample-app-prod', { env: prodEnv });

app.synth();

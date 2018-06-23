# Email VCS Slash Commands

Interface with [Email VCS](https://github.com/coalharbourgroup/email-vcs) via Chat Client Commands


## Requirements

Node >= v8.10.0


## Install

Copy `.env.default` to `.env` and set your config variables for use during testing.

```bash
$ npm install
```

## Setup
1. Create ZIP files, one for Slash Command handling and one for Processing

    * Clone repo locally
    * Run "npm install" from the command line of the project dir root
    * Run the following commands:

```bash
$ zip -r process.zip process.js node_modules integrations wkhtmltopdf
```

```bash
$ zip -r handler.zip handler.js node_modules integrations
```

2. Create new AWS API Gateway

    * Create a "New API"
    * Enter the name of your API
    * Create API

![AWS API Gateway Setup 1](/docs/img/awsApiGatewaySetupOne.png?raw=true "AWS API Gateway Setup 1")


3. Create a [https://console.aws.amazon.com/lambda/home?region=us-east-1#/create](new AWS Lambda function) for your slash command handler.

    * Choose Author From Scratch
    * Enter the name of your function
    * Choose Node >= v8.x Runtime
    * Choose an Existing IAM Role or create a New Role from the "Basic Edge Lambda permissions"
    * Save the Lambda

![AWS Lambda Setup 1](/docs/img/awsLambdaSetupOne.png?raw=true "AWS Lambda Setup 1")


3. Create another [https://console.aws.amazon.com/lambda/home?region=us-east-1#/create](new AWS Lambda function) for your process function.

    * Choose Author From Scratch
    * Enter the name of your function
    * Choose Node >= v8.x Runtime
    * Choose an Existing IAM Role or create a New Role from the "Basic Edge Lambda permissions"
    * Save the Lambda

![AWS Lambda Setup 1](/docs/img/awsLambdaSetupTwo.png?raw=true "AWS Lambda Setup 2")


4. Finish API Gateway setup

    * Select Actions -> Create Method -> POST
    * Select Lambda Function
    * Select Use Lambda Proxy integration
    * Enter Lambda Function name of your slash command handler function
    * Save
    * Approve Permission
    * Select Resouces -> Actions -> Deploy API
    * Select a stage or create a new stage
    * Save
    * Copy the Invoke URL for later use

![AWS API Gateway Setup 2](/docs/img/awsApiGatewaySetupTwo.png?raw=true "AWS API Gateway Setup 2")

![AWS API Gateway Setup 3](/docs/img/awsApiGatewaySetupThree.png?raw=true "AWS API Gateway Setup 3")



5. Setup the Lambda trigger for your slash command handler

    * Click your Lambda function name for your command handler function
    * Add API Gateway as a new trigger
    * Select the newly created API Gateway from the list
    * Select Deployment Stage
    * Set Security as Open (we'll verify the token before processing) or select your preferred security mechanism
    * Add

![AWS Lambda Trigger Setup](/docs/img/awsLambdaTriggerSetup.png?raw=true "AWS Lambda Trigger Setup")


6. Setup your Slash Command (instructions for Slack)
    * Open Slack -> Team Name -> Administration -> Manage Apps -> Custom Integrations -> Slash Commands
    * Click Add Configuration
    * Enter a name for you command
    * Click Add Slash Command Integration

    * Enter the URL of your API Gateway Invoke URL from Step 4
    * Select a Method of POST
    * Copy the token value, you'll use this on steps 8 and 9 for your Lambda CHAT_COMMAND_TOKEN env variables
    * Customize the name and icon if you'd like to
    * Click Save Integration

![Slack Slash Command Setup](/docs/img/slackSlashCommandSetup.png?raw=true "Slack Slash Command Setup")


7. Setup your Bot (instructions for slack)
    * Open Slack -> Team Name -> Administration -> Manage Apps -> Custom Integrations -> Bots
    * Click Add Configuration
    * Enter a username for your bot (this can be the same name as your slash command)
    * Click Add Bot Integration

    * Copy the API Token value, you'll use this on steps 8 and 9 for your Lambda CHAT_ACCESS_TOKEN env variables
    * Customize the name, icon, and permissions if you'd like to
    * Click Save Integration

![Slack Bot Setup](/docs/img/slackBotSetup.png?raw=true "Slack Bot Setup")


8. Setup the Lambda function for your slash command handler

    * Click your function name for your slash command handler function
    * Select Upload a .ZIP File
    * Select to upload the handler.zip file created in step 1
    * Select a Runtime of Node >= 8.10
    * Enter Handler as "handler.handler"
    * Set configuration variables (quotes are not needed in AWS fields):
        * DEBUG = true
        * INTEGRATION = 'slack'
        * GITHUB_TEMPLATE_REPO = 'email-vcs-templates'
        * GITHUB_OWNER = 'coalharbourgroup'
        * GITHUB_SYNC_BRANCH = 'master'
        * GITHUB_API_TOKEN = 'yourGithubApiToken'
        * CHAT_COMMAND_TOKEN = 'slashCommandToken'
        * CHAT_ACCESS_TOKEN = 'botAccessToken'
        * PROCESS_ACCESS_TOKEN = 'uniqueSecretForVerification'
        * PROCESS_LAMBDA_REGION = 'us-east-1'
        * PROCESS_LAMBDA_NAME = 'processLambdaFunctionName'
    * Increase the timeout to 1 min, 0 sec
    * Click Save

![AWS Lambda Setup 2](/docs/img/awsLambdaSetupThree.png?raw=true "AWS Lambda Setup 3")


9. Repeat the same steps as above to setup the Lambda function for your process function

    * Click your function name for your process function
    * Select Upload a .ZIP File
    * Select to upload the process.zip file created in step 1
    * Select a Runtime of Node >= 8.10
    * Enter Handler as "process.handler"
    * Set configuration variables (quotes are not needed in AWS fields):
        * DEBUG = true
        * INTEGRATION = 'slack'
        * GITHUB_TEMPLATE_REPO = 'email-vcs-templates'
        * GITHUB_OWNER = 'coalharbourgroup'
        * GITHUB_SYNC_BRANCH = 'master'
        * GITHUB_API_TOKEN = 'yourGithubApiToken'
        * CHAT_COMMAND_TOKEN = 'slashCommandToken'
        * CHAT_ACCESS_TOKEN = 'botAccessToken'
        * PROCESS_ACCESS_TOKEN = 'uniqueSecretForVerification'
        * PROCESS_LAMBDA_REGION = 'us-east-1'
        * PROCESS_LAMBDA_NAME = 'processLambdaFunctionName'
    * Increase the timeout to 5 min, 0 sec
    * Click Save


10. Update the IAM role used for these Lambda functions to attach the "AWSLambdaFullAccess" policy

    * Select the Role that your Handler Lambda function is using
    * Click Attach Policy
    * Search for "AWSLambdaFullAccess"
    * Click Attach Policy (this allows your handler to invoke your process function)

![AWS IAM Setup](/docs/img/awsIamSetup.png?raw=true "AWS IAM Setup")


11. Done

![Done](/docs/img/slackDone.png?raw=true "Done")



## Integration with Other Chat Clients
If you'd like to integrate with a chat client other than Slack do the following:

1. Create a new directory at ./integrations/yourIntegrationsName/

2. Port ./integration/slack/handler.js to support your chat client's command format

3. Port ./integration/slack/uploader.js to support uploading to your chat clients

4. Update INTEGRATION in your env variables to the name of your new chat module


If you integrate with additional chat clients we'd greatly appreciate you submitting a PR.
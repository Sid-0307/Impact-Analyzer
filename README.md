# Impact-Analyzer

This repo contains 2 parts.

The main server which constitues frontend and backend and the plugin present in the analyzer/ folder.

## Overview
Impact-analyzer is a plugin which scans code for changes and generates a report if changes are persent. This is done with a combination of scanning the repository and genai to track change and generate summary.


## Architecture
![Architecture](https://github.com/Sid-0307/Impact-Analyzer/blob/main/documentation/Architecture.png)

## Execution
### Server
The server constitues of the frontend and backend. Its a simple web app which allows you to browse the repositories present and subscribe to notifications as required.

#### How to run
Add env variables in ./docker-compose.yml

Get the GEMINI_API_KEY from `https://aistudio.google.com/api-keys`

SMTP_EMAIL is the email address from which the mail has to be sent

SMTP_PASSWORD is the password for authentication, please refer to the SMTP client to know how to get the password

GITHUB_TOKEN is required to acccess github.

*To start the service*

`
docker compose up -d
`

*To stop the service*

`
docker compose down
`

### Analyzer
The analyzer is a spring boot application which scans a repo and provide the details regarding the controllers present in the repo along with a detailed  description of the **Request Parameters**, **Body** and the *Content Returned*.

#### How to run
To build the image

`
cd ./analyzer/
docker build -t java-scanner .
`

To run(NOTE: Ensure that the main server is running, Refer to the above steps)

`
docker run --rm --network host java-scanner:latest <COMMIT-ID> <REPO-URL> <TAG>
`

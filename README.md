# Bitbucket PullRequest Detector

Pull Requests increasingly dominate our technical workflows, yet ensuring that
the right people review them, or that we have a centralized place to configure
automation side-effects in response to new Pull Requests, can be challenging.

This module, intended to be run periodically, checks to see if new pull requests
have been opened in one or more target bitbucket repositories.

If those PRs contain changes matching a certain pattern, this script will
perform actions, e.g. sending a slack message to a configured channel.

## Configuration and Usage

Import and execute the module via:

```typescript
import { processPullRequestsAsync, PRDetectorConfig } from '@jupiterone/bitbucket-pr-detector';

const config: PRDetectorConfig = {
  ...
};

await processPullRequestsAsync(config);
```

Where `config` satisfies the interface:

```javascript
export interface PRDetectorConfig {
    bitbucketOrg: string       // required, organization name
    bitbucketRepo: string      // required, repository name
    bitbucketUsername: string  // required, bitbucket user name
    bitbucketPassword: string  // required, bitbucket password
    bitbucketPRQuery?: string  // if given, will override bitbucket API filter
    slackWebhookUrl?: string   // if given, will alert to Slack
    slackAuthor?: string       // alert author
    slackAlertTitle?: string   // alert title
    detectPath?: string        // required if using default detectionFilter(), which
                               // returns true if any PR modified paths match string
    detectionFilter?: (config: PRDetectorConfig, diffStats: any[]) => boolean
    checkPRSeenAsync?: (config: PRDetectorConfig, input: PRSeenInput) => Promise<boolean>
    savePRSeenAsync?: (config: PRDetectorConfig, input: PRSaveInput) => Promise<void>
    processPRAsync?: (config: PRDetectorConfig, pr: any) => Promise<void>
    logger?: any
}
```

### Detection filtering

Unless `detectionFilter()` is overridden, the module will search for Pull
Requests which contain changed files whose path includes a substring specified
by the `detectPath` config attribute. For instance, if you have a `wiki`
repository, and it contains RFCs organized under a `docs/RFCs` folder, then
specifying `detectPath: 'docs/RFCs'` will detect new Pull Requests that contain
RFC documentation.

The `detectionFilter` function receives the config object, the Pull Request
Object, and an array of Bitbucket API DiffStat objects for that PR.

See:

- [Bitbucket API PullRequest Documentation](https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/%7Busername%7D/%7Brepo_slug%7D/pullrequests#get)
- [Bitbucket API DiffStat Documentation](https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/%7Busername%7D/%7Brepo_slug%7D/diffstat/%7Bspec%7D)

The function should return true if that PR is considered novel or worth alerting
on.

### Alerting to Slack

If you'd like the module to alert to a Slack channel whenever a novel Pull
Request is detected, configure the `slackWebhookUrl` with the custom integration
webhook URL for a channel of your choice. You'll also want to configure
`slackAuthor` and `slackAlertTitle` appropriately.

For instance, continuing the example above, we might specify:

```typescript
{
  slackWebhookUrl: process.env.SLACK_WEBHOOK_RFCS_CHANNEL,
  slackAuthor: 'new-rfc-notifier',
  slackAlertTitle: 'New RFC Pull Request found in wiki repository'
}
```

If you'd rather not alert to Slack, omit the `slackWebhookUrl` attribute.

### Persistence / Alert Deduping

Since this is intended to run periodically, a persistence store should be made
available to cache previously seen Pull Requests, to prevent duplicate
alerts/actions for the same triggering Pull Request. A key-value store like
Redis or DynamoDB is ideal, but any persistence mechanism which satisfies the
`checkPRSeenAsync()/savePRSeenAsync()` function interfaces will work. The module
will complain if you have not overridden the default persistence functions.

### Additional Processing

If you'd like to take other actions on new Pull Requests which satisfy the
`detectionFilter()`, override the `processPRAsync()` attribute with a custom
function.
